"""
Simplified GUI for the iRacing Commander PC Service.
All account and rig management is handled via the web portal; this window
focuses on local status, telemetry health, and quick access to the portal.
"""

import tkinter as tk
import webbrowser
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

# Ensure core modules are importable when running as a script.
sys.path.insert(0, str(Path(__file__).parent.parent))

from core import device  # noqa: E402


class GridPassGUI:
    """Minimal control panel for monitoring the local PC service."""

    def __init__(self, root):
        self.root = root
        self.root.title("iRacing Commander - PC Service")
        self.root.geometry("880x640")
        self.root.minsize(760, 520)

        # Basic theme.
        self.colors = {
            'bg': "#101215",
            'panel': "#16191f",
            'panel_alt': "#1d2128",
            'border': "#242833",
            'text': "#f5f7fa",
            'text_muted': "#9aa5b5",
            'accent': "#ff5c7a",
            'accent_hover': "#ff7790",
            'success': "#35d48b",
            'warn': "#ffb703",
            'error': "#ff647c",
        }
        self.fonts = {
            'title': ("Segoe UI", 18, "bold"),
            'subtitle': ("Segoe UI", 13, "bold"),
            'body': ("Segoe UI", 11),
            'small': ("Segoe UI", 9),
            'mono': ("Consolas", 10),
        }

        self.root.configure(bg=self.colors['bg'])

        # Core references.
        self.service = None
        self.supabase_client = None
        self.status_labels = {}
        self.device_info = device.get_info()
        self.portal_url = self.device_info.get('portal_url')
        self._last_claim_state = bool(self.device_info.get('claimed'))

        self._build_layout()
        self._update_device_info_labels(self.device_info)
        self.refresh_status()
        self._schedule_refresh()

    # ------------------------------------------------------------------ #
    # UI construction helpers
    # ------------------------------------------------------------------ #
    def _build_layout(self):
        # Create main container with scrollbar
        # Create canvas and scrollbar
        canvas = tk.Canvas(self.root, bg=self.colors['bg'], highlightthickness=0)
        scrollbar = tk.Scrollbar(self.root, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=self.colors['bg'])
        
        def configure_scroll_region(event=None):
            canvas.configure(scrollregion=canvas.bbox("all"))
        
        scrollable_frame.bind("<Configure>", configure_scroll_region)
        
        canvas_window = canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        
        def configure_canvas_width(event):
            canvas_width = event.width
            canvas.itemconfig(canvas_window, width=canvas_width)
        
        canvas.bind('<Configure>', configure_canvas_width)
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # Pack canvas and scrollbar
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Bind mousewheel to canvas
        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        canvas.bind_all("<MouseWheel>", _on_mousewheel)
        
        # Use scrollable_frame as the main container
        main_container = scrollable_frame
        
        # Header.
        header = tk.Frame(main_container, bg=self.colors['panel'], bd=0)
        header.pack(fill=tk.X, padx=18, pady=(18, 10))

        title = tk.Label(
            header,
            text="iRacing Commander - PC Service",
            font=self.fonts['title'],
            fg=self.colors['text'],
            bg=self.colors['panel'],
        )
        title.pack(side=tk.LEFT)

        self.service_status_label = tk.Label(
            header,
            text="● INITIALIZING",
            font=self.fonts['body'],
            fg=self.colors['warn'],
            bg=self.colors['panel'],
        )
        self.service_status_label.pack(side=tk.RIGHT)

        # Device card.
        device_card = tk.Frame(main_container, bg=self.colors['panel_alt'], bd=1, relief=tk.SOLID)
        device_card.pack(fill=tk.X, padx=18, pady=(0, 12))

        card_header = tk.Frame(device_card, bg=self.colors['panel_alt'])
        card_header.pack(fill=tk.X, padx=18, pady=(18, 6))

        tk.Label(
            card_header,
            text="Rig Details",
            font=self.fonts['subtitle'],
            fg=self.colors['text'],
            bg=self.colors['panel_alt'],
        ).pack(side=tk.LEFT)

        button_row = tk.Frame(device_card, bg=self.colors['panel_alt'])
        button_row.pack(fill=tk.X, padx=18, pady=(0, 12))

        self.portal_button = tk.Button(
            button_row,
            text="Open Device Portal",
            font=self.fonts['body'],
            fg=self.colors['text'],
            bg=self.colors['accent'],
            activebackground=self.colors['accent_hover'],
            activeforeground=self.colors['text'],
            bd=0,
            padx=18,
            pady=8,
            cursor="hand2",
            command=self.open_portal,
        )
        self.portal_button.pack(side=tk.LEFT)
        
        # Update button text based on claim status
        self._update_portal_button_text()

        refresh_button = tk.Button(
            button_row,
            text="Refresh Status",
            font=self.fonts['body'],
            fg=self.colors['text'],
            bg=self.colors['panel'],
            activebackground=self.colors['border'],
            activeforeground=self.colors['text'],
            bd=0,
            padx=16,
            pady=8,
            cursor="hand2",
            command=self.refresh_status,
        )
        refresh_button.pack(side=tk.LEFT, padx=(12, 0))

        self.device_rows = {}
        self._add_device_row(device_card, "Device ID", key="device_id")
        self._add_device_row(device_card, "Device Name", key="device_name")
        self._add_device_row(device_card, "Claim Status", key="claim_status")
        self._add_device_row(device_card, "Claim Code", key="claim_code")
        self._add_device_row(device_card, "Fingerprint", key="fingerprint")
        self._add_device_row(device_card, "Local IP", key="local_ip")
        self._add_device_row(device_card, "Public IP", key="public_ip")
        self._add_device_row(device_card, "Portal URL", key="portal_url", clickable=True)
        
        # Add Registered Keys section
        separator = tk.Frame(device_card, bg=self.colors['border'], height=1)
        separator.pack(fill=tk.X, padx=18, pady=(8, 8))
        
        keys_header = tk.Label(
            device_card,
            text="Registered Keys",
            font=self.fonts['subtitle'],
            fg=self.colors['text'],
            bg=self.colors['panel_alt'],
        )
        keys_header.pack(anchor="w", padx=18, pady=(0, 6))
        
        self.keys_container = tk.Frame(device_card, bg=self.colors['panel_alt'])
        self.keys_container.pack(fill=tk.X, padx=18, pady=(0, 12))
        self.keys_labels = []

        # Status summary.
        status_card = tk.Frame(main_container, bg=self.colors['panel_alt'], bd=1, relief=tk.SOLID)
        status_card.pack(fill=tk.X, padx=18, pady=(0, 12))

        tk.Label(
            status_card,
            text="Live Status",
            font=self.fonts['subtitle'],
            fg=self.colors['text'],
            bg=self.colors['panel_alt'],
        ).pack(anchor="w", padx=18, pady=(18, 10))

        status_grid = tk.Frame(status_card, bg=self.colors['panel_alt'])
        status_grid.pack(fill=tk.X, padx=18, pady=(0, 18))

        self._add_status_row(status_grid, "Database", "database_connection")
        self._add_status_row(status_grid, "Telemetry", "telemetry_connection")
        self._add_status_row(status_grid, "Current Lap", "current_lap")
        self._add_status_row(status_grid, "Total Laps Turned", "laps_total")
        self._add_status_row(status_grid, "Session Laps", "laps_session")
        self._add_status_row(status_grid, "Total Drivers", "total_drivers")
        self._add_status_row(status_grid, "Last Database Sync", "last_sync")
        self._add_status_row(status_grid, "Last Telemetry Update", "last_telemetry")
        self._add_status_row(status_grid, "Claim Status", "claim_state")

        # Logs.
        logs_card = tk.Frame(main_container, bg=self.colors['panel_alt'], bd=1, relief=tk.SOLID)
        logs_card.pack(fill=tk.BOTH, expand=True, padx=18, pady=(0, 18))

        tk.Label(
            logs_card,
            text="Activity Log",
            font=self.fonts['subtitle'],
            fg=self.colors['text'],
            bg=self.colors['panel_alt'],
        ).pack(anchor="w", padx=18, pady=(18, 10))

        self.log_text = tk.Text(
            logs_card,
            wrap=tk.WORD,
            font=self.fonts['mono'],
            bg=self.colors['panel'],
            fg=self.colors['text'],
            height=14,
            bd=0,
            relief=tk.FLAT,
        )
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=18, pady=(0, 18))
        self.log_text.configure(state=tk.DISABLED)

    def _add_device_row(self, parent, label, key, clickable=False):
        row = tk.Frame(parent, bg=self.colors['panel_alt'])
        row.pack(fill=tk.X, padx=18, pady=4)

        tk.Label(
            row,
            text=label,
            font=self.fonts['body'],
            fg=self.colors['text_muted'],
            bg=self.colors['panel_alt'],
            width=18,
            anchor="w",
        ).pack(side=tk.LEFT)

        value_label = tk.Label(
            row,
            text="—",
            font=self.fonts['body'],
            fg=self.colors['text'],
            bg=self.colors['panel_alt'],
            anchor="w",
        )
        value_label.pack(side=tk.LEFT, fill=tk.X, expand=True)

        if clickable:
            value_label.config(fg="#7db2ff", cursor="hand2")
            value_label.bind("<Button-1>", lambda _e: self.open_portal())

        self.device_rows[key] = value_label

    def _update_drivers_count(self):
        """Fetch and update total drivers count from database"""
        if not self.supabase_client:
            self._set_status_value("total_drivers", "—")
            return
        
        try:
            # Use count='exact' to get the count without fetching all data
            result = self.supabase_client.table('irc_user_profiles')\
                .select('id', count='exact', head=True)\
                .execute()
            
            count = 0
            # Try different ways to get the count
            if hasattr(result, 'count') and result.count is not None:
                count = result.count
            elif hasattr(result, 'data') and result.data is not None:
                # If count not available, try to get length of data
                count = len(result.data) if isinstance(result.data, list) else 0
            elif isinstance(result, dict):
                count = result.get('count', 0)
            
            self._set_status_value("total_drivers", str(count) if count > 0 else "0")
        except Exception as e:
            # Log error for debugging but don't show to user
            print(f"[DEBUG] Failed to fetch drivers count: {e}")
            self._set_status_value("total_drivers", "—")

    def _update_registered_keys(self):
        """Update the registered keys display"""
        if not hasattr(self, "keys_container"):
            return
        
        # Clear existing keys
        for widget in self.keys_container.winfo_children():
            widget.destroy()
        self.keys_labels = []
        
        if not self.service:
            no_keys = tk.Label(
                self.keys_container,
                text="Service not available",
                font=self.fonts['small'],
                fg=self.colors['text_muted'],
                bg=self.colors['panel_alt'],
                anchor="w",
            )
            no_keys.pack(fill=tk.X, pady=2)
            return
        
        try:
            bindings = self.service.get_controls_mapping() or {}
        except Exception:
            bindings = {}
        
        if not bindings:
            no_keys = tk.Label(
                self.keys_container,
                text="No controls loaded",
                font=self.fonts['small'],
                fg=self.colors['text_muted'],
                bg=self.colors['panel_alt'],
                anchor="w",
            )
            no_keys.pack(fill=tk.X, pady=2)
            return
        
        # Show registered keys (only those with combos)
        registered_keys = []
        for action, info in sorted(bindings.items(), key=lambda item: item[1].get("label", "")):
            combo = info.get("combo")
            if combo:
                label_text = info.get("label", action)
                source = info.get("source", "")
                display_text = f"{label_text}: {combo}"
                if source:
                    display_text += f" ({source})"
                registered_keys.append(display_text)
        
        if not registered_keys:
            no_keys = tk.Label(
                self.keys_container,
                text="No keys mapped",
                font=self.fonts['small'],
                fg=self.colors['text_muted'],
                bg=self.colors['panel_alt'],
                anchor="w",
            )
            no_keys.pack(fill=tk.X, pady=2)
            return
        
        # Display keys (max 5 visible)
        for key_text in registered_keys[:5]:
            key_label = tk.Label(
                self.keys_container,
                text=key_text,
                font=self.fonts['small'],
                fg=self.colors['text'],
                bg=self.colors['panel_alt'],
                anchor="w",
            )
            key_label.pack(fill=tk.X, pady=2)
            self.keys_labels.append(key_label)
        
        if len(registered_keys) > 5:
            more_label = tk.Label(
                self.keys_container,
                text=f"+ {len(registered_keys) - 5} more...",
                font=self.fonts['small'],
                fg=self.colors['text_muted'],
                bg=self.colors['panel_alt'],
                anchor="w",
            )
            more_label.pack(fill=tk.X, pady=2)

    def _add_status_row(self, parent, label, key):
        row = tk.Frame(parent, bg=self.colors['panel_alt'])
        row.pack(fill=tk.X, pady=3)

        tk.Label(
            row,
            text=label,
            font=self.fonts['body'],
            fg=self.colors['text_muted'],
            bg=self.colors['panel_alt'],
            width=24,
            anchor="w",
        ).pack(side=tk.LEFT)

        value_label = tk.Label(
            row,
            text="—",
            font=self.fonts['body'],
            fg=self.colors['text'],
            bg=self.colors['panel_alt'],
            anchor="w",
        )
        value_label.pack(side=tk.LEFT, fill=tk.X, expand=True)

        self.status_labels[key] = value_label

    # ------------------------------------------------------------------ #
    # Public API used by the service
    # ------------------------------------------------------------------ #
    def set_service(self, service):
        """Attach the running service instance for status updates."""
        self.service = service
        if service:
            service.on_lap_recorded = self.on_lap_recorded
            if hasattr(service, 'on_command_received'):
                service.on_command_received = self._on_command_notification
        self.refresh_status()
    
    def _on_command_notification(self, command_info: dict):
        """Handle command notification from service"""
        action = command_info.get('action', 'unknown')
        source = command_info.get('source', 'queue')
        success = command_info.get('success')
        message = command_info.get('message', '')
        key_message = command_info.get('key_message', '')
        
        if success is None:
            # Command received
            if key_message:
                self.log(f"[QUEUE] Command received: {action} - {key_message} (from {source})")
            else:
                self.log(f"[QUEUE] Command received: {action} (from {source})")
        else:
            # Command executed
            if success:
                if key_message:
                    self.log(f"[QUEUE] Command executed: {action} - {key_message}")
                else:
                    self.log(f"[QUEUE] Command executed: {action} - {message}")
            else:
                if key_message:
                    self.log(f"[QUEUE] Command failed: {action} - {key_message} - {message}")
                else:
                    self.log(f"[QUEUE] Command failed: {action} - {message}")

    def set_supabase(self, supabase_client):
        """Store Supabase client for downstream use (reserved for future)."""
        self.supabase_client = supabase_client

    def set_portal_url(self, url: str):
        """Allow callers to override the portal URL when it becomes available."""
        if not url:
            return
        self.portal_url = url
        self.device_info['portal_url'] = url
        self._update_device_info_labels(self.device_info)

    def set_service_running(self):
        """Update status banner and seed initial log entries."""
        self.service_status_label.config(text="● RUNNING", fg=self.colors['success'])
        self.log("[OK] PC Service is running")
        self.log("[OK] Lap collection is active")
        if self.portal_url:
            self.log(f"[*] Manage this rig from the portal: {self.portal_url}")
        if not self.device_info.get('claimed') and self.device_info.get('claim_code'):
            self.log(f"[ACTION] Claim this rig in the portal using code: {self.device_info['claim_code']}")
        self.log("[*] This app only handles local telemetry and queued commands")

    def log(self, message):
        """Append message to log window and stdout."""
        print(message)
        if not hasattr(self, "log_text") or self.log_text is None:
            return
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    # ------------------------------------------------------------------ #
    # Status updates
    # ------------------------------------------------------------------ #
    def refresh_status(self):
        """Fetch latest service status and refresh widgets."""
        self._update_device_info_labels(device.get_info())

        if not self.service:
            return

        try:
            status = self.service.get_status()
        except Exception as exc:  # pragma: no cover - defensive
            self.log(f"[WARN] Unable to refresh status: {exc}")
            return

        supabase_info = status.get('supabase', {}) or {}
        iracing_info = status.get('iracing', {}) or {}

        # Update device info from service status, if provided.
        merged_info = dict(self.device_info)
        merged_info.update({
            'device_id': supabase_info.get('device_id') or merged_info.get('device_id'),
            'device_name': supabase_info.get('device_name') or merged_info.get('device_name'),
            'location': supabase_info.get('location') or merged_info.get('location'),
            'portal_url': supabase_info.get('portal_url') or merged_info.get('portal_url'),
            'local_ip': supabase_info.get('local_ip') or merged_info.get('local_ip'),
            'public_ip': supabase_info.get('public_ip') or merged_info.get('public_ip'),
            'claimed': supabase_info.get('claimed', merged_info.get('claimed')),
            'claim_code': supabase_info.get('claim_code', merged_info.get('claim_code')),
            'fingerprint': supabase_info.get('fingerprint', merged_info.get('fingerprint')),
        })
        self.device_info = merged_info
        self.portal_url = merged_info.get('portal_url')
        self._update_device_info_labels(merged_info)

        # Database connection.
        database_connected = bool(supabase_info.get('connected'))
        self._set_status_value(
            "database_connection",
            "Connected" if database_connected else "Disconnected",
            self.colors['success'] if database_connected else self.colors['error'],
        )
        
        # Fetch total drivers count (cache it, refresh every 30 seconds)
        if not hasattr(self, '_last_drivers_check') or (time.time() - getattr(self, '_last_drivers_check', 0)) > 30:
            self._update_drivers_count()
            self._last_drivers_check = time.time()

        # Telemetry connection.
        telemetry_connected = bool(iracing_info.get('connected'))
        self._set_status_value(
            "telemetry_connection",
            "Connected" if telemetry_connected else "Disconnected",
            self.colors['success'] if telemetry_connected else self.colors['error'],
        )

        # Laps data.
        self._set_status_value("current_lap", str(iracing_info.get('current_lap', 0)))
        self._set_status_value("laps_session", str(supabase_info.get('laps_session', 0)))
        self._set_status_value("laps_total", str(supabase_info.get('laps_total', 0)))

        last_sync = supabase_info.get('last_sync')
        self._set_status_value("last_sync", self._format_timestamp(last_sync))

        last_update = iracing_info.get('last_update')
        self._set_status_value("last_telemetry", self._format_timestamp(last_update))

        claimed = bool(merged_info.get('claimed'))
        claim_text = "Claimed" if claimed else "Awaiting Claim"
        claim_color = self.colors['success'] if claimed else self.colors['warn']
        self._set_status_value("claim_state", claim_text, claim_color)

        if claimed != self._last_claim_state:
            if claimed:
                self.log("[OK] Rig successfully claimed. Remote controls enabled.")
            else:
                self.log("[WARN] Rig returned to unclaimed state.")
            self._last_claim_state = claimed

    def on_lap_recorded(self, lap_number, lap_time, lap_data):
        """Callback invoked by the service when a lap is recorded."""
        self.log(f"[laps] Lap {lap_number} recorded at {lap_time:.3f}s")
        self.refresh_status()

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def open_portal(self):
        """Open the device portal in the default browser."""
        device_id = self.device_info.get("device_id")
        claimed = bool(self.device_info.get("claimed"))
        claim_code = self.device_info.get("claim_code")
        
        if not device_id:
            self.log("[WARN] Device ID unavailable. Please wait for device sync.")
            return

        # Use the new device-specific claim URL format
        from core.device import DEVICE_PORTAL_BASE_URL
        final_url = f"{DEVICE_PORTAL_BASE_URL}/{device_id}"
        
        # Add claim code to URL if available and device is unclaimed
        if not claimed and claim_code:
            final_url = f"{final_url}?claimCode={claim_code}"

        self.log(f"[*] Opening portal: {final_url}")
        webbrowser.open(final_url)

    def _update_portal_button_text(self):
        """Update the portal button text based on claim status."""
        if not self.portal_button:
            return
        claimed = bool(self.device_info.get('claimed'))
        if claimed:
            self.portal_button.config(text="Open Device Portal")
        else:
            self.portal_button.config(text="Claim This Rig")

    def _update_device_info_labels(self, info):
        for key, label in self.device_rows.items():
            if key == "claim_status":
                claimed = bool(info.get('claimed'))
                text = "Claimed" if claimed else "Awaiting Claim"
                color = self.colors['success'] if claimed else self.colors['warn']
                label.config(text=text, fg=color)
            elif key == "claim_code":
                claimed = bool(info.get('claimed'))
                code = info.get('claim_code')
                display = code if (code and not claimed) else ("—" if claimed else "Unavailable")
                color = self.colors['text'] if code and not claimed else self.colors['text_muted']
                label.config(text=display, fg=color)
            elif key == "fingerprint":
                fingerprint = info.get('fingerprint')
                if fingerprint:
                    display = fingerprint[:12] + "…" if len(fingerprint) > 12 else fingerprint
                    label.config(text=display, fg=self.colors['text_muted'])
                else:
                    label.config(text="—", fg=self.colors['text_muted'])
            elif key == "portal_url":
                value = info.get(key)
                label.config(text=value or "—")
            else:
                value = info.get(key)
                label.config(text=value or "—", fg=self.colors['text'])

        # Enable or disable portal button based on URL availability.
        portal_available = bool(info.get('portal_url') or info.get('device_id'))
        state = tk.NORMAL if portal_available else tk.DISABLED
        self.portal_button.config(state=state)
        self._update_portal_button_text()

    def _set_status_value(self, key, text, color=None):
        label = self.status_labels.get(key)
        if not label:
            return
        label.config(text=text)
        if color:
            label.config(fg=color)
        else:
            label.config(fg=self.colors['text'])

    def _format_timestamp(self, value):
        if not value:
            return "—"
        try:
            # Handle datetime strings or Unix timestamps.
            if isinstance(value, (int, float)):
                dt = datetime.fromtimestamp(value)
            elif isinstance(value, str):
                # Attempt ISO format parse.
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            else:
                return "—"
            delta = time.time() - dt.timestamp()
            if delta < 0:
                return dt.strftime("%Y-%m-%d %H:%M:%S")
            if delta < 60:
                return "moments ago"
            if delta < 3600:
                minutes = int(delta / 60)
                return f"{minutes} min ago"
            if delta < 86400:
                hours = int(delta / 3600)
                return f"{hours} hr ago"
            return dt.strftime("%Y-%m-%d %H:%M")
        except Exception:
            return "—"

    def _schedule_refresh(self):
        self.root.after(4000, self._periodic_refresh)

    def _periodic_refresh(self):
        self.refresh_status()
        # Also check for controls changes (every ~5 seconds)
        self._check_controls_changes()
        self._schedule_refresh()
    
    def _check_controls_changes(self):
        """Check if controls files have changed and update display if needed"""
        if not self.service:
            return
        
        try:
            controls_manager = getattr(self.service, "controls_manager", None)
            if not controls_manager:
                return
            
            # Try to load bindings without force - it will check file mtime internally
            controls_manager.load_bindings(force=False)
            
            # Update the display
            self._update_registered_keys()
        except Exception:
            # Silently fail for periodic checks
            pass


def create_gui():
    """Factory used by the service entrypoint."""
    root = tk.Tk()
    app = GridPassGUI(root)
    return root, app


