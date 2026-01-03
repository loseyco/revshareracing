"""
Remote Desktop Module
WebRTC-based remote desktop streaming for low-latency screen sharing.
"""

import asyncio
import logging
import threading
import time
from typing import Optional, Callable
import json
import base64

try:
    from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
    import cv2
    import mss
    import numpy as np
    from av import VideoFrame
    WEBRTC_AVAILABLE = True
except ImportError as e:
    WEBRTC_AVAILABLE = False
    IMPORT_ERROR = str(e)

logger = logging.getLogger(__name__)


# Only define classes when WebRTC is available
if WEBRTC_AVAILABLE:
    class ScreenCaptureTrack(VideoStreamTrack):
        """Video track that captures screen and streams it."""
        
        def __init__(self, fps: int = 30, quality: int = 80):
            super().__init__()
            self.fps = fps
            self.quality = quality
            self.frame_interval = 1.0 / fps
            self.last_frame_time = 0
            self.sct = mss.mss()
            self.monitor = self.sct.monitors[1]  # Primary monitor
            
            # Performance tracking
            self.frame_count = 0
            self.start_time = time.time()
        
        async def recv(self):
            """Generate next video frame."""
            pts, time_base = await self.next_timestamp()
            
            # Throttle to target FPS
            current_time = time.time()
            elapsed = current_time - self.last_frame_time
            if elapsed < self.frame_interval:
                await asyncio.sleep(self.frame_interval - elapsed)
            
            # Capture screen
            screenshot = self.sct.grab(self.monitor)
            img = np.array(screenshot)
            
            # Convert BGRA to RGB
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
            
            # Resize for performance (optional - can be adjusted)
            height, width = img.shape[:2]
            max_width = 1920
            max_height = 1080
            
            if width > max_width or height > max_height:
                scale = min(max_width / width, max_height / height)
                new_width = int(width * scale)
                new_height = int(height * scale)
                img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_LINEAR)
            
            # Create VideoFrame
            frame = VideoFrame.from_ndarray(img, format="rgb24")
            frame.pts = pts
            frame.time_base = time_base
            
            self.last_frame_time = time.time()
            self.frame_count += 1
            
            return frame
        
        def get_stats(self) -> dict:
            """Get capture statistics."""
            elapsed = time.time() - self.start_time
            return {
                "frames_captured": self.frame_count,
                "fps": self.frame_count / elapsed if elapsed > 0 else 0,
                "monitor": {
                    "width": self.monitor["width"],
                    "height": self.monitor["height"]
                }
            }
else:
    # Dummy class when WebRTC is not available
    class ScreenCaptureTrack:
        pass


if WEBRTC_AVAILABLE:
    class RemoteDesktopServer:
        """WebRTC server for remote desktop streaming."""
        
        def __init__(self, on_connection_state_change: Optional[Callable] = None):
            if not WEBRTC_AVAILABLE:
                raise ImportError(
                    f"WebRTC dependencies not available: {IMPORT_ERROR}\n"
                    f"Please install: pip install aiortc opencv-python mss numpy aiohttp"
                )
            
            self.pc: Optional[RTCPeerConnection] = None
            self.video_track: Optional[ScreenCaptureTrack] = None
            self.on_connection_state_change = on_connection_state_change
            self.is_running = False
            self._loop: Optional[asyncio.AbstractEventLoop] = None
            self._thread: Optional[threading.Thread] = None
            
            # Connection state
            self.connection_state = "new"
            self.ice_connection_state = "new"
        
        def start(self):
            """Start the remote desktop server in background thread."""
            if self.is_running:
                return
            
            self.is_running = True
            self._thread = threading.Thread(target=self._run_async_loop, daemon=True)
            self._thread.start()
            logger.info("Remote desktop server started")
        
        def stop(self):
            """Stop the remote desktop server."""
            self.is_running = False
            if self._loop:
                asyncio.run_coroutine_threadsafe(self._cleanup(), self._loop)
            if self._thread:
                self._thread.join(timeout=5)
            logger.info("Remote desktop server stopped")
        
        def _run_async_loop(self):
            """Run asyncio event loop in background thread."""
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            self._loop.run_forever()
        
        async def _cleanup(self):
            """Cleanup WebRTC connection."""
            if self.pc:
                await self.pc.close()
                self.pc = None
            if self.video_track:
                self.video_track = None
            if self._loop:
                self._loop.stop()
        
        async def handle_offer(self, offer_sdp: str) -> str:
            """Handle WebRTC offer and return answer SDP."""
            try:
                # Create peer connection
                self.pc = RTCPeerConnection()
                
                # Setup connection state handlers
                @self.pc.on("connectionstatechange")
                async def on_connectionstatechange():
                    self.connection_state = self.pc.connectionState
                    logger.info(f"Connection state: {self.connection_state}")
                    if self.on_connection_state_change:
                        self.on_connection_state_change(self.connection_state)
                
                @self.pc.on("iceconnectionstatechange")
                async def on_iceconnectionstatechange():
                    self.ice_connection_state = self.pc.iceConnectionState
                    logger.info(f"ICE connection state: {self.ice_connection_state}")
                
                # Create video track
                self.video_track = ScreenCaptureTrack(fps=30, quality=80)
                self.pc.addTrack(self.video_track)
                
                # Set remote description
                offer = RTCSessionDescription(sdp=offer_sdp, type="offer")
                await self.pc.setRemoteDescription(offer)
                
                # Create answer
                answer = await self.pc.createAnswer()
                await self.pc.setLocalDescription(answer)
                
                # Wait for ICE gathering to complete
                await asyncio.sleep(0.5)
                
                return self.pc.localDescription.sdp
                
            except Exception as e:
                logger.error(f"Error handling offer: {e}", exc_info=True)
                raise
        
        async def handle_ice_candidate(self, candidate: dict):
            """Handle ICE candidate from client."""
            if self.pc:
                try:
                    await self.pc.addIceCandidate(candidate)
                except Exception as e:
                    logger.error(f"Error adding ICE candidate: {e}")
        
        def get_stats(self) -> dict:
            """Get server statistics."""
            stats = {
                "running": self.is_running,
                "connection_state": self.connection_state,
                "ice_connection_state": self.ice_connection_state,
            }
            
            if self.video_track:
                stats["video"] = self.video_track.get_stats()
            
            return stats
else:
    # Dummy class when WebRTC is not available
    class RemoteDesktopServer:
        def __init__(self, *args, **kwargs):
            raise ImportError(
                f"WebRTC dependencies not available: {IMPORT_ERROR}\n"
                f"Please install: pip install aiortc opencv-python mss numpy aiohttp"
            )


# Global instance
_remote_desktop: Optional[RemoteDesktopServer] = None


def get_remote_desktop() -> Optional[RemoteDesktopServer]:
    """Get global remote desktop server instance."""
    return _remote_desktop


def initialize_remote_desktop(on_connection_state_change: Optional[Callable] = None) -> Optional[RemoteDesktopServer]:
    """Initialize global remote desktop server."""
    global _remote_desktop
    if not WEBRTC_AVAILABLE:
        return None
    if _remote_desktop is None:
        try:
            _remote_desktop = RemoteDesktopServer(on_connection_state_change)
        except ImportError:
            return None
    return _remote_desktop


def start_remote_desktop():
    """Start the global remote desktop server."""
    global _remote_desktop
    if _remote_desktop:
        _remote_desktop.start()


def stop_remote_desktop():
    """Stop the global remote desktop server."""
    global _remote_desktop
    if _remote_desktop:
        _remote_desktop.stop()
