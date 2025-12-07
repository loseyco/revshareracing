from PySide6.QtCore import Qt
from PySide6.QtWidgets import QFrame, QVBoxLayout, QLabel, QHBoxLayout


class DashboardCard(QFrame):
    """Reusable dashboard card with RaceLab-inspired styling."""

    def __init__(self, title: str, subtitle: str | None = None, parent=None):
        super().__init__(parent)
        self.setObjectName("DashboardCard")
        self.setFrameShape(QFrame.StyledPanel)
        self.setFrameShadow(QFrame.Raised)

        self._outer_layout = QVBoxLayout(self)
        self._outer_layout.setContentsMargins(24, 24, 24, 24)
        self._outer_layout.setSpacing(16)

        header = QHBoxLayout()
        header.setContentsMargins(0, 0, 0, 0)
        header.setSpacing(8)

        self.title_label = QLabel(title)
        self.title_label.setObjectName("CardTitle")
        header.addWidget(self.title_label, alignment=Qt.AlignLeft | Qt.AlignVCenter)

        header.addStretch()
        self._outer_layout.addLayout(header)

        if subtitle:
            subtitle_label = QLabel(subtitle)
            subtitle_label.setObjectName("CardSubtitle")
            subtitle_label.setWordWrap(True)
            self._outer_layout.addWidget(subtitle_label)

    def body_layout(self) -> QVBoxLayout:
        """Return the body layout to populate with content."""
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)
        self._outer_layout.addLayout(layout)
        return layout

