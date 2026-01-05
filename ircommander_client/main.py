"""
iRCommander Client - Entry Point
"""

import sys
import argparse

from config import VERSION


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


