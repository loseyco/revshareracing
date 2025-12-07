"""
Device Management Module
Generates a deterministic device fingerprint, manages local metadata, and
coordinates with Supabase for claim workflows.
"""

import hashlib
import os
import platform
import random
import socket
import string
import subprocess
import uuid
from pathlib import Path
from typing import Dict, Optional

import requests


def _resolve_portal_base_url() -> str:
    explicit = os.getenv("GRIDPASS_PORTAL_BASE_URL")
    if explicit:
        return explicit.rstrip("/")
    
    environment = os.getenv("GRIDPASS_ENV", "development").lower()
    if environment in {"prod", "production"}:
        return "https://revshareracing.com/device"
    
    return "http://localhost:3000/device"


DEVICE_PORTAL_BASE_URL = _resolve_portal_base_url()


class DeviceManager:
    """Manages device information, fingerprinting, and Supabase syncing."""
    
    def __init__(self):
        data_dir = Path(__file__).parent.parent.parent / 'data'
        data_dir.mkdir(exist_ok=True)
        self.device_config_file = data_dir / 'device_config.json'
        self.supabase_client = None
        self._device_data: Optional[Dict] = None
        self._ensure_device_config()
    
    def set_supabase(self, client):
        """Set Supabase client (used for downstream modules)."""
        self.supabase_client = client
    
    def is_registered(self) -> bool:
        """Return True when the rig has been claimed/owned."""
        config = self._ensure_device_config()
        return bool(config.get('claimed'))
    
    def get_info(self, user_id: str = None) -> Dict:  # pylint: disable=unused-argument
        """Return the current device information."""
        config = self._ensure_device_config()
        info = dict(config)
        info.update({
            'local_ip': self.get_local_ip(),
            'public_ip': self.get_public_ip(),
            'portal_url': self._build_portal_url(config['device_id']),
            'status': self._derive_status(config),
        })
        info['registered'] = bool(info.get('claimed'))
        return info
    
    def register_device(
        self,
        user_id: str,
        device_name: str,
        location: str = None,
        company_id: str = None
    ) -> Dict:  # pylint: disable=unused-argument
        """
        Registration is now managed on the website.
        Return guidance while still surfacing the current device metadata.
        """
        config = self._ensure_device_config()
        return {
            'success': False,
            'error': 'Rig registration now happens on the web portal. '
                     f'Visit {self._build_portal_url(config["device_id"])} to continue.',
            'device': config,
        }
    
    def update_device(
        self,
        device_id: str,
        device_name: str = None,
        location: str = None
    ) -> Dict:
        """
        Device metadata updates are handled on the website. Persist local
        overrides so the UI can display friendly values when the service runs
        offline.
        """
        config = self._ensure_device_config()
        if not device_id or device_id != config.get('device_id'):
            return {'success': False, 'error': 'Unknown device. Visit the web portal to manage this rig.'}
        
        updated = False
        if device_name is not None and device_name != config.get('device_name'):
            config['device_name'] = device_name
            updated = True
        if location is not None and location != config.get('location'):
            config['location'] = location
            updated = True
        
        if updated:
            self._save_device_config(config)
            return {
                'success': True,
                'message': 'Local device info updated. Complete any account changes on the web portal.',
                'device': config,
            }
        
        return {
            'success': False,
            'error': 'No changes detected. Manage registration details on the web portal.',
            'device': config,
        }
    
    # ------------------------------------------------------------------ #
    # Supabase coordination
    # ------------------------------------------------------------------ #
    def sync_with_supabase(self, client) -> Optional[Dict]:
        """
        Ensure the remote device record matches this machine's fingerprint.
        Returns the Supabase record when available.
        """
        if client is None:
            return None
        
        config = self._ensure_device_config()
        fingerprint = config['fingerprint']
        device_id = config['device_id']
        claim_code = config.get('claim_code')
        
        record = None
        try:
            # Prefer matching via fingerprint
            result = client.table('irc_devices')\
                .select('*')\
                .eq('hardware_fingerprint', fingerprint)\
                .limit(1)\
                .execute()
            record = self._first_row(result)
            
            if record is None and device_id:
                result = client.table('irc_devices')\
                    .select('*')\
                    .eq('device_id', device_id)\
                    .limit(1)\
                    .execute()
                record = self._first_row(result)
        except Exception as exc:
            print(f"[WARN] Supabase device lookup failed: {exc}")
            record = None
        
        if record:
            updates: Dict[str, Optional[str]] = {}
            if not record.get('hardware_fingerprint'):
                updates['hardware_fingerprint'] = fingerprint
            if not record.get('claim_code') and claim_code:
                updates['claim_code'] = claim_code
            if record.get('device_id') != device_id:
                # Align local config with existing record to keep lap history.
                config['device_id'] = record['device_id']
            
            if updates:
                try:
                    client.table('irc_devices')\
                        .update(updates)\
                        .eq('device_id', record['device_id'])\
                        .execute()
                    record.update(updates)
                except Exception as exc:
                    print(f"[WARN] Failed to update Supabase device metadata: {exc}")
            
            self.apply_remote_metadata(record)
            return record
        
        # No record exists yet. Create a new unclaimed rig placeholder.
        claim_code = claim_code or self._generate_claim_code()
        config['claim_code'] = claim_code
        
        payload = {
            'device_id': device_id,
            'device_name': config.get('device_name') or socket.gethostname(),
            'hardware_fingerprint': fingerprint,
            'claim_code': claim_code,
            'status': 'unclaimed',
            'owner_user_id': None,
            'location': config.get('location'),
            'company_id': config.get('company_id'),
            'local_ip': config.get('local_ip') or self.get_local_ip(),
            'public_ip': config.get('public_ip') or self.get_public_ip(),
        }
        
        try:
            result = client.table('irc_devices').insert(payload).execute()
            created = self._first_row(result) or payload
            self.apply_remote_metadata(created)
            return created
        except Exception as exc:
            print(f"[WARN] Failed to create Supabase device record: {exc}")
            # Even if Supabase insert fails, persist local config so we retain the claim code.
            self._save_device_config(config)
            return None
    
    def apply_remote_metadata(self, record: Dict):
        """Persist fields returned from Supabase to the local config."""
        if not record:
            return
        
        config = self._ensure_device_config()
        changed = False
        
        mapping = {
            'device_id': 'device_id',
            'device_name': 'device_name',
            'location': 'location',
            'company_id': 'company_id',
            'owner_user_id': 'owner_user_id',
            'status': 'status',
            'claim_code': 'claim_code',
            'hardware_fingerprint': 'fingerprint',
            'registered_at': 'created_at',
        }
        
        nullable_fields = {'claim_code', 'owner_user_id', 'company_id', 'location', 'status'}
        
        for config_key, record_key in mapping.items():
            if record_key not in record:
                continue
            value = record.get(record_key)
            if config_key == 'hardware_fingerprint':
                config_key = 'fingerprint'
            if config_key in nullable_fields:
                if config.get(config_key) != value:
                    config[config_key] = value
                    changed = True
            else:
                if config.get(config_key) != value and value is not None:
                    config[config_key] = value
                    changed = True
                config[config_key] = value
                changed = True
        
        claimed = bool(record.get('owner_user_id'))
        if config.get('claimed') != claimed:
            config['claimed'] = claimed
            changed = True
        
        if changed:
            self._save_device_config(config)
        else:
            # Ensure derived fields are still consistent.
            self._ensure_device_config()
    
    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _ensure_device_config(self) -> Dict:
        """Ensure a device configuration exists with identifiers and codes."""
        config = self._load_device_config()
        if config is None:
            config = {}
        
        updated = False
        
        if not config.get('device_id'):
            config['device_id'] = f"rig-{uuid.uuid4().hex[:12]}"
            updated = True
        if not config.get('device_name'):
            config['device_name'] = socket.gethostname()
            updated = True
        if not config.get('fingerprint'):
            config['fingerprint'] = self._generate_fingerprint()
            updated = True
        if not config.get('claim_code'):
            config['claim_code'] = self._generate_claim_code()
            updated = True
        if 'claimed' not in config:
            config['claimed'] = False
            updated = True
        if 'owner_user_id' not in config:
            config['owner_user_id'] = None
            updated = True
        if 'status' not in config or not config.get('status'):
            config['status'] = 'unclaimed'
            updated = True
        if 'location' not in config:
            config['location'] = None
            updated = True
        if 'company_id' not in config:
            config['company_id'] = None
            updated = True
        
        config['portal_url'] = self._build_portal_url(config['device_id'])
        
        if updated:
            self._save_device_config(config)
        return config
    
    def _build_portal_url(self, device_id: str) -> str:
        """Return the portal URL for the given device."""
        return f"{DEVICE_PORTAL_BASE_URL}/{device_id}"
    
    def _save_device_config(self, config: Dict):
        """Persist device configuration to disk."""
        import json
        normalized = dict(config)
        normalized['portal_url'] = self._build_portal_url(normalized['device_id'])
        self.device_config_file.parent.mkdir(parents=True, exist_ok=True)
        self.device_config_file.write_text(json.dumps(normalized, indent=2))
        self._device_data = normalized
    
    def _load_device_config(self) -> Optional[Dict]:
        """Load device configuration from disk."""
        if self._device_data:
            return self._device_data
        
        if not self.device_config_file.exists():
            return None
        
        try:
            import json
            self._device_data = json.loads(self.device_config_file.read_text())
            return self._device_data
        except Exception as exc:
            print(f"Failed to load device config: {exc}")
            return None
    
    def _generate_fingerprint(self) -> str:
        """Create a deterministic fingerprint using hardware identifiers."""
        components = [
            platform.node(),
            platform.system(),
            platform.release(),
            platform.version(),
            platform.machine(),
            str(uuid.getnode()),
        ]
        
        system_uuid = self._get_system_uuid()
        if system_uuid:
            components.append(system_uuid)
        
        data = "|".join(str(part) for part in components if part)
        return hashlib.sha256(data.encode("utf-8")).hexdigest()
    
    def _generate_claim_code(self, length: int = 6) -> str:
        alphabet = string.ascii_uppercase + string.digits
        return "".join(random.choice(alphabet) for _ in range(length))
    
    def _get_system_uuid(self) -> Optional[str]:
        """Best-effort lookup of the system UUID on Windows."""
        try:
            output = subprocess.check_output(
                ["wmic", "csproduct", "get", "uuid"],
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=2,
            )
            lines = [line.strip() for line in output.splitlines() if line.strip()]
            if len(lines) >= 2:
                return lines[1]
        except Exception:
            pass
        return None
    
    def _first_row(self, response) -> Optional[Dict]:
        """Extract the first row from a Supabase response."""
        if not response:
            return None
        data = getattr(response, "data", None)
        if isinstance(data, list) and data:
            return data[0]
        if isinstance(data, dict) and data:
            return data
        return None
    
    def _derive_status(self, config: Dict) -> str:
        if config.get('claimed'):
            return 'claimed'
        return config.get('status') or 'unclaimed'
    
    def get_local_ip(self) -> str:
        """Return the current local IP address."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.connect(("8.8.8.8", 80))
            local_ip = sock.getsockname()[0]
            sock.close()
            return local_ip
        except Exception:
            return "127.0.0.1"
    
    def get_public_ip(self) -> str:
        """Return the current public IP address (best effort)."""
        try:
            response = requests.get('https://api.ipify.org?format=json', timeout=2)
            return response.json()['ip']
        except Exception:
            return "Unknown"


# Singleton instance
_manager = None

def get_manager() -> DeviceManager:
    """Get or create DeviceManager instance"""
    global _manager
    if _manager is None:
        _manager = DeviceManager()
    return _manager

def get_info(user_id: str = None) -> Dict:
    """Get device information"""
    return get_manager().get_info(user_id)

def set_supabase(client):
    """Set Supabase client"""
    get_manager().set_supabase(client)

def update_device(device_id: str, device_name: str = None, location: str = None) -> Dict:
    """Update device information"""
    return get_manager().update_device(device_id, device_name, location)

