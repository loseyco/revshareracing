"""
iRacing Telemetry Module
"""

import time
from typing import Dict, Callable, List, Optional
from threading import Thread, Event


class TelemetryManager:
    """Manages iRacing SDK connection and telemetry."""
    
    def __init__(self):
        self.is_connected = False
        self.ir = None
        self.data: Dict = {}
        self._stop = Event()
        self._thread: Optional[Thread] = None
        self._callbacks: List[Callable] = []
    
    def connect(self) -> bool:
        """Connect to iRacing SDK."""
        try:
            import irsdk
            self.ir = irsdk.IRSDK()
            if self.ir.startup():
                self.is_connected = True
                self._start_thread()
                return True
            return False
        except ImportError:
            print("[INFO] iRacing SDK not available")
            return False
        except Exception as e:
            print(f"[WARN] iRacing connection failed: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from iRacing."""
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        if self.ir:
            self.ir.shutdown()
        self.is_connected = False
        self.data = {}
    
    def get_current(self) -> Dict:
        """Get current telemetry data."""
        return dict(self.data) if self.data else self._empty_data()
    
    def add_callback(self, callback: Callable):
        """Add telemetry update callback."""
        self._callbacks.append(callback)
    
    def _start_thread(self):
        self._stop.clear()
        self._thread = Thread(target=self._update_loop, daemon=True)
        self._thread.start()
    
    def _update_loop(self):
        while not self._stop.is_set():
            if self.ir and self.ir.is_initialized:
                if not self.is_connected:
                    self.is_connected = True
                    print("[OK] iRacing connected")
                
                try:
                    self.ir.freeze_var_buffer_latest()
                    self._update_data()
                    self._notify_callbacks()
                except Exception as e:
                    print(f"[WARN] Telemetry error: {e}")
            else:
                if self.is_connected:
                    self.is_connected = False
                    print("[INFO] iRacing disconnected")
                time.sleep(1)
            
            time.sleep(0.016)  # ~60Hz
    
    def _update_data(self):
        ir = self.ir
        speed = ir['Speed'] or 0
        
        # Helper to safely get telemetry values
        def safe_get(key, default=None):
            try:
                return ir[key]
            except (KeyError, TypeError):
                return default
        
        self.data = {
            'connected': True,
            'timestamp': time.time(),
            'speed_kph': speed * 3.6,
            'rpm': ir['RPM'] or 0,
            'throttle': ir['Throttle'] or 0,
            'brake': ir['Brake'] or 0,
            'fuel_level': ir['FuelLevel'] or 0,
            'lap': ir['Lap'] or 0,
            'lap_last_time': ir['LapLastLapTime'] or 0,
            'lap_current_time': ir['LapCurrentLapTime'] or 0,
            'lap_best_time': ir['LapBestLapTime'] or 0,
            'session_time': ir['SessionTime'] or 0,
            'session_unique_id': ir['SessionUniqueID'],
            'is_on_track': bool(ir['IsOnTrack']),
            'is_on_track_car': bool(ir['IsOnTrackCar']),
            'on_pit_road': bool(safe_get('OnPitRoad', False)),
            'in_garage': bool(safe_get('InGarage', False)),
        }
        
        # Driver/Car/Track info
        try:
            driver_info = ir['DriverInfo']
            if isinstance(driver_info, dict):
                drivers = driver_info.get('Drivers', [])
                if drivers:
                    player = drivers[0]
                    self.data.update({
                        'driver_name': player.get('UserName'),
                        'driver_id': player.get('UserID'),
                        'car_name': player.get('CarScreenName'),
                    })
        except Exception:
            pass
        
        try:
            weekend = ir['WeekendInfo']
            if isinstance(weekend, dict):
                self.data['track_name'] = weekend.get('TrackDisplayName')
        except Exception:
            pass
    
    def _notify_callbacks(self):
        for cb in self._callbacks:
            try:
                cb(self.data)
            except Exception as e:
                print(f"[WARN] Callback error: {e}")
    
    def _empty_data(self) -> Dict:
        return {
            'connected': False,
            'timestamp': time.time(),
            'speed_kph': 0, 'rpm': 0, 'throttle': 0, 'brake': 0,
            'fuel_level': 0, 'lap': 0, 'lap_last_time': 0,
            'lap_current_time': 0, 'lap_best_time': 0, 'session_time': 0,
            'is_on_track': False,
            'is_on_track_car': False,
            'on_pit_road': False,
            'in_garage': False,
        }


# Singleton
_manager: Optional[TelemetryManager] = None

def get_manager() -> TelemetryManager:
    global _manager
    if _manager is None:
        _manager = TelemetryManager()
    return _manager

def connect() -> bool:
    return get_manager().connect()

def get_current() -> Dict:
    return get_manager().get_current()

def is_connected() -> bool:
    return get_manager().is_connected

def add_callback(callback: Callable):
    get_manager().add_callback(callback)


