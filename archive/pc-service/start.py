#!/usr/bin/env python3
"""
Rev Share Racing - PC Service Entry Point
"""

import sys
import os
import traceback
from pathlib import Path
from datetime import datetime

# Setup logging to file for executable
def setup_logging():
    """Setup file logging for executable"""
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        log_dir = Path(sys.executable).parent / 'logs'
        log_dir.mkdir(exist_ok=True)
        log_file = log_dir / f'revshareracing_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'
        
        # Redirect stdout and stderr to log file
        class Logger:
            def __init__(self, log_file):
                self.log_file = log_file
                # In windowed mode, sys.stdout might be None, so handle it gracefully
                self.terminal = sys.stdout if sys.stdout is not None else None
                self.log = open(log_file, 'w', encoding='utf-8')
            
            def write(self, message):
                # Only write to terminal if it exists (not None)
                if self.terminal is not None:
                    try:
                        self.terminal.write(message)
                    except (AttributeError, OSError):
                        # Terminal might not be available in windowed mode
                        pass
                # Always write to log file
                self.log.write(message)
                self.log.flush()
            
            def flush(self):
                # Only flush terminal if it exists
                if self.terminal is not None:
                    try:
                        self.terminal.flush()
                    except (AttributeError, OSError):
                        pass
                self.log.flush()
        
        sys.stdout = Logger(log_file)
        sys.stderr = sys.stdout
        
        print(f"[LOG] Logging to: {log_file}")
        print(f"[LOG] Started at: {datetime.now()}")
        print("=" * 80)

# Setup logging before anything else
setup_logging()

# Add src to path
if getattr(sys, 'frozen', False):
    # Running as compiled executable - src is in the bundle
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        sys.path.insert(0, os.path.join(sys._MEIPASS, 'src'))
    else:
        # Fallback: look for src next to executable
        sys.path.insert(0, str(Path(sys.executable).parent / 'src'))
else:
    # Running as script
    sys.path.insert(0, str(Path(__file__).parent / 'src'))

if __name__ == '__main__':
    try:
        import argparse
        parser = argparse.ArgumentParser(description='Rev Share Racing PC Service')
        parser.add_argument('--api', action='store_true', help='Run minimal API server on localhost:5000')
        parser.add_argument('--no-gui', action='store_true', help='Run without GUI window')
        args = parser.parse_args()
        
        # Import config first to ensure it loads properly
        from config import SUPABASE_URL, SUPABASE_ANON_KEY
        print(f"[INFO] Using Supabase URL: {SUPABASE_URL[:40]}...")
        
        # Import and run service
        from service import get_service
        
        service = get_service()
        service.start()
        
        # Note: Service will handle Supabase connection issues gracefully
        # It will continue running even if initial connection fails
    except Exception as e:
        error_msg = f"Fatal error during startup: {e}\n{traceback.format_exc()}"
        print(error_msg)
        
        # If running as executable, show error dialog
        if getattr(sys, 'frozen', False):
            try:
                import tkinter.messagebox as messagebox
                import tkinter as tk
                root = tk.Tk()
                root.withdraw()
                messagebox.showerror("Rev Share Racing - Startup Error", 
                                   f"Failed to start:\n\n{str(e)}\n\nCheck logs folder for details.")
                root.destroy()
            except:
                pass
        
        # Keep console open if not windowed
        if not getattr(sys, 'frozen', False) or '--windowed' not in sys.argv:
            input("\nPress Enter to exit...")
        
        sys.exit(1)
    
    # Check if GUI is available
    gui_available = False
    if not args.no_gui:
        try:
            import tkinter
            gui_available = True
        except ImportError:
            gui_available = False
    
    if gui_available:
        # Run with GUI
        print()
        print("=" * 80)
        print("Rev Share Racing - PC Service (with GUI)")
        print("=" * 80)
        print()
        print("[OK] GUI window opening...")
        print("[OK] Service running in background")
        print()
        print("=" * 80)
        print()
        
        import threading
        from gui import create_gui
        
        # Create GUI
        root, gui_app = create_gui()
        
        # Set service reference for status updates
        gui_app.set_service(service)
        
        # Set Supabase client for laps tab
        from service import supabase
        gui_app.set_supabase(supabase)
        
        # Share portal URL with the GUI for quick access
        gui_app.set_portal_url(service.device_portal_url)
        if not service.claimed and service.claim_code:
            gui_app.log(f"[ACTION] Claim this rig in the portal using code: {service.claim_code}")
        
        if args.api:
            gui_app.log("[OK] Minimal API server enabled")
            gui_app.log("[OK] API available at: http://localhost:5000/api")
        
        # Update service status (only if tabs are created)
        if hasattr(gui_app, 'service_status_label'):
            gui_app.set_service_running()
        
        # Run Flask API in separate thread if requested
        if args.api:
            import sys
            from pathlib import Path
            # Add src to path for api_server import
            src_path = Path(__file__).parent / 'src'
            if str(src_path) not in sys.path:
                sys.path.insert(0, str(src_path))
            
            from api_server import set_service, run_server
            set_service(service)
            
            def run_flask():
                run_server(host='127.0.0.1', port=5000)
            
            flask_thread = threading.Thread(target=run_flask, daemon=True)
            flask_thread.start()
            gui_app.log("[OK] API server started on http://localhost:5000")
        
        # Run GUI (blocks until window closed)
        try:
            root.mainloop()
        except Exception as e:
            error_msg = f"GUI error: {e}\n{traceback.format_exc()}"
            print(error_msg)
            if getattr(sys, 'frozen', False):
                try:
                    import tkinter.messagebox as messagebox
                    messagebox.showerror("Rev Share Racing - GUI Error", str(e))
                except:
                    pass
        
        # Cleanup when GUI closes
        service.stop()
    else:
        # Run without GUI
        print()
        print("=" * 80)
        print("Rev Share Racing - PC Service")
        print("=" * 80)
        print()
        print("This service handles PC operations:")
        print("  - Lap collection from iRacing")
        print("  - Executing queued rig commands")
        print("  - Local configuration management")
        print()
        if service.device_portal_url:
            print(f"Manage this rig from the portal: {service.device_portal_url}")
        else:
            from core import device as device_core  # Lazy import to avoid circular init
            print(f"Manage this rig from the portal: {device_core.DEVICE_PORTAL_BASE_URL}/<device-id>")
        if not service.claimed and service.claim_code:
            print(f"Claim code for this rig: {service.claim_code}")
        print("Telemetry and Supabase syncing continue to run in the background.")
        print()
        print("=" * 80)
        print()
        
        if args.api:
            print("[*] Starting API server...")
            import sys
            from pathlib import Path
            # Add src to path for api_server import
            src_path = Path(__file__).parent / 'src'
            if str(src_path) not in sys.path:
                sys.path.insert(0, str(src_path))
            
            from api_server import set_service, run_server
            set_service(service)
            
            def run_flask():
                run_server(host='127.0.0.1', port=5000)
            
            flask_thread = threading.Thread(target=run_flask, daemon=True)
            flask_thread.start()
            print("[OK] API server started on http://localhost:5000")
        
        print("[*] Service running")
        print("[*] Use --api flag to enable local API server")
        print("[*] Use --no-gui flag to disable GUI (if available)")
        print()
        try:
            import time
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[*] Shutting down...")
            service.stop()
            print("[OK] Service stopped")

