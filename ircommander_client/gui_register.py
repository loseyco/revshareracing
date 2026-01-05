"""
Registration and Password Reset Dialogs for iRCommander
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout,
    QLineEdit, QPushButton, QLabel, QMessageBox, QWidget
)
from supabase_client import SupabaseError


class RegisterDialog(QDialog):
    """Registration dialog."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Create Account")
        self.setFixedSize(400, 300)
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
            QPushButton[flat="true"] {
                background-color: transparent;
                color: #3b82f6;
                text-decoration: underline;
                padding: 4px;
            }
        """)
        
        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        layout.setContentsMargins(24, 24, 24, 24)
        
        # Title
        title = QLabel("Create New Account")
        title.setStyleSheet("font-size: 18px; font-weight: bold; color: #f3f4f6;")
        layout.addWidget(title)
        
        # Form
        form = QFormLayout()
        form.setSpacing(12)
        
        self.email_input = QLineEdit()
        self.email_input.setPlaceholderText("email@example.com")
        form.addRow("Email:", self.email_input)
        
        # Password with show/hide
        password_widget = QWidget()
        password_layout = QHBoxLayout(password_widget)
        password_layout.setContentsMargins(0, 0, 0, 0)
        password_layout.setSpacing(8)
        
        self.password_input = QLineEdit()
        self.password_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.password_input.setPlaceholderText("Password (min 6 characters)")
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
        
        # Confirm password with show/hide
        confirm_widget = QWidget()
        confirm_layout = QHBoxLayout(confirm_widget)
        confirm_layout.setContentsMargins(0, 0, 0, 0)
        confirm_layout.setSpacing(8)
        
        self.confirm_password_input = QLineEdit()
        self.confirm_password_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.confirm_password_input.setPlaceholderText("Confirm password")
        confirm_layout.addWidget(self.confirm_password_input)
        
        self.show_confirm_btn = QPushButton("👁")
        self.show_confirm_btn.setFixedWidth(40)
        self.show_confirm_btn.setCheckable(True)
        self.show_confirm_btn.setStyleSheet("""
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
        self.show_confirm_btn.toggled.connect(lambda checked: self._toggle_confirm_visibility(checked))
        confirm_layout.addWidget(self.show_confirm_btn)
        
        form.addRow("Confirm:", confirm_widget)
        
        layout.addLayout(form)
        
        # Buttons
        btn_layout = QHBoxLayout()
        
        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setStyleSheet("background-color: #4b5563;")
        self.cancel_btn.clicked.connect(self.reject)
        
        self.register_btn = QPushButton("Create Account")
        self.register_btn.clicked.connect(self._handle_register)
        
        btn_layout.addWidget(self.cancel_btn)
        btn_layout.addWidget(self.register_btn)
        layout.addLayout(btn_layout)
        
        # Enter key submits
        self.confirm_password_input.returnPressed.connect(self._handle_register)
    
    def _toggle_password_visibility(self, checked: bool):
        """Toggle password visibility."""
        if checked:
            self.password_input.setEchoMode(QLineEdit.EchoMode.Normal)
            self.show_password_btn.setText("🙈")
        else:
            self.password_input.setEchoMode(QLineEdit.EchoMode.Password)
            self.show_password_btn.setText("👁")
    
    def _toggle_confirm_visibility(self, checked: bool):
        """Toggle confirm password visibility."""
        if checked:
            self.confirm_password_input.setEchoMode(QLineEdit.EchoMode.Normal)
            self.show_confirm_btn.setText("🙈")
        else:
            self.confirm_password_input.setEchoMode(QLineEdit.EchoMode.Password)
            self.show_confirm_btn.setText("👁")
    
    def _handle_register(self):
        """Handle registration."""
        email = self.email_input.text().strip()
        password = self.password_input.text()
        confirm = self.confirm_password_input.text()
        
        # Validation
        if not email:
            QMessageBox.warning(self, "Validation Error", "Email is required")
            return
        
        if not password:
            QMessageBox.warning(self, "Validation Error", "Password is required")
            return
        
        if len(password) < 6:
            QMessageBox.warning(self, "Validation Error", "Password must be at least 6 characters")
            return
        
        if password != confirm:
            QMessageBox.warning(self, "Validation Error", "Passwords do not match")
            return
        
        # Try to register
        try:
            from service import get_service
            service = get_service()
            user = service.client.register(email, password)
            # Auto-login after registration
            QMessageBox.information(self, "Success", 
                "Account created successfully!\nYou are now logged in.")
            self.accept()
        except SupabaseError as e:
            QMessageBox.warning(self, "Registration Failed", str(e))
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Registration failed: {e}")
    
    def get_credentials(self):
        """Get registration credentials."""
        return self.email_input.text().strip(), self.password_input.text()


class ForgotPasswordDialog(QDialog):
    """Forgot password dialog."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Reset Password")
        self.setFixedSize(400, 200)
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
        
        # Title
        title = QLabel("Reset Password")
        title.setStyleSheet("font-size: 18px; font-weight: bold; color: #f3f4f6;")
        layout.addWidget(title)
        
        info = QLabel("Enter your email address and we'll send you a link to reset your password.")
        info.setStyleSheet("color: #9ca3af; font-size: 12px;")
        info.setWordWrap(True)
        layout.addWidget(info)
        
        # Form
        form = QFormLayout()
        form.setSpacing(12)
        
        self.email_input = QLineEdit()
        self.email_input.setPlaceholderText("email@example.com")
        form.addRow("Email:", self.email_input)
        
        layout.addLayout(form)
        
        # Buttons
        btn_layout = QHBoxLayout()
        
        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setStyleSheet("background-color: #4b5563;")
        self.cancel_btn.clicked.connect(self.reject)
        
        self.send_btn = QPushButton("Send Reset Link")
        self.send_btn.clicked.connect(self._handle_send_reset)
        
        btn_layout.addWidget(self.cancel_btn)
        btn_layout.addWidget(self.send_btn)
        layout.addLayout(btn_layout)
        
        # Enter key submits
        self.email_input.returnPressed.connect(self._handle_send_reset)
    
    def _handle_send_reset(self):
        """Handle password reset request."""
        email = self.email_input.text().strip()
        
        if not email:
            QMessageBox.warning(self, "Validation Error", "Email is required")
            return
        
        try:
            from service import get_service
            service = get_service()
            # Use Supabase Auth password reset
            service.client.supabase.auth.reset_password_for_email(email)
            QMessageBox.information(self, "Email Sent", 
                f"If an account exists with {email}, a password reset link has been sent.\n"
                "Please check your email.")
            self.accept()
        except SupabaseError as e:
            QMessageBox.warning(self, "Error", str(e))
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to send reset email: {e}")
