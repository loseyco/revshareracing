"""
iRCommander - PyQt6 GUI
Simple, clean interface for monitoring and control.
"""

import sys
from typing import Optional
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QFrame, QGroupBox, QGridLayout,
    QDialog, QLineEdit, QFormLayout, QMessageBox, QCheckBox
)
import ctypes
from ctypes import wintypes
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QFont, QPalette, QColor

from service import IRCommanderService, get_service
from supabase_client import SupabaseError
from config import VERSION
from core import joystick_config, joystick_monitor


class LoginDialog(QDialog):
    """Login dialog for iRCommander authentication."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Login to iRCommander")
        self.setFixedSize(400, 280)
        self.setStyleSheet("""
            QDialog { background-color: #1f2937; }
            QLabel { color: #f3f4f6; }
            QLineEdit {
                background-color: #374151;
                border: 1px solid #4b5563;
                border-radius: 4px;
                padding: 8px;
                color: #f3f4f6;
            }
            QLineEdit:focus { border-color: #3b82f6; }
            QPushButton {
                background-color: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 10px 20px;
                font-weight: bold;
            }
            QPushButton:hover { background-color: #2563eb; }
            QPushButton:pressed { background-color: #1d4ed8; }
        """)
        
        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        layout.setContentsMargins(24, 24, 24, 24)
        
        # Form
        form = QFormLayout()
        form.setSpacing(12)
        
        self.email_input = QLineEdit()
        self.email_input.setPlaceholderText("email@example.com")
        form.addRow("Email:", self.email_input)
        
        # Password input with show/hide toggle
        password_widget = QWidget()
        password_layout = QHBoxLayout(password_widget)
        password_layout.setContentsMargins(0, 0, 0, 0)
        password_layout.setSpacing(8)
        
        self.password_input = QLineEdit()
        self.password_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.password_input.setPlaceholderText("Password")
        password_layout.addWidget(self.password_input)
        
        self.show_password_btn = QPushButton("👁")
        self.show_password_btn.setFixedWidth(40)
        self.show_password_btn.setCheckable(True)
        self.show_password_btn.setStyleSheet("""
            QPushButton {
                background-color: #4b5563;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px;
            }
            QPushButton:hover { background-color: #6b7280; }
            QPushButton:checked { background-color: #3b82f6; }
        """)
        self.show_password_btn.toggled.connect(self._toggle_password_visibility)
        password_layout.addWidget(self.show_password_btn)
        
        form.addRow("Password:", password_widget)
        
        layout.addLayout(form)
        
        # Links
        links_layout = QHBoxLayout()
        links_layout.setContentsMargins(0, 0, 0, 0)
        
        self.register_link = QPushButton("Register")
        self.register_link.setFlat(True)
        self.register_link.setStyleSheet("""
            QPushButton {
                color: #60a5fa;
                text-decoration: underline;
                border: none;
                padding: 6px 8px;
                background-color: transparent;
                font-weight: normal;
            }
            QPushButton:hover {
                color: #93c5fd;
                background-color: rgba(59, 130, 246, 0.1);
                border-radius: 4px;
            }
        """)
        self.register_link.clicked.connect(self._show_register)
        
        self.forgot_link = QPushButton("Forgot Password?")
        self.forgot_link.setFlat(True)
        self.forgot_link.setStyleSheet("""
            QPushButton {
                color: #60a5fa;
                text-decoration: underline;
                border: none;
                padding: 6px 8px;
                background-color: transparent;
                font-weight: normal;
            }
            QPushButton:hover {
                color: #93c5fd;
                background-color: rgba(59, 130, 246, 0.1);
                border-radius: 4px;
            }
        """)
        self.forgot_link.clicked.connect(self._show_forgot_password)
        
        links_layout.addWidget(self.register_link)
        links_layout.addStretch()
        links_layout.addWidget(self.forgot_link)
        layout.addLayout(links_layout)
        
        # Buttons
        btn_layout = QHBoxLayout()
        
        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setStyleSheet("background-color: #4b5563;")
        self.cancel_btn.clicked.connect(self.reject)
        
        self.login_btn = QPushButton("Login")
        self.login_btn.clicked.connect(self.accept)
        
        btn_layout.addWidget(self.cancel_btn)
        btn_layout.addWidget(self.login_btn)
        layout.addLayout(btn_layout)
        
        # Enter key submits
        self.password_input.returnPressed.connect(self.accept)
        
        # Store result for register/forgot password dialogs
        self._register_result = None
        self._forgot_result = None
    
    def _toggle_password_visibility(self, checked: bool):
        """Toggle password visibility."""
        if checked:
            self.password_input.setEchoMode(QLineEdit.EchoMode.Normal)
            self.show_password_btn.setText("🙈")
        else:
            self.password_input.setEchoMode(QLineEdit.EchoMode.Password)
            self.show_password_btn.setText("👁")
    
    def _show_register(self):
        """Show register dialog."""
        from gui_register import RegisterDialog
        dialog = RegisterDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self._register_result = dialog.get_credentials()
            self.accept()  # Close login dialog
    
    def _show_forgot_password(self):
        """Show forgot password dialog."""
        from gui_register import ForgotPasswordDialog
        dialog = ForgotPasswordDialog(self)
        dialog.exec()
    
    def get_credentials(self):
        return self.email_input.text().strip(), self.password_input.text()
    
    def get_register_result(self):
        """Get registration result if user clicked Register."""
        return self._register_result


class StatusIndicator(QFrame):
    """Simple status indicator dot."""
    
    def __init__(self, size: int = 12):
        super().__init__()
        self.setFixedSize(size, size)
        self._connected = False
        self._update_style()
    
    def set_connected(self, connected: bool):
        if self._connected != connected:
            self._connected = connected
            self._update_style()
    
    def _update_style(self):
        color = "#22c55e" if self._connected else "#ef4444"
        self.setStyleSheet(f"""
            QFrame {{
                background-color: {color};
                border-radius: 6px;
            }}
        """)


class StatusRow(QWidget):
    """Label + value status row."""
    
    def __init__(self, label: str):
        super().__init__()
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 2, 0, 2)
        
        self.label = QLabel(label)
        self.label.setStyleSheet("color: #9ca3af;")
        
        self.value = QLabel("-")
        self.value.setStyleSheet("color: #f3f4f6; font-weight: bold;")
        self.value.setAlignment(Qt.AlignmentFlag.AlignRight)
        
        layout.addWidget(self.label)
        layout.addStretch()
        layout.addWidget(self.value)
    
    def set_value(self, text: str):
        self.value.setText(text)


class IRCommanderWindow(QMainWindow):
    """Main application window."""
    
    def __init__(self):
        super().__init__()
        self.service: IRCommanderService = get_service()
        self.joystick_config = joystick_config.get_config()
        self._setting_button = None  # Track which button we're currently setting
        self._setup_ui()
        self._setup_timer()
        self.service.start()
        self._update_joystick_display()
    
    def _setup_ui(self):
        self.setWindowTitle(f"iRCommander v{VERSION}")
        self.setMinimumSize(500, 750)
        self.resize(550, 800)
        self.setStyleSheet("""
            QMainWindow { background-color: #111827; }
            QGroupBox {
                background-color: #1f2937;
                border: 1px solid #374151;
                border-radius: 8px;
                margin-top: 12px;
                padding: 12px;
                color: #f3f4f6;
                font-weight: bold;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 4px;
            }
            QPushButton {
                background-color: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 10px 20px;
                font-weight: bold;
            }
            QPushButton:hover { background-color: #2563eb; }
            QPushButton:pressed { background-color: #1d4ed8; }
            QPushButton:disabled { background-color: #4b5563; color: #9ca3af; }
        """)
        
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setSpacing(16)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # Header
        header = QLabel("iRCommander")
        header.setFont(QFont("Segoe UI", 20, QFont.Weight.Bold))
        header.setStyleSheet("color: #f3f4f6;")
        header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(header)
        
        # Connection Status
        conn_group = QGroupBox("Connection Status")
        conn_layout = QGridLayout(conn_group)
        
        # iRacing status
        self.iracing_indicator = StatusIndicator()
        self.iracing_label = QLabel("iRacing")
        self.iracing_label.setStyleSheet("color: #f3f4f6;")
        conn_layout.addWidget(self.iracing_indicator, 0, 0)
        conn_layout.addWidget(self.iracing_label, 0, 1)
        
        # API status
        self.api_indicator = StatusIndicator()
        self.api_label = QLabel("iRCommander API")
        self.api_label.setStyleSheet("color: #f3f4f6;")
        conn_layout.addWidget(self.api_indicator, 1, 0)
        conn_layout.addWidget(self.api_label, 1, 1)
        
        conn_layout.setColumnStretch(1, 1)
        layout.addWidget(conn_group)
        
        # Network Peers
        peers_group = QGroupBox("Network Peers")
        peers_layout = QVBoxLayout(peers_group)
        
        self.peers_label = QLabel("No peers discovered")
        self.peers_label.setStyleSheet("color: #9ca3af; font-size: 11px;")
        self.peers_label.setWordWrap(True)
        peers_layout.addWidget(self.peers_label)
        
        layout.addWidget(peers_group)
        
        # Telemetry
        telem_group = QGroupBox("Telemetry")
        telem_layout = QVBoxLayout(telem_group)
        
        self.track_row = StatusRow("Track")
        self.car_row = StatusRow("Car")
        self.lap_row = StatusRow("Current Lap")
        self.speed_row = StatusRow("Speed")
        self.laps_recorded_row = StatusRow("Laps Recorded")
        
        telem_layout.addWidget(self.track_row)
        telem_layout.addWidget(self.car_row)
        telem_layout.addWidget(self.lap_row)
        telem_layout.addWidget(self.speed_row)
        telem_layout.addWidget(self.laps_recorded_row)
        layout.addWidget(telem_group)
        
        # Combined Controls Configuration
        controls_group = QGroupBox("Controls Configuration")
        controls_layout = QVBoxLayout(controls_group)
        
        # Info label about keyboard setup
        info_label = QLabel("⚠️ IMPORTANT: Keybindings in iRacing must be KEYBOARD bindings (not joystick/wheel buttons). Set a keyboard key (e.g., 'R') for Reset/Enter Car in iRacing settings.")
        info_label.setStyleSheet("color: #fbbf24; font-size: 10px; padding: 8px; background-color: #78350f; border-radius: 4px;")
        info_label.setWordWrap(True)
        controls_layout.addWidget(info_label)
        
        # Manual control buttons
        manual_label = QLabel("Manual Controls:")
        manual_label.setStyleSheet("color: #f3f4f6; font-weight: bold; padding-top: 8px;")
        controls_layout.addWidget(manual_label)
        
        ctrl_layout_manual = QHBoxLayout()
        ctrl_layout_manual.setSpacing(8)
        
        # Enter/Reset Car button (context-aware)
        self.enter_reset_btn = QPushButton("Enter Car / Reset Car")
        self.enter_reset_btn.clicked.connect(self._execute_enter_reset)
        self.enter_reset_btn.setStyleSheet("padding: 8px;")
        
        # Ignition button
        self.ignition_btn = QPushButton("Ignition")
        self.ignition_btn.clicked.connect(lambda: self._execute_action("ignition"))
        self.ignition_btn.setStyleSheet("padding: 8px;")
        
        # Pit Limiter button
        self.pit_limiter_btn = QPushButton("Pit Limiter")
        self.pit_limiter_btn.clicked.connect(lambda: self._execute_action("pit_speed_limiter"))
        self.pit_limiter_btn.setStyleSheet("padding: 8px;")
        
        ctrl_layout_manual.addWidget(self.enter_reset_btn)
        ctrl_layout_manual.addWidget(self.ignition_btn)
        ctrl_layout_manual.addWidget(self.pit_limiter_btn)
        controls_layout.addLayout(ctrl_layout_manual)
        
        # Joystick button configuration and monitoring status row
        bottom_row = QHBoxLayout()
        
        # Joystick button label
        joy_label_text = QLabel("Joystick Button:")
        joy_label_text.setStyleSheet("color: #f3f4f6; font-size: 11px;")
        bottom_row.addWidget(joy_label_text)
        
        self.joy_label = QLabel("Not set")
        self.joy_label.setStyleSheet("color: #9ca3af; font-size: 11px; min-width: 80px;")
        bottom_row.addWidget(self.joy_label)
        
        self.joy_btn = QPushButton("Press to Set")
        self.joy_btn.setStyleSheet("min-width: 100px; font-size: 11px; padding: 5px 10px;")
        self.joy_btn.clicked.connect(lambda: self._set_joystick_button("enter_car"))
        bottom_row.addWidget(self.joy_btn)
        
        self.clear_btn = QPushButton("Clear")
        self.clear_btn.setStyleSheet("background-color: #4b5563; font-size: 10px; padding: 5px 10px;")
        self.clear_btn.clicked.connect(lambda: self._clear_joystick_button("enter_car"))
        bottom_row.addWidget(self.clear_btn)
        
        bottom_row.addStretch()
        
        status_label = QLabel("Monitoring:")
        status_label.setStyleSheet("color: #f3f4f6; font-size: 11px;")
        self.monitor_status_label = QLabel("Disabled")
        self.monitor_status_label.setStyleSheet("color: #9ca3af; font-size: 11px;")
        bottom_row.addWidget(status_label)
        bottom_row.addWidget(self.monitor_status_label)
        
        controls_layout.addLayout(bottom_row)
        
        layout.addWidget(controls_group)
        
        # Account / Device Info
        account_group = QGroupBox("Account")
        account_layout = QVBoxLayout(account_group)
        
        self.account_row = StatusRow("Logged in as")
        self.tenant_row = StatusRow("Tenant")
        self.device_name_row = StatusRow("PC Name")
        self.device_id_row = StatusRow("Device ID")
        
        account_layout.addWidget(self.account_row)
        account_layout.addWidget(self.tenant_row)
        account_layout.addWidget(self.device_name_row)
        account_layout.addWidget(self.device_id_row)
        
        # Login/Logout button
        self.auth_btn = QPushButton("Login")
        self.auth_btn.clicked.connect(self._handle_auth)
        account_layout.addWidget(self.auth_btn)
        
        # Register device button (shown when logged in but not registered)
        self.register_btn = QPushButton("Register Device")
        self.register_btn.setStyleSheet("background-color: #059669; font-size: 11px; padding: 8px;")
        self.register_btn.clicked.connect(self._handle_register_device)
        self.register_btn.setVisible(False)
        account_layout.addWidget(self.register_btn)
        
        layout.addWidget(account_group)
        
        layout.addStretch()
    
    def _setup_timer(self):
        self.timer = QTimer()
        self.timer.timeout.connect(self._update_ui)
        self.timer.start(500)  # Update every 500ms
    
    def _update_ui(self):
        status = self.service.get_status()
        
        # Connection indicators
        iracing = status["iracing"]
        supabase = status["supabase"]
        
        self.iracing_indicator.set_connected(iracing["connected"])
        self.api_indicator.set_connected(supabase["connected"])
        
        # Telemetry
        self.track_row.set_value(iracing["track"])
        self.car_row.set_value(iracing["car"])
        self.lap_row.set_value(str(iracing["lap"]))
        self.speed_row.set_value(f"{iracing['speed_kph']:.0f} km/h")
        self.laps_recorded_row.set_value(str(supabase["laps_recorded"]))
        
        # Keybindings
        self._update_bindings_display()
        
        # Joystick button detection (if setting)
        if self._setting_button:
            self._check_joystick_button()
        
        # Update monitoring status
        self._update_monitoring_status()
        
        # Network peers
        self._update_peers_display()
        
        # Account info
        if self.service.client.is_logged_in:
            self.account_row.set_value(self.service.client.user.email if self.service.client.user else "Unknown")
            self.tenant_row.set_value(self.service.client.user.tenant_name or "N/A" if self.service.client.user else "N/A")
            self.auth_btn.setText("Logout")
            # Show register button if not registered
            self.register_btn.setVisible(not self.service.client.is_registered)
        else:
            self.account_row.set_value("Not logged in")
            self.tenant_row.set_value("-")
            self.auth_btn.setText("Login")
            self.register_btn.setVisible(False)
        
        # Device
        device_name = supabase.get("device_name") or supabase.get("name") or "N/A"
        self.device_name_row.set_value(device_name)
        self.device_id_row.set_value(supabase["device_id"])
        
        # Enable/disable controls based on iRacing connection
        connected = iracing["connected"]
        self.enter_reset_btn.setEnabled(connected)
        self.ignition_btn.setEnabled(connected)
        self.pit_limiter_btn.setEnabled(connected)
        
        # Update button text with keybindings
        self._update_enter_reset_button_text()
        self._update_pit_limiter_button_text()
    
    def _execute_enter_reset(self):
        """Execute enter_car or reset_car based on context."""
        try:
            from core import telemetry
            current = telemetry.get_current()
            in_car = current and current.get("is_on_track_car", False)
            
            if in_car:
                result = self.service.reset_car()
                print(f"[ACTION] reset_car: {result}")
            else:
                result = self.service.execute_action("enter_car")
                print(f"[ACTION] enter_car: {result}")
        except Exception as e:
            # Fallback to enter_car if telemetry check fails
            result = self.service.execute_action("enter_car")
            print(f"[ACTION] enter_car (fallback): {result}")
    
    def _update_enter_reset_button_text(self):
        """Update the enter/reset button text with keybinding."""
        try:
            bindings = self.service.controls.get_bindings()
            enter_combo = bindings.get("enter_car", {}).get("combo", "")
            reset_combo = bindings.get("reset_car", {}).get("combo", "")
            
            combo = enter_combo if enter_combo and enter_combo != "Not set" else reset_combo
            if combo and combo != "Not set":
                self.enter_reset_btn.setText(f"Enter Car / Reset Car ({combo})")
            else:
                self.enter_reset_btn.setText("Enter Car / Reset Car")
        except Exception:
            self.enter_reset_btn.setText("Enter Car / Reset Car")
    
    def _update_pit_limiter_button_text(self):
        """Update the pit limiter button text with keybinding."""
        try:
            bindings = self.service.controls.get_bindings()
            pit_combo = bindings.get("pit_speed_limiter", {}).get("combo", "")
            if pit_combo and pit_combo != "Not set":
                self.pit_limiter_btn.setText(f"Pit Limiter ({pit_combo})")
            else:
                self.pit_limiter_btn.setText("Pit Limiter")
        except Exception:
            self.pit_limiter_btn.setText("Pit Limiter")
    
    def _execute_action(self, action: str):
        if action == "reset_car":
            result = self.service.reset_car()
        else:
            result = self.service.execute_action(action)
        print(f"[ACTION] {action}: {result}")
    
    def _handle_auth(self):
        """Handle login/logout button click."""
        if self.service.client.is_logged_in:
            # Logout
            self.service.client.logout()
            print("[OK] Logged out")
        else:
            # Show login dialog
            dialog = LoginDialog(self)
            if dialog.exec() == QDialog.DialogCode.Accepted:
                email, password = dialog.get_credentials()
                if email and password:
                    try:
                        user = self.service.client.login(email, password)
                        print(f"[OK] Logged in as {user.email}")
                        # Register device if not already registered
                        if not self.service.client.is_registered:
                            self.service.register_device()
                    except SupabaseError as e:
                        QMessageBox.warning(self, "Login Failed", str(e))
    
    def _handle_register_device(self):
        """Handle manual device registration."""
        if not self.service.client.is_logged_in:
            QMessageBox.warning(self, "Not Logged In", "Please login first to register your device.")
            return
        
        # Ask if they want to force new registration
        reply = QMessageBox.question(
            self, 
            "Register Device",
            "Register as a NEW device?\n\nYes = New device ID (fresh start)\nNo = Use existing device if found",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.Yes
        )
        
        force_new = reply == QMessageBox.StandardButton.Yes
        
        try:
            result = self.service.register_device(force_new=force_new)
            if result:
                QMessageBox.information(self, "Device Registered", 
                    f"Device successfully registered!\nDevice ID: {self.service.device_id}")
            else:
                QMessageBox.warning(self, "Registration Failed", 
                    "Failed to register device. Please check the console for details.")
        except Exception as e:
            QMessageBox.warning(self, "Registration Error", f"Error registering device: {e}")
    
    def _update_bindings_display(self):
        """Update the keybindings display."""
        try:
            bindings = self.service.controls.get_bindings()
            
            # Update button labels with keybindings
            ignition_combo = bindings.get("ignition", {}).get("combo", "")
            if ignition_combo and ignition_combo != "Not set":
                self.ignition_btn.setText(f"Ignition ({ignition_combo})")
            else:
                self.ignition_btn.setText("Ignition")
            
            # Update enter/reset button
            self._update_enter_reset_button_text()
            
            # Update pit limiter button
            self._update_pit_limiter_button_text()
        except Exception as e:
            print(f"[WARN] Error updating bindings: {e}")
    
    def _update_joystick_display(self):
        """Update joystick button display."""
        button_num = self.joystick_config.get_button("enter_car")  # Same for both
        
        if button_num:
            self.joy_label.setText(f"Button {button_num}")
            self.joy_label.setStyleSheet("color: #22c55e;")
        else:
            self.joy_label.setText("Not set")
            self.joy_label.setStyleSheet("color: #9ca3af;")
    
    def _set_joystick_button(self, action: str):
        """Start listening for joystick button press."""
        self._setting_button = action
        self.joy_btn.setText("Press Button...")
        self.joy_btn.setEnabled(False)
        self.joy_label.setText("Waiting for button press...")
        self.joy_label.setStyleSheet("color: #fbbf24;")
    
    def _check_joystick_button(self):
        """Check for joystick button press while setting."""
        if not self._setting_button:
            return
        
        try:
            import os
            if os.name != "nt":
                return
            
            WINMM = ctypes.windll.winmm
            
            class JOYINFOEX(ctypes.Structure):
                _fields_ = [
                    ("dwSize", wintypes.DWORD),
                    ("dwFlags", wintypes.DWORD),
                    ("dwXpos", wintypes.DWORD),
                    ("dwYpos", wintypes.DWORD),
                    ("dwZpos", wintypes.DWORD),
                    ("dwRpos", wintypes.DWORD),
                    ("dwUpos", wintypes.DWORD),
                    ("dwVpos", wintypes.DWORD),
                    ("dwButtons", wintypes.DWORD),
                    ("dwButtonNumber", wintypes.DWORD),
                    ("dwPOV", wintypes.DWORD),
                    ("dwReserved1", wintypes.DWORD),
                    ("dwReserved2", wintypes.DWORD),
                ]
            
            # Define pointer type
            LP_JOYINFOEX = ctypes.POINTER(JOYINFOEX)
            
            # Set up function signature
            WINMM.joyGetPosEx.argtypes = [wintypes.UINT, LP_JOYINFOEX]
            WINMM.joyGetPosEx.restype = wintypes.DWORD
            
            joy_info = JOYINFOEX()
            joy_info.dwSize = ctypes.sizeof(JOYINFOEX)
            joy_info.dwFlags = 0x00000080  # JOY_RETURNBUTTONS
            
            result = WINMM.joyGetPosEx(0, ctypes.byref(joy_info))
            
            if result == 0:  # Success
                buttons = joy_info.dwButtons
                # Check each button (1-16)
                for btn_num in range(1, 17):
                    button_mask = 1 << (btn_num - 1)
                    if buttons & button_mask:
                        # Button pressed!
                        action_name = self._setting_button
                        self.joystick_config.set_button(action_name, btn_num)
                        self._setting_button = None
                        self._update_joystick_display()
                        
                        # Re-enable button
                        self.joy_btn.setText("Press to Set")
                        self.joy_btn.setEnabled(True)
                        
                        # Restart monitor with new button
                        if self.service.joystick_monitor:
                            self.service.joystick_monitor.stop()
                            self.service.joystick_monitor.start()
                            self.service.joystick_monitor.set_enabled(True)
                        
                        self._update_monitoring_status()
                        
                        QMessageBox.information(self, "Button Set", 
                            f"Joystick Button {btn_num} set for Enter Car / Reset Car")
                        return
        except Exception as e:
            print(f"[WARN] Error checking joystick: {e}")
    
    def _clear_joystick_button(self, action: str):
        """Clear joystick button mapping."""
        self.joystick_config.set_button(action, None)
        self._update_joystick_display()
        self._update_monitoring_status()
        QMessageBox.information(self, "Cleared", f"Joystick button mapping cleared for {action.replace('_', ' ').title()}")
    
    def _update_monitoring_status(self):
        """Update the monitoring status display."""
        try:
            if self.service.joystick_monitor:
                button_num = self.joystick_config.get_button("enter_car")
                if button_num and self.service.joystick_monitor.running and self.service.joystick_monitor.enabled:
                    self.monitor_status_label.setText(f"Active (Button {button_num})")
                    self.monitor_status_label.setStyleSheet("color: #22c55e;")
                elif button_num:
                    self.monitor_status_label.setText("Configured (not running)")
                    self.monitor_status_label.setStyleSheet("color: #fbbf24;")
                else:
                    self.monitor_status_label.setText("Disabled (no button set)")
                    self.monitor_status_label.setStyleSheet("color: #9ca3af;")
            else:
                self.monitor_status_label.setText("Not available")
                self.monitor_status_label.setStyleSheet("color: #9ca3af;")
        except Exception as e:
            self.monitor_status_label.setText("Error")
            self.monitor_status_label.setStyleSheet("color: #ef4444;")
    
    def _update_peers_display(self):
        """Update the network peers display."""
        try:
            peers = self.service.get_discovered_peers(online_only=True)
            if not peers:
                self.peers_label.setText("No peers discovered")
                self.peers_label.setStyleSheet("color: #9ca3af; font-size: 11px;")
            else:
                peer_texts = []
                for peer in peers:
                    iracing_status = "🟢" if peer.get("iracing_connected") else "⚪"
                    peer_text = f"{iracing_status} {peer.get('device_name', 'Unknown')} ({peer.get('local_ip', 'N/A')})"
                    peer_texts.append(peer_text)
                
                text = f"{len(peers)} peer(s) found:\n" + "\n".join(peer_texts)
                self.peers_label.setText(text)
                self.peers_label.setStyleSheet("color: #22c55e; font-size: 11px;")
        except Exception as e:
            self.peers_label.setText("Error discovering peers")
            self.peers_label.setStyleSheet("color: #ef4444; font-size: 11px;")
    
    def closeEvent(self, event):
        self.service.stop()
        event.accept()


def main():
    app = QApplication(sys.argv)
    
    # Dark palette
    palette = QPalette()
    palette.setColor(QPalette.ColorRole.Window, QColor("#111827"))
    palette.setColor(QPalette.ColorRole.WindowText, QColor("#f3f4f6"))
    app.setPalette(palette)
    
    window = IRCommanderWindow()
    window.show()
    # Ensure window is at least minimum size (in case Qt restored a smaller size)
    size = window.size()
    if size.height() < 750:
        window.resize(max(size.width(), 500), 750)
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

