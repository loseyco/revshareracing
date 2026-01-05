"""
iRCommander - Development Auto-Reload
Watches for code changes and automatically restarts the application.
"""

import sys
import os
import time
import subprocess
import signal
import argparse
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent, FileCreatedEvent

# Get the directory of this script
BASE_DIR = Path(__file__).parent


class CodeChangeHandler(FileSystemEventHandler):
    """Handles file system events for code changes."""
    
    def __init__(self, restart_callback):
        super().__init__()
        self.restart_callback = restart_callback
        self.last_restart = 0
        self.debounce_seconds = 1.0  # Wait 1 second after last change before restarting
        
    def on_modified(self, event):
        if not event.is_directory and self._is_python_file(event.src_path):
            self._schedule_restart()
    
    def on_created(self, event):
        if not event.is_directory and self._is_python_file(event.src_path):
            self._schedule_restart()
    
    def _is_python_file(self, path):
        """Check if the file is a Python file we care about."""
        path_obj = Path(path)
        # Only watch .py files, ignore __pycache__ and .pyc files
        if path_obj.suffix != '.py':
            return False
        if '__pycache__' in str(path_obj):
            return False
        return True
    
    def _schedule_restart(self):
        """Schedule a restart after debounce period."""
        current_time = time.time()
        self.last_restart = current_time
        
        # Wait for debounce period, then restart
        time.sleep(self.debounce_seconds)
        
        # Only restart if no new changes occurred during debounce
        if time.time() - self.last_restart >= self.debounce_seconds - 0.1:
            print(f"\n[RELOAD] Code change detected, restarting...")
            self.restart_callback()


class AutoReloader:
    """Manages the auto-reload development server."""
    
    def __init__(self, headless=False):
        self.headless = headless
        self.process = None
        self.observer = None
        self.running = True
        
    def start(self):
        """Start watching and running the application."""
        print("=" * 60)
        print("iRCommander - Development Mode (Auto-Reload)")
        print("=" * 60)
        print(f"Watching: {BASE_DIR}")
        print("Press Ctrl+C to stop")
        print("=" * 60)
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        # Start file watcher
        self._start_watcher()
        
        # Start the application
        self._start_app()
        
        try:
            # Keep the main thread alive
            while self.running:
                time.sleep(0.5)
                
                # Check if process died
                if self.process and self.process.poll() is not None:
                    if self.running:
                        print(f"\n[ERROR] Process exited with code {self.process.returncode}")
                        print("[RELOAD] Restarting in 2 seconds...")
                        time.sleep(2)
                        self._start_app()
        except KeyboardInterrupt:
            pass
        finally:
            self.stop()
    
    def _start_watcher(self):
        """Start the file system watcher."""
        event_handler = CodeChangeHandler(self._restart_app)
        self.observer = Observer()
        self.observer.schedule(event_handler, str(BASE_DIR), recursive=True)
        self.observer.start()
        print("[OK] File watcher started")
    
    def _start_app(self):
        """Start the application process."""
        if self.process and self.process.poll() is None:
            # Process still running, kill it first
            self._stop_app()
        
        # Build command
        cmd = [sys.executable, str(BASE_DIR / "main.py")]
        if self.headless:
            cmd.append("--headless")
        
        print(f"\n[START] Launching: {' '.join(cmd)}")
        
        try:
            self.process = subprocess.Popen(
                cmd,
                cwd=str(BASE_DIR),
                stdout=sys.stdout,
                stderr=sys.stderr,
                env=os.environ.copy()
            )
        except Exception as e:
            print(f"[ERROR] Failed to start process: {e}")
            self.running = False
    
    def _stop_app(self):
        """Stop the application process."""
        if self.process and self.process.poll() is None:
            print("[STOP] Stopping application...")
            try:
                # Try graceful shutdown first
                if sys.platform == 'win32':
                    self.process.terminate()
                else:
                    self.process.send_signal(signal.SIGTERM)
                
                # Wait up to 3 seconds
                try:
                    self.process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    # Force kill if it doesn't stop
                    print("[WARN] Force killing process...")
                    self.process.kill()
                    self.process.wait()
            except Exception as e:
                print(f"[WARN] Error stopping process: {e}")
    
    def _restart_app(self):
        """Restart the application."""
        self._stop_app()
        time.sleep(0.5)  # Brief pause before restart
        self._start_app()
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        print("\n[SHUTDOWN] Received shutdown signal...")
        self.running = False
    
    def stop(self):
        """Stop watching and the application."""
        self.running = False
        
        if self.observer:
            self.observer.stop()
            self.observer.join()
            print("[OK] File watcher stopped")
        
        self._stop_app()
        print("[OK] Shutdown complete")


def main():
    parser = argparse.ArgumentParser(description="iRCommander - Development Auto-Reload")
    parser.add_argument("--headless", "-H", action="store_true",
                       help="Run without GUI")
    
    args = parser.parse_args()
    
    reloader = AutoReloader(headless=args.headless)
    try:
        reloader.start()
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Interrupted by user")
    finally:
        reloader.stop()


if __name__ == "__main__":
    main()


