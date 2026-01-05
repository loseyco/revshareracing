"""
Telemetry Module
Handles iRacing SDK connection and telemetry streaming
"""

import time
from typing import Dict, Optional, Callable
from threading import Thread, Event


class TelemetryManager:
    """Manages iRacing SDK connection and telemetry data"""
    
    def __init__(self):
        self.is_connected = False
        self.ir = None
        self.current_data = {}
        self._stop_event = Event()
        self._update_thread = None
        self._callbacks = []
        
    def connect(self) -> bool:
        """Connect to iRacing SDK"""
        try:
            import irsdk
            self.ir = irsdk.IRSDK()
            
            if self.ir.startup():
                self.is_connected = True
                self._start_update_thread()
                return True
            return False
        except ImportError:
            print("[INFO] iRacing SDK not available - running in mock mode")
            self.is_connected = False
            return False
        except Exception as e:
            print(f"[WARN] Failed to connect to iRacing: {e}")
            self.is_connected = False
            return False
    
    def disconnect(self):
        """Disconnect from iRacing SDK"""
        self._stop_event.set()
        if self._update_thread:
            self._update_thread.join(timeout=2)
        
        if self.ir:
            self.ir.shutdown()
        
        self.is_connected = False
        self.current_data = {}
    
    def get_current(self) -> Dict:
        """Get current telemetry data"""
        if not self.is_connected:
            return self._get_mock_data()
        return dict(self.current_data)
    
    def _update_loop(self):
        """Background thread to update telemetry data"""
        while not self._stop_event.is_set():
            if self.ir and self.ir.is_initialized:
                # Update connection status
                if not self.is_connected:
                    self.is_connected = True
                    print("[INFO] iRacing SDK connection established")
                try:
                    self.ir.freeze_var_buffer_latest()
                    
                    speed_mps = self.ir['Speed'] if self.ir['Speed'] else 0
                    speed_kph = speed_mps * 3.6 if speed_mps else 0
                    
                    # Extract telemetry data
                    self.current_data = {
                        'speed_kph': speed_kph,
                        'rpm': self.ir['RPM'] if self.ir['RPM'] else 0,
                        'throttle': self.ir['Throttle'] if self.ir['Throttle'] else 0,
                        'brake': self.ir['Brake'] if self.ir['Brake'] else 0,
                        'fuel_level': self.ir['FuelLevel'] if self.ir['FuelLevel'] else 0,
                        'lap': self.ir['Lap'] if self.ir['Lap'] else 0,
                        'lap_completed': self.ir['LapCompleted'] if self.ir['LapCompleted'] else 0,
                        'lap_last_time': self.ir['LapLastLapTime'] if self.ir['LapLastLapTime'] else 0,
                        'lap_current_time': self.ir['LapCurrentLapTime'] if self.ir['LapCurrentLapTime'] else 0,
                        'lap_best_time': self.ir['LapBestLapTime'] if self.ir['LapBestLapTime'] else 0,
                        'session_time': self.ir['SessionTime'] if self.ir['SessionTime'] else 0,
                        'connected': True,
                        'timestamp': time.time(),
                    }
                    
                    # Extract session identifiers
                    try:
                        self.current_data['session_unique_id'] = self.ir['SessionUniqueID'] if self.ir['SessionUniqueID'] else None
                    except Exception:
                        self.current_data['session_unique_id'] = None
                    try:
                        self.current_data['session_num'] = self.ir['SessionNum'] if self.ir['SessionNum'] else None
                    except Exception:
                        self.current_data['session_num'] = None
                    try:
                        self.current_data['session_id'] = self.ir['SessionID'] if self.ir['SessionID'] else None
                    except Exception:
                        self.current_data['session_id'] = None
                    
                    try:
                        self.current_data['is_on_track_car'] = bool(self.ir['IsOnTrackCar'])
                    except Exception:
                        self.current_data['is_on_track_car'] = False
                    try:
                        self.current_data['is_on_track'] = bool(self.ir['IsOnTrack'])
                    except Exception:
                        self.current_data['is_on_track'] = False
                    try:
                        self.current_data['player_in_pit_stall'] = bool(self.ir['PlayerCarInPitStall'])
                    except Exception:
                        self.current_data['player_in_pit_stall'] = False
                    
                    # Extract driver/car/track info
                    try:
                        driver_info = self.ir['DriverInfo']
                        if isinstance(driver_info, dict):
                            drivers = driver_info.get('Drivers', [])
                            if drivers and isinstance(drivers, list):
                                player = drivers[0] if drivers else {}
                                self.current_data.update({
                                    'driver_name': player.get('UserName'),
                                    'driver_id': player.get('UserID'),
                                    'car_name': player.get('CarScreenName'),
                                    'car_class': player.get('CarClassShortName'),
                                    'car_number': player.get('CarNumber'),
                                })
                    except Exception:
                        pass
                    
                    try:
                        weekend_info = self.ir['WeekendInfo']
                        if isinstance(weekend_info, dict):
                            self.current_data.update({
                                'track_name': weekend_info.get('TrackDisplayName'),
                                'track_config': weekend_info.get('TrackConfigName'),
                            })
                    except Exception:
                        pass
                    
                    # Notify callbacks
                    for callback in self._callbacks:
                        try:
                            callback(self.current_data)
                        except Exception as e:
                            print(f"[WARN] Callback error: {e}")
                            
                except Exception as e:
                    print(f"[WARN] Telemetry update error: {e}")
            else:
                # SDK not initialized - connection lost
                if self.is_connected:
                    self.is_connected = False
                    print("[INFO] iRacing SDK connection lost")
                # Try to reconnect
                time.sleep(1)
            
            time.sleep(0.016)  # ~60 Hz
    
    def _start_update_thread(self):
        """Start background update thread"""
        self._stop_event.clear()
        self._update_thread = Thread(target=self._update_loop, daemon=True)
        self._update_thread.start()
    
    def _get_mock_data(self) -> Dict:
        """Get mock telemetry data for testing"""
        return {
            'speed_kph': 0,
            'rpm': 0,
            'throttle': 0,
            'brake': 0,
            'fuel_level': 0,
            'lap': 0,
            'lap_completed': 0,
            'lap_last_time': 0,
            'lap_current_time': 0,
            'lap_best_time': 0,
            'session_time': 0,
            'session_unique_id': None,
            'session_num': None,
            'session_id': None,
            'connected': False,
            'timestamp': time.time(),
        }
    
    def add_callback(self, callback: Callable):
        """Add callback for telemetry updates"""
        self._callbacks.append(callback)


# Singleton instance
_manager = None

def get_manager() -> TelemetryManager:
    """Get or create TelemetryManager instance"""
    global _manager
    if _manager is None:
        _manager = TelemetryManager()
    return _manager

def connect() -> bool:
    """Connect to iRacing SDK"""
    return get_manager().connect()

def get_current() -> Dict:
    """Get current telemetry data"""
    return get_manager().get_current()

def is_connected() -> bool:
    """Check if connected to iRacing"""
    return get_manager().is_connected

def add_callback(callback: Callable):
    """Add telemetry update callback"""
    get_manager().add_callback(callback)

