"""
Lap Recording Module
Handles lap detection, recording, and storage
"""

import uuid
from typing import Dict, List, Optional
from datetime import datetime


class LapManager:
    """Manages lap recording and retrieval"""
    
    def __init__(self):
        self.current_lap = 0
        self.supabase_client = None
        
    def set_supabase(self, client):
        """Set Supabase client for data storage"""
        self.supabase_client = client
    
    def get_last_lap_number(self, device_id: str) -> Optional[int]:
        """Get the last recorded lap number for a device"""
        if not self.supabase_client or not device_id:
            return None
        
        try:
            result = self.supabase_client.table('irc_laps')\
                .select('lap_number')\
                .eq('device_id', device_id)\
                .order('timestamp', desc=True)\
                .limit(1)\
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0].get('lap_number')
            return None
        except Exception as e:
            print(f"[WARN] Failed to get last lap number: {e}")
            return None
    
    def lap_exists(self, device_id: str, lap_number: int, lap_time: float) -> bool:
        """Check if a lap with the same device_id, lap_number, and lap_time already exists"""
        if not self.supabase_client or not device_id:
            return False
        
        try:
            # Check for exact match on device_id, lap_number, and lap_time
            # Use a small tolerance for lap_time comparison (0.001s) to handle floating point differences
            result = self.supabase_client.table('irc_laps')\
                .select('lap_id')\
                .eq('device_id', device_id)\
                .eq('lap_number', lap_number)\
                .gte('lap_time', lap_time - 0.001)\
                .lte('lap_time', lap_time + 0.001)\
                .limit(1)\
                .execute()
            
            return result.data and len(result.data) > 0
        except Exception as e:
            print(f"[WARN] Failed to check if lap exists: {e}")
            return False
    
    def record_lap(
        self,
        lap_time: float,
        driver_id: Optional[str],
        device_id: str,
        track_id: str = None,
        car_id: str = None,
        telemetry: Dict = None,
        lap_number: int = None
    ) -> Dict:
        """Record a completed lap"""
        lap_id = str(uuid.uuid4())
        
        # Validate driver_id - must be a UUID or None
        # iRacing driver IDs are numeric, not UUIDs, so we set to None
        validated_driver_id = None
        if driver_id:
            try:
                # Try to parse as UUID to validate
                uuid.UUID(str(driver_id))
                validated_driver_id = driver_id
            except (ValueError, AttributeError):
                # Not a valid UUID (likely iRacing numeric ID), set to None
                validated_driver_id = None
        
        lap_data = {
            'lap_id': lap_id,
            'device_id': device_id,
            'driver_id': validated_driver_id,  # NULL if not a UUID
            'lap_time': lap_time,
            'lap_number': lap_number if lap_number is not None else self.current_lap,
            'track_id': track_id,
            'car_id': car_id,
            'timestamp': datetime.utcnow().isoformat() + 'Z',  # Explicit UTC marker
            'telemetry': telemetry or {},
        }
        
        # Store to Supabase if available
        if self.supabase_client:
            try:
                # Check if this lap already exists to prevent duplicates
                if self.lap_exists(device_id, lap_number if lap_number is not None else self.current_lap, lap_time):
                    print(f"[INFO] Lap {lap_number} at {lap_time:.3f}s already exists in database - skipping")
                    return {'success': True, 'lap_id': None, 'data': None, 'skipped': True}
                
                result = self.supabase_client.table('irc_laps').insert(lap_data).execute()
                if result.data:
                    print(f"[OK] Lap {lap_number} stored to Supabase: {lap_time:.3f}s at {track_id or 'Unknown Track'}")
                    return {'success': True, 'lap_id': lap_id, 'data': result.data[0]}
                else:
                    print(f"[WARN] Lap inserted but no data returned")
                    return {'success': False, 'error': 'No data returned'}
            except Exception as e:
                print(f"[ERROR] Failed to store lap to Supabase: {e}")
                import traceback
                traceback.print_exc()
                return {'success': False, 'error': str(e)}
        else:
            print(f"[WARN] Supabase client not set - lap not stored")
            return {'success': False, 'error': 'Supabase client not configured'}


# Singleton instance
_manager = None

def get_manager() -> LapManager:
    """Get or create LapManager instance"""
    global _manager
    if _manager is None:
        _manager = LapManager()
    return _manager

def record_lap(
    lap_time: float,
    driver_id: Optional[str],
    device_id: str,
    track_id: str = None,
    car_id: str = None,
    telemetry: Dict = None,
    lap_number: int = None
) -> Dict:
    """Record a lap"""
    return get_manager().record_lap(lap_time, driver_id, device_id, track_id, car_id, telemetry, lap_number)

def set_supabase(client):
    """Set Supabase client"""
    get_manager().set_supabase(client)

def get_last_lap_number(device_id: str) -> Optional[int]:
    """Get the last recorded lap number for a device"""
    return get_manager().get_last_lap_number(device_id)

def lap_exists(device_id: str, lap_number: int, lap_time: float) -> bool:
    """Check if a lap already exists"""
    return get_manager().lap_exists(device_id, lap_number, lap_time)

