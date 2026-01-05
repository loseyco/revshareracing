"""
Command Queue Module
Uses Supabase Realtime to receive commands (push-based, no polling)
Falls back to polling if Realtime is unavailable
"""

import time
import threading
import requests
from typing import Dict, List, Optional, Callable
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core import device


class CommandQueue:
    """Manages receiving and execution of queued commands via Supabase Realtime"""
    
    def __init__(self, device_id: str, supabase_client=None, portal_base_url: str = None):
        self.device_id = device_id
        self.portal_base_url = portal_base_url.rstrip('/') if portal_base_url else None
        self.supabase_client = supabase_client
        self.running = False
        self.realtime_channel = None
        self.poll_thread: Optional[threading.Thread] = None
        self.poll_interval = 10.0  # Fallback polling every 10 seconds (much less frequent)
        self.execute_callback: Optional[Callable[[Dict], Dict]] = None
        self.last_poll_time = 0.0
        self._session = requests.Session()
        self._session.timeout = 5.0
        self._use_realtime = supabase_client is not None
    
    def set_execute_callback(self, callback: Callable[[Dict], Dict]):
        """Set callback function to execute commands"""
        self.execute_callback = callback
    
    def start(self):
        """Start receiving commands via Realtime (or fallback to polling)"""
        if self.running:
            print(f"[WARN] Command queue already running for device {self.device_id}")
            return
        
        self.running = True
        print(f"[*] Starting command queue for device: {self.device_id}")
        
        # Try Realtime first (push-based, no polling)
        if self._use_realtime:
            try:
                self._setup_realtime()
                print(f"[OK] Command queue Realtime subscription started (device: {self.device_id})")
                return
            except Exception as e:
                print(f"[WARN] Realtime setup failed, falling back to polling: {e}")
                import traceback
                traceback.print_exc()
                self._use_realtime = False
        
        # Fallback to polling (less frequent)
        if self.portal_base_url:
            # Also try to fetch via Supabase directly if we have a client (before starting polling)
            if self.supabase_client:
                try:
                    print(f"[*] Checking for pending commands via Supabase before starting polling...")
                    self._fetch_pending_commands()
                except Exception as e:
                    print(f"[WARN] Failed to fetch pending commands via Supabase: {e}")
            
            self.poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
            self.poll_thread.start()
            print(f"[OK] Command queue polling started (device: {self.device_id}, interval: {self.poll_interval}s)")
        else:
            print(f"[WARN] No Supabase client or portal URL - command queue disabled")
    
    def stop(self):
        """Stop receiving commands"""
        self.running = False
        
        # Unsubscribe from Realtime
        if self.realtime_channel:
            try:
                self.supabase_client.remove_channel(self.realtime_channel)
            except:
                pass
            self.realtime_channel = None
        
        # Stop polling thread
        if self.poll_thread:
            self.poll_thread.join(timeout=3)
        
        print("[OK] Command queue stopped")
    
    def _setup_realtime(self):
        """Setup Supabase Realtime subscription for commands"""
        if not self.supabase_client:
            raise ValueError("Supabase client required for Realtime")
        
        # First, fetch any existing pending commands
        self._fetch_pending_commands()
        
        # Subscribe to INSERT events on commands table for this device
        self.realtime_channel = self.supabase_client.channel(f"device-commands-{self.device_id}")
        
        self.realtime_channel.on(
            "postgres_changes",
            {
                "event": "INSERT",
                "schema": "public",
                "table": "irc_device_commands",
                "filter": f"device_id=eq.{self.device_id}",
            },
            self._on_command_inserted
        )
        
        self.realtime_channel.subscribe()
        
        # Verify subscription status after a short delay
        def check_subscription():
            time.sleep(1)
            if self.realtime_channel:
                print(f"[*] Realtime subscription status: {self.realtime_channel.state if hasattr(self.realtime_channel, 'state') else 'unknown'}")
        
        threading.Thread(target=check_subscription, daemon=True).start()
    
    def _fetch_pending_commands(self):
        """Fetch any existing pending commands (one-time on startup)"""
        try:
            print(f"[*] Fetching pending commands for device {self.device_id}...")
            response = self.supabase_client.table("irc_device_commands") \
                .select("*") \
                .eq("device_id", self.device_id) \
                .eq("status", "pending") \
                .order("created_at", desc=False) \
                .limit(10) \
                .execute()
            
            commands = response.data if hasattr(response, 'data') else []
            if commands:
                print(f"[*] Found {len(commands)} existing pending commands - marking as cancelled (queued before service start)")
                # Mark all old pending commands as cancelled since they were queued before service started
                for cmd in commands:
                    cmd_id = cmd.get('id')
                    if cmd_id:
                        try:
                            self.supabase_client.table("irc_device_commands") \
                                .update({
                                    'status': 'failed',
                                    'error_message': 'Command queued before service started - cancelled on startup'
                                }) \
                                .eq('id', cmd_id) \
                                .execute()
                        except Exception as e:
                            print(f"[WARN] Failed to mark command {cmd_id} as cancelled: {e}")
                print(f"[*] Cancelled {len(commands)} old pending commands")
            else:
                print(f"[*] No pending commands found for device {self.device_id}")
        except Exception as e:
            print(f"[ERROR] Failed to fetch pending commands: {e}")
            import traceback
            traceback.print_exc()
    
    def _on_command_inserted(self, payload):
        """Handle new command via Realtime"""
        try:
            command = payload.get("new")
            if not command:
                print(f"[WARN] Realtime payload missing 'new' field: {payload}")
                return
            
            # Only process pending commands
            if command.get("status") != "pending":
                print(f"[INFO] Realtime command received but status is not 'pending': {command.get('status')}")
                return
            
            cmd_id = command.get('id')
            if not cmd_id:
                print(f"[WARN] Realtime command missing ID: {command}")
                return
            
            # Initialize processed commands set if not exists
            if not hasattr(self, '_processed_command_ids'):
                self._processed_command_ids = set()
            
            # Skip if we've already processed this command
            if cmd_id in self._processed_command_ids:
                print(f"[INFO] Realtime command {cmd_id} already processed, skipping")
                return
            
            action = command.get('command_action') or command.get('action', 'unknown')
            print(f"[*] New command received via Realtime: {action} (id: {cmd_id})")
            
            # Mark as processed immediately to prevent loops
            self._processed_command_ids.add(cmd_id)
            
            self._execute_command(command)
        except Exception as e:
            print(f"[ERROR] Failed to process Realtime command: {e}")
            import traceback
            traceback.print_exc()
    
    def _poll_loop(self):
        """Background thread that polls for commands (fallback only)"""
        # Track which commands we've already processed to avoid loops
        self._processed_command_ids = set()
        
        # Fetch pending commands on first poll
        if not hasattr(self, '_initial_poll_done'):
            try:
                print(f"[*] Polling mode: Fetching existing pending commands...")
                self._fetch_pending_commands_via_api()
                self._initial_poll_done = True
            except Exception as e:
                print(f"[WARN] Failed to fetch pending commands on startup: {e}")
        
        while self.running:
            try:
                self._poll_commands()
                time.sleep(self.poll_interval)
            except Exception as e:
                print(f"[WARN] Command queue poll error: {e}")
                time.sleep(self.poll_interval)
    
    def _fetch_pending_commands_via_api(self):
        """Fetch pending commands via API (for polling mode) and cancel them"""
        try:
            # Only fetch pending commands - these are the ones queued before service started
            api_url = f"{self.portal_base_url}/api/device/{self.device_id}/commands?status=pending"
            response = self._session.get(api_url, timeout=5)
            if response.status_code == 404:
                return
            
            response.raise_for_status()
            data = response.json()
            commands = data.get('commands', [])
            if commands:
                print(f"[*] Found {len(commands)} pending commands via API - marking as cancelled (queued before service start)")
                # Mark all old pending commands as cancelled via API
                for cmd in commands:
                    cmd_id = cmd.get('id')
                    if cmd_id:
                        try:
                            # Mark as failed via API
                            complete_url = f"{self.portal_base_url}/api/device/{self.device_id}/commands/{cmd_id}/complete"
                            self._session.post(complete_url, json={
                                'status': 'failed',
                                'error_message': 'Command queued before service started - cancelled on startup'
                            }, timeout=5)
                        except Exception as e:
                            print(f"[WARN] Failed to mark command {cmd_id} as cancelled: {e}")
                print(f"[*] Cancelled {len(commands)} old pending commands")
        except Exception as e:
            print(f"[WARN] Failed to fetch pending commands via API: {e}")
    
    def _poll_commands(self):
        """Poll the website for pending commands"""
        try:
            # Construct API endpoint URL - only fetch pending commands
            api_url = f"{self.portal_base_url}/api/device/{self.device_id}/commands?status=pending"
            
            response = self._session.get(api_url, timeout=5)
            if response.status_code == 404:
                # API endpoint doesn't exist yet - that's OK
                return
            
            response.raise_for_status()
            data = response.json()
            
            commands = data.get('commands', [])
            if not commands:
                return
            
            # Initialize processed commands set if not exists
            if not hasattr(self, '_processed_command_ids'):
                self._processed_command_ids = set()
            
            # Only process PENDING commands that we haven't seen before
            for cmd in commands:
                cmd_id = cmd.get('id')
                cmd_status = cmd.get('status', 'pending')
                
                # Only process pending commands
                if cmd_status != 'pending':
                    continue
                
                # Skip if we've already processed this command
                if cmd_id in self._processed_command_ids:
                    continue
                
                action = cmd.get('command_action') or cmd.get('action', 'unknown')
                print(f"[*] Poll found NEW pending command: {action} (id: {cmd_id})")
                
                # Mark as processed immediately to prevent loops
                self._processed_command_ids.add(cmd_id)
                
                # Execute the command
                self._execute_command(cmd)
                
        except requests.exceptions.RequestException as e:
            # Don't spam errors for network issues
            if time.time() - self.last_poll_time > 30:
                print(f"[WARN] Command queue API unavailable: {e}")
                self.last_poll_time = time.time()
        except Exception as e:
            print(f"[WARN] Failed to poll commands: {e}")
    
    def _execute_command(self, command: Dict):
        """Execute a single command"""
        if not self.execute_callback:
            print("[WARN] No command executor callback set")
            return
        
        cmd_id = command.get('id')
        cmd_type = command.get('command_type') or command.get('type')  # Support both formats
        cmd_action = command.get('command_action') or command.get('action')
        cmd_params = command.get('command_params') or command.get('params', {})
        cmd_created_at = command.get('created_at')
        
        if not cmd_type or not cmd_action:
            print(f"[WARN] Invalid command format: {command}")
            return
        
        # Check if iRacing is running before executing
        # Exception: allow 'enter_car' even when not connected, as it may help establish connection
        try:
            from core import telemetry
            telemetry_mgr = telemetry.get_manager()
            if not telemetry_mgr or not telemetry_mgr.is_connected:
                # Allow enter_car command even when not connected
                if cmd_action != 'enter_car':
                    print(f"[SKIP] Command {cmd_action} (id: {cmd_id}) - iRacing not connected, skipping")
                    return
                else:
                    print(f"[*] Command {cmd_action} (id: {cmd_id}) - iRacing not connected, but allowing enter_car")
            
            # Check if command was queued before iRacing connected (if we can get service instance)
            # Exception: allow 'enter_car' commands regardless of when they were queued
            if cmd_action != 'enter_car' and hasattr(self.execute_callback, '__self__'):
                service = getattr(self.execute_callback, '__self__')
                if service and hasattr(service, 'iracing_connected_time') and service.iracing_connected_time:
                    if cmd_created_at:
                        try:
                            from datetime import datetime
                            if isinstance(cmd_created_at, str):
                                cmd_time = datetime.fromisoformat(cmd_created_at.replace('Z', '+00:00')).timestamp()
                            else:
                                cmd_time = cmd_created_at
                            
                            # Only skip if command is more than 5 minutes old (to avoid processing very stale commands)
                            # But allow recent commands even if they were queued before connection
                            current_time = time.time()
                            if cmd_time < service.iracing_connected_time and (current_time - cmd_time) > 300:
                                print(f"[SKIP] Command {cmd_action} (id: {cmd_id}) - queued before iRacing started and is stale (>5min old), ignoring")
                                return
                        except Exception as e:
                            print(f"[WARN] Could not parse command timestamp: {e}")
        except ImportError:
            pass  # Telemetry module not available, proceed anyway
        
        print(f"[*] Executing command: {cmd_type}/{cmd_action} (id: {cmd_id})")
        print(f"[*] Command found in queue - executing now...")
        
        # Notify about command received
        if self.execute_callback:
            try:
                # Try to get service instance from callback
                if hasattr(self.execute_callback, '__self__'):
                    service = getattr(self.execute_callback, '__self__')
                    if service and hasattr(service, 'on_command_received') and service.on_command_received:
                        service.on_command_received({
                            'action': cmd_action,
                            'source': f'queue_{cmd_type}',
                            'command_id': cmd_id
                        })
            except Exception:
                pass
        
        # Mark command as processing first
        if cmd_id:
            self._mark_command_processing(cmd_id)
        
        try:
            result = self.execute_callback({
                'type': cmd_type,
                'action': cmd_action,
                'params': cmd_params,
                'command_id': cmd_id
            })
            
            success = result.get('success', False)
            message = result.get('message', '')
            if success:
                print(f"[OK] Command executed successfully: {cmd_action}")
            else:
                print(f"[WARN] Command execution failed: {message}")
            
            # Notify about command executed
            if self.execute_callback:
                try:
                    if hasattr(self.execute_callback, '__self__'):
                        service = getattr(self.execute_callback, '__self__')
                        if service and hasattr(service, 'on_command_received') and service.on_command_received:
                            # Get the key message from the action log if available
                            key_message = ''
                            if hasattr(service, 'controls_manager') and service.controls_manager:
                                log_entries = service.controls_manager.get_action_log(limit=1)
                                if log_entries:
                                    latest_entry = log_entries[-1]
                                    key_message = latest_entry.get('key_message', '')
                            
                            service.on_command_received({
                                'action': cmd_action,
                                'source': f'queue_{cmd_type}',
                                'success': success,
                                'message': message,
                                'key_message': key_message,
                                'command_id': cmd_id
                            })
                        
                        # Force state update after command execution to sync with website
                        if service and hasattr(service, '_check_and_push_state_changes'):
                            time.sleep(0.5)  # Wait a moment for state to change
                            try:
                                from core import telemetry
                                current_telemetry = telemetry.get_current()
                                if current_telemetry:
                                    print(f"[INFO] Forcing state update after command {cmd_action}")
                                    service._check_and_push_state_changes(current_telemetry)
                            except Exception as e:
                                print(f"[WARN] Failed to force state update after command: {e}")
                except Exception as e:
                    print(f"[WARN] Error in command callback: {e}")
            
            # Mark command as completed/failed with result
            if cmd_id:
                # _mark_command_complete will log the result
                self._mark_command_complete(cmd_id, success, message, result)
                
        except Exception as e:
            print(f"[ERROR] Command execution failed: {e}")
            import traceback
            traceback.print_exc()
            result = {'success': False, 'error': str(e)}
            if cmd_id:
                try:
                    self._mark_command_complete(cmd_id, False, str(e), result)
                except Exception as mark_error:
                    print(f"[ERROR] Failed to mark command as failed: {mark_error}")
    
    def _mark_command_processing(self, command_id: str):
        """Mark a command as processing"""
        try:
            api_url = f"{self.portal_base_url}/api/device/{self.device_id}/commands/{command_id}/complete"
            self._session.post(api_url, json={'status': 'processing'}, timeout=5)
        except Exception as e:
            print(f"[WARN] Failed to mark command as processing: {e}")
    
    def _mark_command_complete(self, command_id: str, success: bool = True, message: str = '', result: Dict = None):
        """Mark a command as completed or failed on the server"""
        try:
            api_url = f"{self.portal_base_url}/api/device/{self.device_id}/commands/{command_id}/complete"
            status = 'completed' if success else 'failed'
            error_message = None if success else message
            
            payload = {
                'status': status,
                'result': result or {'success': success, 'message': message}
            }
            if error_message:
                payload['error_message'] = error_message
            
            response = self._session.post(api_url, json=payload, timeout=5)
            if response.status_code == 200:
                print(f"[OK] Command {command_id} marked as {status}")
            else:
                print(f"[WARN] Failed to mark command {command_id} as {status}: HTTP {response.status_code}")
        except Exception as e:
            print(f"[WARN] Failed to mark command complete: {e}")


def create_queue(device_id: str, supabase_client=None, portal_base_url: str = None) -> CommandQueue:
    """Create a command queue instance"""
    # Prefer Realtime if Supabase client is available
    if supabase_client:
        return CommandQueue(device_id, supabase_client=supabase_client, portal_base_url=portal_base_url)
    
    # Fallback to polling if no Supabase client
    if portal_base_url is None:
        device_info = device.get_info()
        portal_url = device_info.get('portal_url', 'https://revshareracing.com/device/rig-unknown')
        # Extract base URL - remove /device/rig-xxx or /device suffix
        if '/device/' in portal_url:
            portal_base_url = portal_url.rsplit('/device/', 1)[0]
        elif portal_url.endswith('/device'):
            portal_base_url = portal_url.rsplit('/device', 1)[0]
        else:
            # If no /device in path, assume it's already a base URL
            portal_base_url = portal_url.rstrip('/')
    
    return CommandQueue(device_id, supabase_client=None, portal_base_url=portal_base_url)

