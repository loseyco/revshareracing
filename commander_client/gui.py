"""
GridPass Commander - PyQt6 GUI
Simple, clean interface for monitoring and control.
"""

import sys
from typing import Optional
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QFrame, QGroupBox, QGridLayout,
    QDialog, QLineEdit, QFormLayout, QMessageBox
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QFont, QPalette, QColor

from service import CommanderService, get_service
from api_client import APIError
from config import VERSION


class LoginDialog(QDialog):
    """Login dialog for GridPass authentication."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Login to GridPass")
        self.setFixedSize(350, 200)
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
        
        self.password_input = QLineEdit()
        self.password_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.password_input.setPlaceholderText("Password")
        form.addRow("Password:", self.password_input)
        
        layout.addLayout(form)
        
        # Buttons
        btn_layout = QHBoxLayout()
        
        self.login_btn = QPushButton("Login")
        self.login_btn.clicked.connect(self.accept)
        
        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setStyleSheet("background-color: #4b5563;")
        self.cancel_btn.clicked.connect(self.reject)
        
        btn_layout.addWidget(self.cancel_btn)
        btn_layout.addWidget(self.login_btn)
        layout.addLayout(btn_layout)
        
        # Enter key submits
        self.password_input.returnPressed.connect(self.accept)
    
    def get_credentials(self):
        return self.email_input.text().strip(), self.password_input.text()


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


class CommanderWindow(QMainWindow):
    """Main application window."""
    
    def __init__(self):
        super().__init__()
        self.service: CommanderService = get_service()
        self._setup_ui()
        self._setup_timer()
        self.service.start()
    
    def _setup_ui(self):
        self.setWindowTitle(f"GridPass Commander v{VERSION}")
        self.setMinimumSize(400, 500)
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
        header = QLabel("GridPass Commander")
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
        self.api_label = QLabel("GridPass API")
        self.api_label.setStyleSheet("color: #f3f4f6;")
        conn_layout.addWidget(self.api_indicator, 1, 0)
        conn_layout.addWidget(self.api_label, 1, 1)
        
        conn_layout.setColumnStretch(1, 1)
        layout.addWidget(conn_group)
        
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
        
        # Controls
        ctrl_group = QGroupBox("Controls")
        ctrl_layout = QGridLayout(ctrl_group)
        
        self.reset_btn = QPushButton("Reset Car")
        self.reset_btn.clicked.connect(lambda: self._execute_action("reset_car"))
        
        self.ignition_btn = QPushButton("Ignition")
        self.ignition_btn.clicked.connect(lambda: self._execute_action("ignition"))
        
        self.starter_btn = QPushButton("Starter")
        self.starter_btn.clicked.connect(lambda: self._execute_action("starter"))
        
        self.enter_btn = QPushButton("Enter Car")
        self.enter_btn.clicked.connect(lambda: self._execute_action("enter_car"))
        
        ctrl_layout.addWidget(self.reset_btn, 0, 0)
        ctrl_layout.addWidget(self.ignition_btn, 0, 1)
        ctrl_layout.addWidget(self.starter_btn, 1, 0)
        ctrl_layout.addWidget(self.enter_btn, 1, 1)
        layout.addWidget(ctrl_group)
        
        # Account / Device Info
        account_group = QGroupBox("Account")
        account_layout = QVBoxLayout(account_group)
        
        self.account_row = StatusRow("Logged in as")
        self.tenant_row = StatusRow("Tenant")
        self.device_id_row = StatusRow("Device ID")
        
        account_layout.addWidget(self.account_row)
        account_layout.addWidget(self.tenant_row)
        account_layout.addWidget(self.device_id_row)
        
        # Login/Logout button
        self.auth_btn = QPushButton("Login")
        self.auth_btn.clicked.connect(self._handle_auth)
        account_layout.addWidget(self.auth_btn)
        
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
        api = status["api"]
        
        self.iracing_indicator.set_connected(iracing["connected"])
        self.api_indicator.set_connected(api["connected"])
        
        # Telemetry
        self.track_row.set_value(iracing["track"])
        self.car_row.set_value(iracing["car"])
        self.lap_row.set_value(str(iracing["lap"]))
        self.speed_row.set_value(f"{iracing['speed_kph']:.0f} km/h")
        self.laps_recorded_row.set_value(str(api["laps_recorded"]))
        
        # Account info
        if self.service.api.is_logged_in:
            self.account_row.set_value(self.service.api.user.email)
            self.tenant_row.set_value(self.service.api.user.tenant_name or "N/A")
            self.auth_btn.setText("Logout")
        else:
            self.account_row.set_value("Not logged in")
            self.tenant_row.set_value("-")
            self.auth_btn.setText("Login")
        
        # Device
        self.device_id_row.set_value(api["device_id"])
        
        # Enable/disable controls based on iRacing connection
        connected = iracing["connected"]
        self.reset_btn.setEnabled(connected)
        self.ignition_btn.setEnabled(connected)
        self.starter_btn.setEnabled(connected)
        self.enter_btn.setEnabled(connected)
    
    def _execute_action(self, action: str):
        if action == "reset_car":
            result = self.service.reset_car()
        else:
            result = self.service.execute_action(action)
        print(f"[ACTION] {action}: {result}")
    
    def _handle_auth(self):
        """Handle login/logout button click."""
        if self.service.api.is_logged_in:
            # Logout
            self.service.api.logout()
            print("[OK] Logged out")
        else:
            # Show login dialog
            dialog = LoginDialog(self)
            if dialog.exec() == QDialog.DialogCode.Accepted:
                email, password = dialog.get_credentials()
                if email and password:
                    try:
                        user = self.service.api.login(email, password)
                        print(f"[OK] Logged in as {user.email}")
                        # Try to register device with tenant
                        if user.tenant_id and not self.service.api.is_registered:
                            self.service.register_device()
                    except APIError as e:
                        QMessageBox.warning(self, "Login Failed", str(e))
    
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
    
    window = CommanderWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

