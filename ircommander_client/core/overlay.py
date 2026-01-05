"""
iRacing Overlay - Web-based overlay window for displaying information
Uses QWebEngineView to load a webpage that can be updated server-side
"""

import os
import ctypes
from ctypes import wintypes
from typing import Optional, Dict
from PyQt6.QtWidgets import QWidget
from PyQt6.QtCore import Qt, QTimer, QPoint, QUrl

# Try to import QWebEngineView - requires PyQt6-WebEngine
try:
    from PyQt6.QtWebEngineWidgets import QWebEngineView
    WEBENGINE_AVAILABLE = True
except ImportError:
    WEBENGINE_AVAILABLE = False
    QWebEngineView = None

if os.name == "nt":
    USER32 = ctypes.windll.user32
    KERNEL32 = ctypes.windll.kernel32
else:
    USER32 = None
    KERNEL32 = None


def find_iracing_window() -> Optional[int]:
    """Find the iRacing window handle."""
    if USER32 is None:
        return None
    
    # Try common iRacing window titles
    window_titles = [
        "iRacing",
        "iRacing.com Motorsport Simulations",
        "iRacing.com"
    ]
    
    for title in window_titles:
        hwnd = USER32.FindWindowW(None, title)
        if hwnd:
            return hwnd
    return None


def get_window_rect(hwnd: int) -> Optional[tuple]:
    """Get window rectangle (left, top, right, bottom)."""
    if USER32 is None:
        return None
    
    rect = ctypes.wintypes.RECT()
    if USER32.GetWindowRect(hwnd, ctypes.byref(rect)):
        return (rect.left, rect.top, rect.right, rect.bottom)
    return None


class OverlayWidget(QWidget):
    """Transparent overlay window with embedded web browser."""
    
    def __init__(self, overlay_url: str, parent=None):
        super().__init__(parent)
        
        if not WEBENGINE_AVAILABLE:
            raise ImportError("QWebEngineView not available. Install PyQt6-WebEngine: pip install PyQt6-WebEngine")
        
        # TEST MODE: Remove WindowTransparentForInput so we can see and interact with it
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
            # Removed WindowTransparentForInput for testing - makes overlay visible
        )
        # TEST MODE: Make background visible for testing
        # self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        # self.setAttribute(Qt.WidgetAttribute.WA_NoSystemBackground)
        
        # Create web view
        self.web_view = QWebEngineView(self)
        self.web_view.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        # Create layout first
        from PyQt6.QtWidgets import QVBoxLayout
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.web_view)
        
        # Show placeholder with branding immediately
        self._show_placeholder("Loading...")
        
        # Load the remote URL (will fallback if it fails)
        self._overlay_url = overlay_url
        self._load_failed = False
        self._localhost_tried = False
        self.web_view.setUrl(QUrl(overlay_url))
        
        # Handle load errors - show fallback
        self.web_view.loadFinished.connect(self._on_load_finished)
        
        # Update timer for position tracking
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self._update_position)
        self.update_timer.start(100)  # Update position every 100ms
        
        self._last_hwnd = None
        
        # Set initial size - make it larger for testing
        self.resize(800, 600)
        
        # Show overlay immediately (will be repositioned by _update_position)
        self.show()
        self.raise_()  # Bring to front
        self.activateWindow()  # Activate window
        print(f"[OVERLAY] Overlay window created and shown, size: {self.width()}x{self.height()}, visible: {self.isVisible()}")
    
    def _show_placeholder(self, status_text: str = "Connected"):
        """Show placeholder HTML with branding."""
        fallback_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{
            margin: 0;
            padding: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            font-family: Arial, sans-serif;
            border-radius: 8px;
            position: relative;
        }}
        .branding {{
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 10px;
            color: #888;
            z-index: 10000;
        }}
        .status {{
            font-size: 12px;
            color: #888;
            text-align: center;
            margin-top: 5px;
        }}
    </style>
</head>
<body>
    <div class="status">Status: {status_text}</div>
    <div class="branding">Powered by GridPass</div>
</body>
</html>
        """
        self.web_view.setHtml(fallback_html)
    
    def _inject_branding(self):
        """Inject 'Powered by GridPass' branding into the loaded page."""
        branding_js = """
(function() {
    // Check if branding already exists
    if (document.getElementById('gridpass-overlay-branding')) {
        return;
    }
    
    // Create branding element
    var branding = document.createElement('div');
    branding.id = 'gridpass-overlay-branding';
    branding.style.cssText = 'position: fixed; top: 10px; right: 10px; font-size: 10px; color: #888; z-index: 999999; font-family: Arial, sans-serif; pointer-events: none;';
    branding.textContent = 'Powered by GridPass';
    
    // Add to body
    document.body.appendChild(branding);
})();
        """
        try:
            self.web_view.page().runJavaScript(branding_js)
        except Exception:
            # Silently fail if injection doesn't work
            pass
    
    def _on_load_finished(self, success: bool):
        """Handle page load finished - show fallback if failed."""
        if success:
            # Page loaded successfully - inject branding overlay
            self._inject_branding()
            return
        
        # Page failed to load
        url_obj = QUrl(self._overlay_url)
        current_url = self.web_view.url().toString()
        
        # If we haven't tried localhost yet and the original URL is not localhost, try it
        # Skip localhost fallback for test URLs (like google.com)
        if not self._localhost_tried and url_obj.host() and url_obj.host() not in ["localhost", "127.0.0.1", "www.google.com", "google.com"]:
            if not current_url.startswith("http://localhost") and not current_url.startswith("data:"):
                # Try localhost version
                localhost_url = f"http://localhost:3000{url_obj.path()}"
                print(f"[OVERLAY] Remote failed, trying localhost: {localhost_url}")
                self._localhost_tried = True
                self.web_view.setUrl(QUrl(localhost_url))
                return
        
        # If localhost also failed or we've already tried it, show placeholder
        if self._localhost_tried or url_obj.host() in ["localhost", "127.0.0.1"]:
            if not current_url.startswith("data:"):  # Only show message if not already showing placeholder
                print("[OVERLAY] Both remote and localhost failed, showing placeholder")
                print("[OVERLAY] Note: The overlay requires the web app to be running.")
                print("[OVERLAY] Remote URL:", self._overlay_url)
                print("[OVERLAY] Localhost URL: http://localhost:3000" + url_obj.path())
                print("[OVERLAY] To fix: Start the Next.js app in the 'ircommander' directory with 'npm run dev'")
                self._show_placeholder("Connected")
    
    def _update_position(self):
        """Update overlay position to follow iRacing window."""
        hwnd = find_iracing_window()
        if not hwnd:
            # TEST MODE: Show overlay even if iRacing window not found
            # Position in top-right of primary screen
            if not hasattr(self, '_test_position_set'):
                from PyQt6.QtWidgets import QApplication
                screen = QApplication.primaryScreen()
                screen_geometry = screen.geometry()
                overlay_width = 250
                overlay_height = 150
                x = screen_geometry.width() - overlay_width - 20
                y = 20
                self.move(x, y)
                self._test_position_set = True
                print(f"[OVERLAY] TEST MODE: iRacing window not found, positioning at screen coordinates ({x}, {y})")
            if not self.isVisible():
                self.show()
                print("[OVERLAY] Showing overlay (iRacing window not found, using test position)")
            return
        
        rect = get_window_rect(hwnd)
        if not rect:
            return
        
        left, top, right, bottom = rect
        width = right - left
        height = bottom - top
        
        # Position overlay in top-right corner of iRacing window
        overlay_width = 250
        overlay_height = 150
        x = left + width - overlay_width - 20
        y = top + 20
        
        # Show overlay and move if position changed
        if not self.isVisible():
            self.show()
            self.raise_()  # Bring to front
            print(f"[OVERLAY] Showing overlay at iRacing window position ({x}, {y})")
        
        # Only move if position changed
        if self._last_hwnd != hwnd or self.pos() != QPoint(x, y):
            self.move(x, y)
            self.raise_()  # Keep on top
            self._last_hwnd = hwnd
            print(f"[OVERLAY] Moved overlay to ({x}, {y}), visible: {self.isVisible()}")
            print(f"[OVERLAY] Moved overlay to ({x}, {y})")


def create_overlay(overlay_url: str) -> Optional[OverlayWidget]:
    """Create an overlay widget. Returns None if WebEngine is not available."""
    if not WEBENGINE_AVAILABLE:
        return None
    
    try:
        return OverlayWidget(overlay_url=overlay_url)
    except Exception as e:
        print(f"[WARN] Failed to create overlay: {e}")
        return None
