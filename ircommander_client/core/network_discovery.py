"""
Network Discovery Module
Discovers other iRCommander clients on the local network using UDP broadcast.
"""

import json
import socket
import threading
import time
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta

from core.device import get_local_ip, get_hostname, get_fingerprint


# Discovery configuration
DISCOVERY_PORT = 54321  # UDP port for discovery
BEACON_INTERVAL = 5.0  # Send beacon every 5 seconds
PEER_TIMEOUT = 15.0  # Consider peer offline after 15 seconds without beacon
DISCOVERY_MAGIC = b"IRCOMMANDER_DISCOVERY"  # Magic bytes to identify our packets


@dataclass
class DiscoveredPeer:
    """Information about a discovered peer."""
    device_id: str
    device_name: str
    hostname: str
    local_ip: str
    hardware_id: str
    version: str
    iracing_connected: bool
    last_seen: datetime
    port: Optional[int] = None  # Optional port for direct communication
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        data = asdict(self)
        data['last_seen'] = self.last_seen.isoformat()
        return data
    
    def is_online(self) -> bool:
        """Check if peer is still online (within timeout)."""
        return (datetime.now() - self.last_seen).total_seconds() < PEER_TIMEOUT


class NetworkDiscovery:
    """Network discovery service for finding other clients on the local network."""
    
    def __init__(self, device_id: Optional[str] = None, device_name: Optional[str] = None, 
                 version: str = "1.0.0", on_peer_discovered: Optional[Callable] = None,
                 on_peer_lost: Optional[Callable] = None):
        """
        Initialize network discovery.
        
        Args:
            device_id: This device's ID
            device_name: This device's name
            version: Client version
            on_peer_discovered: Callback when a new peer is discovered
            on_peer_lost: Callback when a peer goes offline
        """
        self.device_id = device_id or f"unknown-{get_fingerprint()[:8]}"
        self.device_name = device_name or get_hostname()
        self.version = version
        self.local_ip = get_local_ip()
        self.hardware_id = get_fingerprint()
        
        self.on_peer_discovered = on_peer_discovered
        self.on_peer_lost = on_peer_lost
        
        self.running = False
        self.peers: Dict[str, DiscoveredPeer] = {}  # keyed by device_id
        self.peers_lock = threading.Lock()
        
        self._beacon_socket: Optional[socket.socket] = None
        self._listener_socket: Optional[socket.socket] = None
        self._beacon_thread: Optional[threading.Thread] = None
        self._listener_thread: Optional[threading.Thread] = None
        self._cleanup_thread: Optional[threading.Thread] = None
        
        self._iracing_connected = False
    
    def set_iracing_status(self, connected: bool):
        """Update iRacing connection status (included in beacons)."""
        self._iracing_connected = connected
    
    def start(self):
        """Start discovery service."""
        if self.running:
            return
        
        self.running = True
        
        # Start beacon sender
        self._beacon_thread = threading.Thread(target=self._beacon_loop, daemon=True)
        self._beacon_thread.start()
        
        # Start listener
        self._listener_thread = threading.Thread(target=self._listener_loop, daemon=True)
        self._listener_thread.start()
        
        # Start cleanup thread
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_thread.start()
        
        print(f"[OK] Network discovery started (listening on {self.local_ip}:{DISCOVERY_PORT})")
    
    def stop(self):
        """Stop discovery service."""
        self.running = False
        
        if self._beacon_socket:
            try:
                self._beacon_socket.close()
            except Exception:
                pass
            self._beacon_socket = None
        
        if self._listener_socket:
            try:
                self._listener_socket.close()
            except Exception:
                pass
            self._listener_socket = None
        
        # Wait for threads to finish
        if self._beacon_thread:
            self._beacon_thread.join(timeout=2)
        if self._listener_thread:
            self._listener_thread.join(timeout=2)
        if self._cleanup_thread:
            self._cleanup_thread.join(timeout=2)
        
        print("[OK] Network discovery stopped")
    
    def get_peers(self, online_only: bool = True) -> List[DiscoveredPeer]:
        """
        Get list of discovered peers.
        
        Args:
            online_only: If True, only return peers that are currently online
        
        Returns:
            List of discovered peers
        """
        with self.peers_lock:
            peers = list(self.peers.values())
        
        if online_only:
            peers = [p for p in peers if p.is_online()]
        
        return peers
    
    def get_peer(self, device_id: str) -> Optional[DiscoveredPeer]:
        """Get a specific peer by device_id."""
        with self.peers_lock:
            return self.peers.get(device_id)
    
    def _beacon_loop(self):
        """Background thread that sends periodic beacons."""
        try:
            # Create UDP socket for broadcasting
            self._beacon_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self._beacon_socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            self._beacon_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            # Bind to local IP (required on some systems)
            try:
                self._beacon_socket.bind((self.local_ip, 0))  # Use any available port
            except Exception:
                # Fallback: bind to all interfaces
                self._beacon_socket.bind(('', 0))
            
            while self.running:
                try:
                    # Create beacon message
                    beacon = {
                        "magic": DISCOVERY_MAGIC.hex(),
                        "device_id": self.device_id,
                        "device_name": self.device_name,
                        "hostname": get_hostname(),
                        "local_ip": self.local_ip,
                        "hardware_id": self.hardware_id,
                        "version": self.version,
                        "iracing_connected": self._iracing_connected,
                        "timestamp": time.time()
                    }
                    
                    message = json.dumps(beacon).encode('utf-8')
                    
                    # Broadcast to local network
                    broadcast_addr = self._get_broadcast_address()
                    if broadcast_addr:
                        try:
                            self._beacon_socket.sendto(message, (broadcast_addr, DISCOVERY_PORT))
                        except Exception as e:
                            # Silently continue - network might be unavailable
                            pass
                    
                    time.sleep(BEACON_INTERVAL)
                except Exception as e:
                    print(f"[WARN] Beacon error: {e}")
                    time.sleep(BEACON_INTERVAL)
        except Exception as e:
            print(f"[ERROR] Beacon thread error: {e}")
        finally:
            if self._beacon_socket:
                try:
                    self._beacon_socket.close()
                except Exception:
                    pass
    
    def _listener_loop(self):
        """Background thread that listens for beacons from other clients."""
        try:
            # Create UDP socket for listening
            self._listener_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self._listener_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            # Bind to discovery port
            try:
                self._listener_socket.bind(('', DISCOVERY_PORT))
            except OSError as e:
                print(f"[WARN] Could not bind to discovery port {DISCOVERY_PORT}: {e}")
                print("[INFO] Another instance may be running, or port is in use")
                return
            
            # Set socket to non-blocking with timeout
            self._listener_socket.settimeout(1.0)
            
            while self.running:
                try:
                    data, addr = self._listener_socket.recvfrom(4096)
                    
                    # Parse as JSON and verify magic
                    try:
                        message = json.loads(data.decode('utf-8'))
                        # Verify magic bytes match
                        if message.get('magic') != DISCOVERY_MAGIC.hex():
                            continue
                        # Handle the beacon
                        self._handle_beacon(message, addr[0])
                    except (json.JSONDecodeError, UnicodeDecodeError, KeyError):
                        # Invalid message format, ignore
                        continue
                        
                except socket.timeout:
                    # Timeout is expected, continue
                    continue
                except Exception as e:
                    if self.running:
                        print(f"[WARN] Listener error: {e}")
                    time.sleep(0.1)
        except Exception as e:
            print(f"[ERROR] Listener thread error: {e}")
        finally:
            if self._listener_socket:
                try:
                    self._listener_socket.close()
                except Exception:
                    pass
    
    def _handle_beacon(self, message: Dict, sender_ip: str):
        """Handle a received beacon from another client."""
        try:
            device_id = message.get('device_id')
            if not device_id or device_id == self.device_id:
                # Ignore our own beacons
                return
            
            # Create or update peer
            with self.peers_lock:
                is_new = device_id not in self.peers
                
                peer = DiscoveredPeer(
                    device_id=device_id,
                    device_name=message.get('device_name', 'Unknown'),
                    hostname=message.get('hostname', 'Unknown'),
                    local_ip=message.get('local_ip', sender_ip),
                    hardware_id=message.get('hardware_id', ''),
                    version=message.get('version', 'Unknown'),
                    iracing_connected=message.get('iracing_connected', False),
                    last_seen=datetime.now()
                )
                
                self.peers[device_id] = peer
            
            # Callback for new peer
            if is_new and self.on_peer_discovered:
                try:
                    self.on_peer_discovered(peer)
                except Exception as e:
                    print(f"[WARN] Peer discovered callback error: {e}")
        except Exception as e:
            print(f"[WARN] Error handling beacon: {e}")
    
    def _cleanup_loop(self):
        """Background thread that removes stale peers."""
        while self.running:
            try:
                time.sleep(5)  # Check every 5 seconds
                
                with self.peers_lock:
                    now = datetime.now()
                    lost_peers = []
                    
                    for device_id, peer in list(self.peers.items()):
                        if not peer.is_online():
                            lost_peers.append(peer)
                            del self.peers[device_id]
                    
                    # Callback for lost peers
                    if lost_peers and self.on_peer_lost:
                        for peer in lost_peers:
                            try:
                                self.on_peer_lost(peer)
                            except Exception as e:
                                print(f"[WARN] Peer lost callback error: {e}")
            except Exception as e:
                print(f"[WARN] Cleanup error: {e}")
    
    def _get_broadcast_address(self) -> Optional[str]:
        """Get the broadcast address for the local network."""
        try:
            # Get network interface info
            import platform
            if platform.system() == "Windows":
                # On Windows, use the subnet broadcast
                # For a typical 192.168.x.x network, broadcast is 192.168.x.255
                ip_parts = self.local_ip.split('.')
                if len(ip_parts) == 4:
                    ip_parts[3] = '255'
                    return '.'.join(ip_parts)
            else:
                # On Linux/Mac, try to get broadcast from network interface
                try:
                    import netifaces
                    for interface in netifaces.interfaces():
                        addrs = netifaces.ifaddresses(interface)
                        if netifaces.AF_INET in addrs:
                            for addr_info in addrs[netifaces.AF_INET]:
                                if addr_info.get('addr') == self.local_ip:
                                    return addr_info.get('broadcast')
                except ImportError:
                    # netifaces not available, use fallback
                    pass
            
            # Fallback: use common broadcast addresses
            if self.local_ip.startswith('192.168.'):
                return '192.168.255.255'
            elif self.local_ip.startswith('10.'):
                return '10.255.255.255'
            elif self.local_ip.startswith('172.'):
                return '172.255.255.255'
            else:
                return '255.255.255.255'  # Global broadcast
        except Exception:
            # Fallback to global broadcast
            return '255.255.255.255'


# Singleton instance
_discovery_instance: Optional[NetworkDiscovery] = None


def get_discovery(device_id: Optional[str] = None, device_name: Optional[str] = None,
                  version: str = "1.0.0", on_peer_discovered: Optional[Callable] = None,
                  on_peer_lost: Optional[Callable] = None) -> NetworkDiscovery:
    """Get or create the network discovery instance."""
    global _discovery_instance
    if _discovery_instance is None:
        _discovery_instance = NetworkDiscovery(
            device_id=device_id,
            device_name=device_name,
            version=version,
            on_peer_discovered=on_peer_discovered,
            on_peer_lost=on_peer_lost
        )
    return _discovery_instance
