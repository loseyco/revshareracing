"""
iRCommander Client - Entry Point
"""

import sys
import argparse
import os

from config import VERSION


def check_single_instance():
    """Check if another instance is already running. Returns True if this is the only instance."""
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes
        
        # Create a named mutex
        mutex_name = "Global\\iRCommander_SingleInstance_Mutex"
        
        # Try to create the mutex
        mutex = ctypes.windll.kernel32.CreateMutexW(
            None,  # Default security attributes
            True,  # Initial owner (this process)
            mutex_name
        )
        
        # Check if mutex already exists (another instance is running)
        error = ctypes.get_last_error()
        if error == 183:  # ERROR_ALREADY_EXISTS
            print("[ERROR] Another instance of iRCommander is already running!")
            print("[INFO] Please close the existing instance before starting a new one.")
            return False
        
        return True
    else:
        # For non-Windows, use a lock file
        lock_file = os.path.join(os.path.expanduser("~"), ".ircommander.lock")
        
        if os.path.exists(lock_file):
            # Check if the process is still running
            try:
                with open(lock_file, 'r') as f:
                    pid = int(f.read().strip())
                # Try to send signal 0 to check if process exists
                os.kill(pid, 0)
                print("[ERROR] Another instance of iRCommander is already running!")
                print(f"[INFO] PID: {pid}")
                return False
            except (OSError, ValueError):
                # Process doesn't exist, remove stale lock file
                os.remove(lock_file)
        
        # Create lock file
        try:
            with open(lock_file, 'w') as f:
                f.write(str(os.getpid()))
            return True
        except Exception as e:
            print(f"[WARN] Could not create lock file: {e}")
            return True  # Continue anyway


def run_gui():
    """Run with GUI."""
    from gui import main
    main()


def run_headless():
    """Run without GUI (headless mode)."""
    from service import get_service
    import time
    
    print("=" * 60)
    print(f"iRCommander v{VERSION} (Headless)")
    print("=" * 60)
    
    service = get_service()
    service.start()
    
    try:
        while True:
            status = service.get_status()
            iracing = status["iracing"]
            api = status["api"]
            
            print(f"\r[iRacing: {'✓' if iracing['connected'] else '✗'}] "
                  f"[API: {'✓' if api['connected'] else '✗'}] "
                  f"Lap: {iracing['lap']} | Laps Recorded: {api['laps_recorded']}    ",
                  end="", flush=True)
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n[*] Shutting down...")
        service.stop()
        print("[OK] Goodbye!")


def main():
    # Check for single instance
    if not check_single_instance():
        sys.exit(1)
    
    parser = argparse.ArgumentParser(description="iRCommander Client")
    parser.add_argument("--headless", "-H", action="store_true",
                       help="Run without GUI")
    parser.add_argument("--version", "-v", action="version",
                       version=f"iRCommander v{VERSION}")
    
    args = parser.parse_args()
    
    if args.headless:
        run_headless()
    else:
        run_gui()


if __name__ == "__main__":
    main()


