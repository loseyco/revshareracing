import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
SRC_DIR = ROOT_DIR / "src"
if SRC_DIR.exists() and str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from PySide6.QtWidgets import QApplication

from service import get_service
from ui_qt.main_window import MainWindow


def main():
    service = get_service()
    service.start()

    app = QApplication(sys.argv)
    window = MainWindow(service)
    window.show()

    exit_code = app.exec()

    try:
        service.stop()
    except Exception:
        pass

    sys.exit(exit_code)


if __name__ == "__main__":
    main()

