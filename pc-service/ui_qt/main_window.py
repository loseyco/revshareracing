from __future__ import annotations

import json
import time
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

from PySide6.QtCore import Qt, QTimer, Signal, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QMainWindow,
    QWidget,
    QHBoxLayout,
    QVBoxLayout,
    QLabel,
    QPushButton,
    QScrollArea,
    QFrame,
    QGridLayout,
    QSizePolicy,
    QLineEdit,
    QDialog,
    QTabWidget,
    QButtonGroup,
)
from core import device
from service import supabase as supabase_client_global, supabase_service as supabase_service_global
from .widgets import DashboardCard


AUTH_FILE = Path(__file__).resolve().parent.parent / "data" / "auth_token.json"


class MainWindow(QMainWindow):
    status_ready = Signal(dict)
    laps_ready = Signal(list)
    laps_error = Signal(str)
    controls_ready = Signal(dict)
    controls_error = Signal(str)

    """Modern Qt dashboard inspired by RaceLab."""

    def __init__(self, service):
        super().__init__()
        self.service = service
        self.setWindowTitle("iRacing Commander V4")
        self.resize(1400, 900)

        self.supabase_client = supabase_client_global
        self.supabase_service = supabase_service_global or self.supabase_client
        device.get_manager().set_supabase(self.supabase_client)

        self.device_info = device.get_info()
        self.supabase_labels: Dict[str, QLabel] = {}
        self.service_labels: Dict[str, QLabel] = {}
        self.controls_rows: List[QFrame] = []
        self.recent_laps: List[Dict] = []
        self.stats_labels: Dict[str, QLabel] = {}
        self.rig_info_labels: Dict[str, QLabel] = {}
        self.sidebar_button_group: QButtonGroup | None = None
        self.sidebar_buttons: List[QPushButton] = []
        self.controls_bindings: Dict[str, Dict] = {}
        self.controls_last_error: str | None = None
        self.rig_form_status: QLabel | None = None
        self.rig_name_input: QLineEdit | None = None
        self.rig_location_input: QLineEdit | None = None
        self.rig_register_button: QPushButton | None = None
        self.rig_update_button: QPushButton | None = None
        self.rig_claim_button: QPushButton | None = None

        self.is_iracing_connected = False
        self.is_in_car = False
        self.control_buttons: Dict[str, QPushButton] = {}
        self.status_labels: Dict[str, QLabel] = {}
        self.troubleshooting_label: QLabel | None = None

        self.auth_token: str | None = None
        self.refresh_token: str | None = None
        self.user_id: str | None = None
        self.user_email: str | None = None
        self.user_role: str | None = None

        self.laps_refresh_interval = 10
        self.last_laps_refresh = 0

        self._latest_status: Dict | None = None
        self._last_supabase_digest = None
        self._last_rig_refresh = 0
        self.rig_refresh_interval = 15
        self.last_controls_check = 0
        self.controls_check_interval = 5  # Check for controls changes every 5 seconds

        self.status_ready.connect(self._on_status_ready)
        self.laps_ready.connect(self._on_laps_ready)
        self.laps_error.connect(self._on_laps_error)
        self.controls_ready.connect(self._on_controls_ready)
        self.controls_error.connect(self._on_controls_error)
        self._status_inflight = False
        self._laps_inflight = False
        self._controls_inflight = False
        self._pending_laps_force = False

        self._load_auth_token()
        self._verify_auth_token()
        if self.user_email:
            setattr(self.service, "user_email", self.user_email)

        self._build_ui()
        if hasattr(self.service, "on_lap_recorded"):
            self.service.on_lap_recorded = self._handle_lap_recorded
        if hasattr(self.service, "on_command_received"):
            self.service.on_command_received = self._on_command_notification
        self._load_controls(force=True)
        self._fetch_recent_laps(force=True)
        self._update_status_tick()

        self.timer = QTimer(self)
        self.timer.setInterval(1000)
        self.timer.timeout.connect(self._update_status_tick)
        self.timer.start()

    # ------------------------------------------------------------------ UI
    def _build_ui(self):
        self._apply_theme()

        central = QWidget()
        self.setCentralWidget(central)

        root_layout = QHBoxLayout(central)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        sidebar = self._build_sidebar()
        root_layout.addWidget(sidebar)

        main_container = QWidget()
        main_container.setObjectName("MainContainer")
        main_layout = QVBoxLayout(main_container)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        header = self._build_header()
        main_layout.addWidget(header)

        self.tabs = QTabWidget()
        self.tabs.setObjectName("MainTabs")
        self.tabs.setTabPosition(QTabWidget.North)
        self.tabs.setMovable(False)
        self.tabs.setDocumentMode(False)  # Set to False to show tab bar
        self.tabs.currentChanged.connect(self._sync_sidebar_selection)
        main_layout.addWidget(self.tabs)

        root_layout.addWidget(main_container, stretch=1)

        self._build_dashboard_tab()
        self._build_laps_tab()
        self._build_controls_tab()
        self._build_stats_tab()
        self._build_rig_tab()
        self._build_controls_log_tab()

        self._populate_sidebar_nav()

    def _apply_theme(self):
        self.setStyleSheet(
            """
            QMainWindow {
                background-color: #010103;
            }
            QWidget#Sidebar {
                background-color: #040407;
            }
            QWidget#Header {
                background-color: #07060a;
                border-bottom: 1px solid rgba(255, 23, 68, 0.6);
            }
            QWidget#MainContainer {
                background-color: transparent;
            }
            QLabel#Brand {
                color: #ffffff;
                font-size: 22px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            QLabel#HeaderMeta {
                color: #d5d7e0;
                font-size: 12px;
            }
            QPushButton {
                border-radius: 10px;
                padding: 10px 18px;
                color: #ffffff;
                background-color: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.12);
            }
            QPushButton:hover {
                background-color: rgba(255, 255, 255, 0.16);
            }
            QPushButton:pressed {
                background-color: rgba(255, 255, 255, 0.28);
            }
            QPushButton#Primary {
                background-color: #ff1744;
                border: 1px solid rgba(255, 23, 68, 0.85);
                color: #ffffff;
            }
            QPushButton#Primary:hover {
                background-color: #ff315a;
            }
            QPushButton#SidebarButton {
                border-radius: 12px;
                background-color: transparent;
                border: none;
                padding: 12px 16px;
                color: #c2c4cf;
                text-align: left;
            }
            QPushButton#SidebarButton:hover {
                background-color: rgba(255, 23, 68, 0.22);
                color: #ffffff;
            }
            QPushButton#SidebarButton:checked {
                background-color: rgba(255, 23, 68, 0.38);
                color: #ffffff;
            }
            QLineEdit {
                border-radius: 8px;
                padding: 8px 12px;
                background-color: #0f111a;
                border: 1px solid rgba(255, 255, 255, 0.08);
                color: #f2f4fb;
                selection-background-color: rgba(255, 33, 59, 0.6);
            }
            QLineEdit#ControlsFilter {
                min-width: 200px;
            }
            QTabWidget::pane {
                border: none;
                background: transparent;
            }
            QTabBar {
                background: transparent;
            }
            QTabBar::tab {
                background: #0d0f16;
                color: #c9cbd6;
                padding: 10px 22px;
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
                margin-right: 6px;
                border: 1px solid rgba(255, 255, 255, 0.05);
                min-width: 100px;
            }
            QTabBar::tab:hover {
                background: #151823;
                color: #ffffff;
            }
            QTabBar::tab:selected {
                background: #ff1744;
                color: #ffffff;
                border: 1px solid #ff1744;
            }
            QScrollArea {
                background: transparent;
            }
            QFrame#DashboardCard {
                background-color: #07080f;
                border: 1px solid rgba(255, 23, 68, 0.5);
                border-radius: 18px;
            }
            QFrame#LapRow {
                background-color: #0b0d16;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
            }
            QLabel#CardTitle {
                color: #ffffff;
                font-size: 16px;
                font-weight: 600;
            }
            QLabel#CardSubtitle {
                color: #e1e3ec;
                font-size: 12px;
            }
            QLabel#ValueLabel {
                color: #ffffff;
                font-size: 14px;
            }
            QLabel#MetaLabel {
                color: #d0d2df;
                font-size: 12px;
            }
            """
        )

    def _build_sidebar(self) -> QWidget:
        sidebar = QWidget()
        sidebar.setObjectName("Sidebar")
        sidebar.setFixedWidth(220)
        layout = QVBoxLayout(sidebar)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(12)

        brand = QLabel("IR Commander")
        brand.setObjectName("Brand")
        layout.addWidget(brand)

        meta = QLabel("Control & telemetry hub")
        meta.setObjectName("HeaderMeta")
        layout.addWidget(meta)

        layout.addSpacing(12)

        self.sidebar_nav_container = QWidget()
        self.sidebar_nav_layout = QVBoxLayout(self.sidebar_nav_container)
        self.sidebar_nav_layout.setContentsMargins(0, 0, 0, 0)
        self.sidebar_nav_layout.setSpacing(6)
        layout.addWidget(self.sidebar_nav_container)

        layout.addStretch()

        return sidebar

    def _populate_sidebar_nav(self):
        if not hasattr(self, "sidebar_nav_layout") or not hasattr(self, "tabs"):
            return

        while self.sidebar_nav_layout.count():
            item = self.sidebar_nav_layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()

        self.sidebar_buttons = []
        self.sidebar_button_group = QButtonGroup(self)
        self.sidebar_button_group.setExclusive(True)
        for index in range(self.tabs.count()):
            title = self.tabs.tabText(index)
            button = QPushButton(title)
            button.setObjectName("SidebarButton")
            button.setCursor(Qt.PointingHandCursor)
            button.setCheckable(True)
            button.clicked.connect(lambda _, i=index: self.tabs.setCurrentIndex(i))
            self.sidebar_button_group.addButton(button, index)
            self.sidebar_nav_layout.addWidget(button)
            self.sidebar_buttons.append(button)

        self._sync_sidebar_selection(self.tabs.currentIndex())

    def _sync_sidebar_selection(self, index: int):
        if self.sidebar_button_group:
            button = self.sidebar_button_group.button(index)
            if button and not button.isChecked():
                button.setChecked(True)
        if hasattr(self, "header_title") and hasattr(self, "tabs"):
            if 0 <= index < self.tabs.count():
                self.header_title.setText(self.tabs.tabText(index))

    def _build_header(self) -> QWidget:
        header = QWidget()
        header.setObjectName("Header")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(32, 16, 32, 16)
        header_layout.setSpacing(12)

        title = QLabel("Dashboard Overview")
        title.setObjectName("Brand")
        header_layout.addWidget(title)
        self.header_title = title

        header_layout.addStretch()

        self.user_label = QLabel("")
        self.user_label.setObjectName("HeaderMeta")
        header_layout.addWidget(self.user_label)

        self.header_actions_widget = QWidget()
        self.header_actions_layout = QHBoxLayout(self.header_actions_widget)
        self.header_actions_layout.setContentsMargins(0, 0, 0, 0)
        self.header_actions_layout.setSpacing(8)
        header_layout.addWidget(self.header_actions_widget)

        self._refresh_header_actions()

        return header

    def _refresh_header_actions(self):
        if not hasattr(self, "header_actions_layout"):
            return

        while self.header_actions_layout.count():
            item = self.header_actions_layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()

        if self.user_id:
            self.user_label.setText(self.user_email or "Signed in")

            logout_btn = QPushButton("Logout")
            logout_btn.setObjectName("SidebarButton")
            logout_btn.setCursor(Qt.PointingHandCursor)
            logout_btn.clicked.connect(self._logout)
            self.header_actions_layout.addWidget(logout_btn)
        else:
            self.user_label.setText("Not signed in")

            login_btn = QPushButton("Login")
            login_btn.setObjectName("SidebarButton")
            login_btn.setCursor(Qt.PointingHandCursor)
            login_btn.clicked.connect(self._show_login_dialog)
            self.header_actions_layout.addWidget(login_btn)

            register_btn = QPushButton("Register")
            register_btn.setObjectName("SidebarButton")
            register_btn.setCursor(Qt.PointingHandCursor)
            register_btn.clicked.connect(self._show_register_dialog)
            self.header_actions_layout.addWidget(register_btn)

    def _build_dashboard_tab(self):
        tab = QWidget()
        grid = QGridLayout(tab)
        grid.setContentsMargins(32, 28, 32, 32)
        grid.setHorizontalSpacing(24)
        grid.setVerticalSpacing(24)

        self.status_card = DashboardCard("System Status", "Connection health and rig registration.")
        self._populate_status_card()
        grid.addWidget(self.status_card, 0, 0)

        self.supabase_card = DashboardCard("Supabase & Device", "Device metadata synced with Supabase backend.")
        self._populate_supabase_card()
        grid.addWidget(self.supabase_card, 0, 1)

        self.service_card = DashboardCard("Service Telemetry", "Real-time state of the local commander service.")
        self._populate_service_card()
        grid.addWidget(self.service_card, 1, 0)

        self.troubleshooting_card = DashboardCard("Troubleshooting", "Tips and warnings when something needs attention.")
        self._populate_troubleshooting_card()
        grid.addWidget(self.troubleshooting_card, 1, 1)

        grid.setColumnStretch(0, 1)
        grid.setColumnStretch(1, 1)
        grid.setRowStretch(0, 1)
        grid.setRowStretch(1, 1)

        self.tabs.addTab(tab, "Overview")

    def _build_laps_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(32, 28, 32, 32)
        layout.setSpacing(24)

        self.laps_card = DashboardCard("Recent Laps", "Latest completed laps synced with Supabase.")
        self._populate_laps_card()
        layout.addWidget(self.laps_card)
        layout.setStretch(0, 1)

        self.tabs.addTab(tab, "Recent Laps")

    def _build_controls_tab(self):
        tab = QWidget()
        tab_layout = QVBoxLayout(tab)
        tab_layout.setContentsMargins(0, 0, 0, 0)
        tab_layout.setSpacing(0)
        
        # Create scroll area for controls tab
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.NoFrame)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        scroll_content = QWidget()
        layout = QVBoxLayout(scroll_content)
        layout.setContentsMargins(32, 28, 32, 32)
        layout.setSpacing(24)

        self.controls_card = DashboardCard("Commander Controls", "Trigger in-sim actions via mapped keys.")
        self._populate_controls_card()
        layout.addWidget(self.controls_card)
        layout.addStretch()
        
        scroll_area.setWidget(scroll_content)
        tab_layout.addWidget(scroll_area)

        self.tabs.addTab(tab, "Commander Controls")

    def _build_stats_tab(self):
        tab = QWidget()
        tab_layout = QVBoxLayout(tab)
        tab_layout.setContentsMargins(0, 0, 0, 0)
        tab_layout.setSpacing(0)
        
        # Create scroll area for stats tab
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.NoFrame)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        scroll_content = QWidget()
        layout = QVBoxLayout(scroll_content)
        layout.setContentsMargins(32, 28, 32, 32)
        layout.setSpacing(24)

        self.stats_card = DashboardCard("Rig Stats", "High-level metrics from your session history.")
        self._populate_stats_card()
        layout.addWidget(self.stats_card)
        layout.addStretch()
        
        scroll_area.setWidget(scroll_content)
        tab_layout.addWidget(scroll_area)

        self.tabs.addTab(tab, "Stats")

    def _build_rig_tab(self):
        tab = QWidget()
        tab_layout = QVBoxLayout(tab)
        tab_layout.setContentsMargins(0, 0, 0, 0)
        tab_layout.setSpacing(0)
        
        # Create scroll area for rig tab
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.NoFrame)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        scroll_content = QWidget()
        layout = QVBoxLayout(scroll_content)
        layout.setContentsMargins(32, 28, 32, 32)
        layout.setSpacing(24)

        self.rig_info_card = DashboardCard("Rig Status", "Current registration and network details.")
        self._populate_rig_info_card()
        layout.addWidget(self.rig_info_card)

        self.rig_manage_card = DashboardCard("Manage Rig", "Register or update your local rig details.")
        self._populate_rig_manage_card()
        layout.addWidget(self.rig_manage_card)

        layout.addStretch()
        
        scroll_area.setWidget(scroll_content)
        tab_layout.addWidget(scroll_area)

        self.tabs.addTab(tab, "Rig Management")

    def _build_controls_log_tab(self):
        """Build Controls Log tab to show executed control actions"""
        tab = QWidget()
        tab_layout = QVBoxLayout(tab)
        tab_layout.setContentsMargins(0, 0, 0, 0)
        tab_layout.setSpacing(0)
        
        # Create scroll area
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.NoFrame)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        scroll_content = QWidget()
        layout = QVBoxLayout(scroll_content)
        layout.setContentsMargins(32, 28, 32, 32)
        layout.setSpacing(24)

        self.controls_log_card = DashboardCard("Controls Log", "Recent control actions executed by the system.")
        self._populate_controls_log_card()
        layout.addWidget(self.controls_log_card)
        layout.addStretch()
        
        scroll_area.setWidget(scroll_content)
        tab_layout.addWidget(scroll_area)

        self.tabs.addTab(tab, "Controls Log")

    def _populate_service_card(self):
        layout = self.service_card.body_layout()
        layout.setSpacing(8)

        def add_row(label: str) -> QLabel:
            row = QHBoxLayout()
            row.setContentsMargins(0, 0, 0, 0)
            row.setSpacing(6)
            label_widget = QLabel(label)
            label_widget.setObjectName("MetaLabel")
            value_label = QLabel("...")
            value_label.setObjectName("ValueLabel")
            row.addWidget(label_widget)
            row.addStretch()
            row.addWidget(value_label, alignment=Qt.AlignRight)
            layout.addLayout(row)
            return value_label

        self.service_labels["status"] = add_row("Service:")
        self.service_labels["iracing"] = add_row("iRacing:")
        self.service_labels["lap"] = add_row("Current Lap:")
        self.service_labels["speed"] = add_row("Speed:")
        self.service_labels["rpm"] = add_row("RPM:")
        self.service_labels["last_update"] = add_row("Last Update:")

    def _populate_supabase_card(self):
        layout = self.supabase_card.body_layout()
        layout.setSpacing(8)

        def add_row(label: str) -> QLabel:
            row = QHBoxLayout()
            label_widget = QLabel(label)
            label_widget.setObjectName("MetaLabel")
            value_label = QLabel("...")
            value_label.setObjectName("ValueLabel")
            row.addWidget(label_widget)
            row.addStretch()
            row.addWidget(value_label, alignment=Qt.AlignRight)
            layout.addLayout(row)
            return value_label

        for key in [
            "device_id",
            "device_name",
            "status_text",
            "owner",
            "session_laps",
            "total_laps",
            "last_sync",
            "last_seen",
            "location",
            "local_ip",
            "public_ip",
        ]:
            self.supabase_labels[key] = add_row(key.replace("_", " ").title())

    def _populate_status_card(self):
        layout = self.status_card.body_layout()
        layout.setSpacing(8)

        def add_row(label: str) -> QLabel:
            row = QHBoxLayout()
            row.setContentsMargins(0, 0, 0, 0)
            row.setSpacing(6)
            label_widget = QLabel(label)
            label_widget.setObjectName("MetaLabel")
            value_label = QLabel("...")
            value_label.setObjectName("ValueLabel")
            row.addWidget(label_widget)
            row.addStretch()
            row.addWidget(value_label, alignment=Qt.AlignRight)
            layout.addLayout(row)
            return value_label

        self.status_labels["telemetry"] = add_row("Telemetry:")
        self.status_labels["in_car"] = add_row("Driver State:")
        self.status_labels["database"] = add_row("Database:")
        self.status_labels["device"] = add_row("Rig Registration:")
        self.status_labels["last_sync"] = add_row("Last Sync:")
        self.status_labels["total_laps"] = add_row("Total Laps:")
        self.status_labels["total_drivers"] = add_row("Total Drivers:")

    def _populate_troubleshooting_card(self):
        layout = self.troubleshooting_card.body_layout()
        layout.setSpacing(8)
        self.troubleshooting_label = QLabel("All systems nominal.")
        self.troubleshooting_label.setObjectName("MetaLabel")
        self.troubleshooting_label.setWordWrap(True)
        layout.addWidget(self.troubleshooting_label)

    def _populate_controls_card(self):
        body_layout = self.controls_card.body_layout()
        body_layout.setSpacing(12)

        info_row = QHBoxLayout()
        info_row.setContentsMargins(0, 0, 0, 0)

        self.controls_status_label = QLabel("")
        self.controls_status_label.setObjectName("MetaLabel")
        info_row.addWidget(self.controls_status_label)
        info_row.addStretch()

        reload_btn = QPushButton("Reload Mappings")
        reload_btn.setCursor(Qt.PointingHandCursor)
        reload_btn.clicked.connect(lambda: self._load_controls(force=True))
        info_row.addWidget(reload_btn)

        body_layout.addLayout(info_row)

        filter_row = QHBoxLayout()
        filter_row.setContentsMargins(0, 0, 0, 0)
        filter_row.setSpacing(10)

        filter_hint = QLabel("Filter")
        filter_hint.setObjectName("MetaLabel")
        filter_row.addWidget(filter_hint)

        self.controls_filter_input = QLineEdit()
        self.controls_filter_input.setObjectName("ControlsFilter")
        self.controls_filter_input.setPlaceholderText("Search controls…")
        self.controls_filter_input.textChanged.connect(lambda _: self._render_controls())
        filter_row.addWidget(self.controls_filter_input, stretch=1)

        body_layout.addLayout(filter_row)

        self.controls_container = QWidget()
        self.controls_layout = QGridLayout(self.controls_container)
        self.controls_layout.setContentsMargins(0, 0, 0, 0)
        self.controls_layout.setHorizontalSpacing(16)
        self.controls_layout.setVerticalSpacing(12)

        body_layout.addWidget(self.controls_container)

        self.controls_feedback = QLabel("")
        self.controls_feedback.setObjectName("MetaLabel")
        body_layout.addWidget(self.controls_feedback)
        self.controls_status_label.setText("Loading controls...")
        # Initialize keys display
        QTimer.singleShot(0, lambda: self._update_rig_keys_display())
    
    def _populate_controls_log_card(self):
        """Populate the controls log card with action history"""
        body_layout = self.controls_log_card.body_layout()
        body_layout.setSpacing(12)

        # Info row with buttons
        info_row = QHBoxLayout()
        info_row.setContentsMargins(0, 0, 0, 0)

        self.controls_log_status_label = QLabel("")
        self.controls_log_status_label.setObjectName("MetaLabel")
        info_row.addWidget(self.controls_log_status_label)
        info_row.addStretch()

        test_btn = QPushButton("Test Control")
        test_btn.setCursor(Qt.PointingHandCursor)
        test_btn.setObjectName("Primary")
        test_btn.clicked.connect(self._test_control_action)
        info_row.addWidget(test_btn)

        clear_btn = QPushButton("Clear Log")
        clear_btn.setCursor(Qt.PointingHandCursor)
        clear_btn.clicked.connect(self._clear_controls_log)
        info_row.addWidget(clear_btn)

        body_layout.addLayout(info_row)

        # Log container
        self.controls_log_container = QWidget()
        self.controls_log_layout = QVBoxLayout(self.controls_log_container)
        self.controls_log_layout.setContentsMargins(0, 0, 0, 0)
        self.controls_log_layout.setSpacing(8)

        log_scroll = QScrollArea()
        log_scroll.setWidgetResizable(True)
        log_scroll.setFrameShape(QFrame.NoFrame)
        log_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        log_scroll.setWidget(self.controls_log_container)
        
        body_layout.addWidget(log_scroll, stretch=1)
        
        # Update log display
        self._update_controls_log_display()
        
        # Refresh log every 2 seconds
        if not hasattr(self, 'log_refresh_timer'):
            self.log_refresh_timer = QTimer(self)
            self.log_refresh_timer.timeout.connect(self._update_controls_log_display)
            self.log_refresh_timer.start(2000)
    
    def _update_controls_log_display(self):
        """Update the controls log display"""
        if not hasattr(self, "controls_log_layout") or not self.service:
            return
        
        try:
            controls_manager = getattr(self.service, "controls_manager", None)
            if not controls_manager:
                return
            
            log_entries = controls_manager.get_action_log(limit=50)
            
            # Clear existing entries
            while self.controls_log_layout.count():
                item = self.controls_log_layout.takeAt(0)
                widget = item.widget()
                if widget:
                    widget.deleteLater()
            
            if not log_entries:
                no_entries = QLabel("No control actions logged yet. Use 'Test Control' to verify the system.")
                no_entries.setObjectName("MetaLabel")
                self.controls_log_layout.addWidget(no_entries)
                if hasattr(self, 'controls_log_status_label'):
                    self.controls_log_status_label.setText("No entries")
                return
            
            # Display entries (newest first)
            for entry in reversed(log_entries):
                row = QWidget()
                row_layout = QHBoxLayout(row)
                row_layout.setContentsMargins(12, 8, 12, 8)
                row_layout.setSpacing(12)
                row.setObjectName("DashboardCard")
                
                # Timestamp
                from datetime import datetime
                timestamp = datetime.fromtimestamp(entry['timestamp']).strftime("%H:%M:%S")
                time_label = QLabel(timestamp)
                time_label.setObjectName("MetaLabel")
                time_label.setFixedWidth(70)
                row_layout.addWidget(time_label)
                
                # Action/Combo - show formatted key message if available
                action_text = entry.get('action', 'combo')
                key_message = entry.get('key_message', '')
                combo_text = entry.get('combo', 'N/A')
                
                if key_message:
                    # Use the formatted key message (e.g., "pressed the R key")
                    if action_text == 'combo':
                        action_display = key_message
                    else:
                        action_display = f"{action_text} - {key_message}"
                else:
                    # Fallback to old format
                    if action_text == 'combo':
                        action_display = f"Key: {combo_text}"
                    else:
                        action_display = f"{action_text}"
                        if combo_text and combo_text != 'N/A':
                            action_display += f" ({combo_text})"
                
                action_label = QLabel(action_display)
                action_label.setObjectName("ValueLabel")
                row_layout.addWidget(action_label, stretch=2)
                
                # Source
                source_label = QLabel(entry.get('source', 'unknown').title())
                source_label.setObjectName("MetaLabel")
                source_label.setFixedWidth(80)
                row_layout.addWidget(source_label)
                
                # Status
                success = entry.get('success', False)
                status_text = "✓ Success" if success else "✗ Failed"
                status_label = QLabel(status_text)
                status_label.setObjectName("ValueLabel" if success else "MetaLabel")
                status_label.setStyleSheet(
                    f"color: {'#35d48b' if success else '#ff647c'};"
                )
                row_layout.addWidget(status_label, stretch=1)
                
                # Message
                message = entry.get('message', '')
                if message:
                    message_label = QLabel(message)
                    message_label.setObjectName("MetaLabel")
                    message_label.setWordWrap(True)
                    row_layout.addWidget(message_label, stretch=2)
                
                self.controls_log_layout.addWidget(row)
            
            if hasattr(self, 'controls_log_status_label'):
                self.controls_log_status_label.setText(f"{len(log_entries)} entries")
            
        except Exception as e:
            print(f"[WARN] Failed to update controls log: {e}")
    
    def _test_control_action(self):
        """Test a control action (works even without iRacing)"""
        if not self.service:
            return
        
        try:
            controls_manager = getattr(self.service, "controls_manager", None)
            if not controls_manager:
                return
            
            # Get first available control action
            bindings = controls_manager.get_bindings()
            if not bindings:
                if hasattr(self, 'controls_log_status_label'):
                    self.controls_log_status_label.setText("No controls configured")
                return
            
            # Try to find a simple action to test
            test_action = None
            for action in ["starter", "ignition", "pit_speed_limiter"]:
                if action in bindings and bindings[action].get("combo"):
                    test_action = action
                    break
            
            if not test_action:
                # Use first available action
                test_action = list(bindings.keys())[0]
            
            combo = bindings[test_action].get("combo")
            if combo:
                # Execute directly (bypasses iRacing check for testing)
                success = controls_manager.execute_combo(combo, source="test")
                if hasattr(self, 'controls_log_status_label'):
                    if success:
                        self.controls_log_status_label.setText(f"Test executed: {combo}")
                    else:
                        self.controls_log_status_label.setText(f"Test failed: {combo}")
            else:
                if hasattr(self, 'controls_log_status_label'):
                    self.controls_log_status_label.setText("No key binding to test")
        except Exception as e:
            if hasattr(self, 'controls_log_status_label'):
                self.controls_log_status_label.setText(f"Test error: {str(e)}")
    
    def _clear_controls_log(self):
        """Clear the controls log"""
        if not self.service:
            return
        try:
            controls_manager = getattr(self.service, "controls_manager", None)
            if controls_manager:
                controls_manager._action_log.clear()
                self._update_controls_log_display()
        except Exception as e:
            print(f"[WARN] Failed to clear controls log: {e}")

    def _populate_rig_info_card(self):
        layout = self.rig_info_card.body_layout()
        layout.setSpacing(8)

        def add_row(label: str) -> QLabel:
            row = QHBoxLayout()
            row.setContentsMargins(0, 0, 0, 0)
            row.setSpacing(6)
            label_widget = QLabel(label)
            label_widget.setObjectName("MetaLabel")
            value_label = QLabel("--")
            value_label.setObjectName("ValueLabel")
            row.addWidget(label_widget)
            row.addStretch()
            row.addWidget(value_label, alignment=Qt.AlignRight)
            layout.addLayout(row)
            return value_label

        keys = [
            ("device_id", "Device ID"),
            ("device_name", "Device Name"),
            ("status", "Status"),
            ("owner", "Owner"),
            ("registered_at", "Registered At"),
            ("last_seen", "Last Seen"),
            ("location", "Location"),
            ("local_ip", "Local IP"),
            ("public_ip", "Public IP"),
        ]

        for key, label in keys:
            self.rig_info_labels[key] = add_row(label)

        # Add separator and Registered Keys section
        separator = QFrame()
        separator.setFrameShape(QFrame.HLine)
        separator.setFrameShadow(QFrame.Sunken)
        separator.setObjectName("Separator")
        layout.addWidget(separator)

        keys_header = QLabel("Registered Keys")
        keys_header.setObjectName("ValueLabel")
        layout.addWidget(keys_header)

        self.rig_keys_container = QWidget()
        self.rig_keys_layout = QVBoxLayout(self.rig_keys_container)
        self.rig_keys_layout.setContentsMargins(0, 4, 0, 0)
        self.rig_keys_layout.setSpacing(4)
        layout.addWidget(self.rig_keys_container)

        # Add Claim Rig button
        claim_button_row = QHBoxLayout()
        claim_button_row.setContentsMargins(0, 12, 0, 0)
        claim_button_row.addStretch()
        
        self.rig_claim_button = QPushButton("Claim This Rig")
        self.rig_claim_button.setObjectName("Primary")
        self.rig_claim_button.setCursor(Qt.PointingHandCursor)
        self.rig_claim_button.clicked.connect(self._handle_claim_rig)
        claim_button_row.addWidget(self.rig_claim_button)
        
        layout.addLayout(claim_button_row)

    def _populate_rig_manage_card(self):
        layout = self.rig_manage_card.body_layout()
        layout.setSpacing(16)

        self.rig_form_status = QLabel("Login to manage this rig.")
        self.rig_form_status.setObjectName("MetaLabel")
        layout.addWidget(self.rig_form_status)

        form_layout = QVBoxLayout()
        form_layout.setSpacing(12)

        name_label = QLabel("Rig Name")
        name_label.setObjectName("MetaLabel")
        form_layout.addWidget(name_label)

        self.rig_name_input = QLineEdit()
        self.rig_name_input.setPlaceholderText("Enter a friendly name (e.g. Rig #1)")
        form_layout.addWidget(self.rig_name_input)

        location_label = QLabel("Location")
        location_label.setObjectName("MetaLabel")
        form_layout.addWidget(location_label)

        self.rig_location_input = QLineEdit()
        self.rig_location_input.setPlaceholderText("Optional: Home Office, Sim Room, etc.")
        form_layout.addWidget(self.rig_location_input)

        layout.addLayout(form_layout)

        buttons_row = QHBoxLayout()
        buttons_row.setSpacing(12)

        self.rig_register_button = QPushButton("Register Rig")
        self.rig_register_button.setObjectName("Primary")
        self.rig_register_button.setCursor(Qt.PointingHandCursor)
        self.rig_register_button.clicked.connect(self._handle_register_rig)
        buttons_row.addWidget(self.rig_register_button)

        self.rig_update_button = QPushButton("Update Rig")
        self.rig_update_button.setCursor(Qt.PointingHandCursor)
        self.rig_update_button.clicked.connect(self._handle_update_rig)
        buttons_row.addWidget(self.rig_update_button)

        layout.addLayout(buttons_row)

        # Ensure initial state reflects current registration
        QTimer.singleShot(0, lambda: self._refresh_rig_info())

    def _populate_stats_card(self):
        layout = self.stats_card.body_layout()
        layout.setSpacing(8)

        def add_row(label: str) -> QLabel:
            row = QHBoxLayout()
            row.setContentsMargins(0, 0, 0, 0)
            row.setSpacing(6)
            label_widget = QLabel(label)
            label_widget.setObjectName("MetaLabel")
            value_label = QLabel("--")
            value_label.setObjectName("ValueLabel")
            row.addWidget(label_widget)
            row.addStretch()
            row.addWidget(value_label, alignment=Qt.AlignRight)
            layout.addLayout(row)
            return value_label

        self.stats_labels = {
            "total_laps": add_row("Total Laps Recorded:"),
            "session_laps": add_row("Session Laps:"),
            "best_lap": add_row("Best Lap:"),
            "last_lap": add_row("Last Lap:"),
            "avg_recent": add_row("Avg (Last 5):"),
            "last_timestamp": add_row("Last Lap Time:"),
        }

    def _update_stats(self):
        if not self.stats_labels:
            return

        total = getattr(self.service, "laps_total_recorded", 0)
        session = getattr(self.service, "laps_recorded_session", 0)
        self.stats_labels["total_laps"].setText(str(total))
        self.stats_labels["session_laps"].setText(str(session))

        lap_times = []
        for lap in self.recent_laps:
            lap_time = lap.get("lap_time")
            try:
                lap_times.append(float(lap_time))
            except (TypeError, ValueError):
                continue

        if lap_times:
            self.stats_labels["best_lap"].setText(self._format_lap_time(min(lap_times)))
            self.stats_labels["last_lap"].setText(self._format_lap_time(lap_times[0]))

            recent_slice = lap_times[:5]
            average_recent = sum(recent_slice) / len(recent_slice)
            self.stats_labels["avg_recent"].setText(self._format_lap_time(average_recent))
        else:
            self.stats_labels["best_lap"].setText("--")
            self.stats_labels["last_lap"].setText("--")
            self.stats_labels["avg_recent"].setText("--")

        if self.recent_laps:
            timestamp = self.recent_laps[0].get("timestamp")
            self.stats_labels["last_timestamp"].setText(self._format_relative_time(timestamp))
        else:
            self.stats_labels["last_timestamp"].setText("No laps yet")

    def _update_troubleshooting_messages(self, supabase: Dict, iracing: Dict):
        if not self.troubleshooting_label:
            return

        issues: List[str] = []

        if not bool(supabase.get("connected")):
            issues.append("Supabase not connected. Check internet connection and credentials.")

        device_registered = bool(supabase.get("device_id") or (self.device_info or {}).get("device_id"))
        if not device_registered:
            issues.append("Rig not registered. Use the Rig Management tab to register this device.")

        if not self.is_iracing_connected:
            issues.append("iRacing telemetry offline. Launch iRacing or verify the sim is running.")
        elif not self.is_in_car:
            issues.append("Driver not in car. Enter the car to enable most controls.")

        if iracing.get("in_pit_stall"):
            issues.append("Driver in pit stall. Some controls may be blocked by iRacing.")

        if self.controls_last_error:
            issues.append(f"Controls warning: {self.controls_last_error}")

        if not issues:
            self.troubleshooting_label.setText("All systems nominal. No active issues detected.")
            self.troubleshooting_label.setStyleSheet("color: #35d48b;")
        else:
            self.troubleshooting_label.setText("• " + "\n• ".join(issues))
            self.troubleshooting_label.setStyleSheet("color: #ffb347;")

        # ------------------------------------------------------------------ Recent laps card
    def _populate_laps_card(self):
        layout = self.laps_card.body_layout()
        layout.setSpacing(12)

        self.laps_status_label = QLabel("Loading laps...")
        self.laps_status_label.setObjectName("MetaLabel")
        layout.addWidget(self.laps_status_label)

        self.laps_scroll = QScrollArea()
        self.laps_scroll.setWidgetResizable(True)
        self.laps_scroll.setFrameShape(QFrame.NoFrame)
        self.laps_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.laps_scroll.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.laps_list_container = QWidget()
        self.laps_list_layout = QVBoxLayout(self.laps_list_container)
        self.laps_list_layout.setContentsMargins(0, 0, 0, 0)
        self.laps_list_layout.setSpacing(6)

        self.laps_scroll.setWidget(self.laps_list_container)
        layout.addWidget(self.laps_scroll, stretch=1)

        refresh_btn = QPushButton("Refresh Laps")
        refresh_btn.setCursor(Qt.PointingHandCursor)
        refresh_btn.clicked.connect(lambda: self._fetch_recent_laps(force=True))
        layout.addWidget(refresh_btn, alignment=Qt.AlignRight)

    # ------------------------------------------------------------------ Auth workflows
    def _show_login_dialog(self):
        dialog = QDialog(self)
        dialog.setWindowTitle("Login - iRacing Commander")
        dialog.setModal(True)

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(32, 24, 32, 24)
        layout.setSpacing(16)

        title = QLabel("Sign in to manage your rig")
        title.setObjectName("CardTitle")
        layout.addWidget(title)

        email_input = QLineEdit()
        email_input.setPlaceholderText("Email")
        email_input.setText(self.user_email or "")
        layout.addWidget(email_input)

        password_input = QLineEdit()
        password_input.setPlaceholderText("Password")
        password_input.setEchoMode(QLineEdit.Password)
        layout.addWidget(password_input)

        status_label = QLabel("")
        status_label.setObjectName("MetaLabel")
        layout.addWidget(status_label)

        buttons_row = QHBoxLayout()
        buttons_row.setSpacing(10)

        login_btn = QPushButton("Login")
        login_btn.setObjectName("Primary")
        login_btn.setCursor(Qt.PointingHandCursor)
        login_btn.clicked.connect(
            lambda: self._attempt_login(
                email_input.text().strip(),
                password_input.text(),
                status_label,
                dialog,
            )
        )
        buttons_row.addWidget(login_btn)

        cancel_btn = QPushButton("Cancel")
        cancel_btn.setCursor(Qt.PointingHandCursor)
        cancel_btn.clicked.connect(dialog.reject)
        buttons_row.addWidget(cancel_btn)

        layout.addLayout(buttons_row)

        register_link = QPushButton("Need an account? Register")
        register_link.setObjectName("SidebarButton")
        register_link.setCursor(Qt.PointingHandCursor)
        register_link.clicked.connect(lambda: (dialog.reject(), self._show_register_dialog()))
        layout.addWidget(register_link, alignment=Qt.AlignRight)

        dialog.exec()

    def _attempt_login(self, email: str, password: str, status_label: QLabel, dialog: QDialog):
        if not email or not password:
            status_label.setText("Enter email and password.")
            status_label.setStyleSheet("color: #ff647c;")
            return

        status_label.setText("Logging in...")
        status_label.setStyleSheet("color: #97a2b3;")
        status_label.repaint()

        try:
            if not self.supabase_client:
                raise RuntimeError("Supabase client not available")

            auth_response = self.supabase_client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )

            if auth_response and auth_response.user:
                self._on_login_success(auth_response.session, auth_response.user)
                status_label.setText("Login successful!")
                status_label.setStyleSheet("color: #35d48b;")
                dialog.accept()
                self._fetch_recent_laps(force=True)
                return

            status_label.setText("Invalid email or password.")
            status_label.setStyleSheet("color: #ff647c;")
        except Exception as exc:
            status_label.setText(f"Login failed: {exc}")
            status_label.setStyleSheet("color: #ff647c;")
            print(f"[ERROR] Login failed: {exc}")

    def _show_register_dialog(self):
        dialog = QDialog(self)
        dialog.setWindowTitle("Create Account - iRacing Commander")
        dialog.setModal(True)

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(32, 24, 32, 24)
        layout.setSpacing(16)

        title = QLabel("Create a new account")
        title.setObjectName("CardTitle")
        layout.addWidget(title)

        email_input = QLineEdit()
        email_input.setPlaceholderText("Email")
        layout.addWidget(email_input)

        password_input = QLineEdit()
        password_input.setPlaceholderText("Password (min 6 chars)")
        password_input.setEchoMode(QLineEdit.Password)
        layout.addWidget(password_input)

        confirm_input = QLineEdit()
        confirm_input.setPlaceholderText("Confirm password")
        confirm_input.setEchoMode(QLineEdit.Password)
        layout.addWidget(confirm_input)

        status_label = QLabel("")
        status_label.setObjectName("MetaLabel")
        layout.addWidget(status_label)

        buttons_row = QHBoxLayout()
        buttons_row.setSpacing(10)

        register_btn = QPushButton("Register")
        register_btn.setObjectName("Primary")
        register_btn.setCursor(Qt.PointingHandCursor)
        register_btn.clicked.connect(
            lambda: self._attempt_register(
                email_input.text().strip(),
                password_input.text(),
                confirm_input.text(),
                status_label,
                dialog,
            )
        )
        buttons_row.addWidget(register_btn)

        cancel_btn = QPushButton("Cancel")
        cancel_btn.setCursor(Qt.PointingHandCursor)
        cancel_btn.clicked.connect(dialog.reject)
        buttons_row.addWidget(cancel_btn)

        layout.addLayout(buttons_row)

        dialog.exec()

    def _attempt_register(
        self,
        email: str,
        password: str,
        confirm_password: str,
        status_label: QLabel,
        dialog: QDialog,
    ):
        if not email or not password or not confirm_password:
            status_label.setText("Fill in all fields.")
            status_label.setStyleSheet("color: #ff647c;")
            return

        if password != confirm_password:
            status_label.setText("Passwords do not match.")
            status_label.setStyleSheet("color: #ff647c;")
            return

        if len(password) < 6:
            status_label.setText("Password must be at least 6 characters.")
            status_label.setStyleSheet("color: #ff647c;")
            return

        status_label.setText("Creating account...")
        status_label.setStyleSheet("color: #97a2b3;")
        status_label.repaint()

        try:
            if not self.supabase_client:
                raise RuntimeError("Supabase client not available")

            auth_response = self.supabase_client.auth.sign_up({"email": email, "password": password})

            if auth_response and auth_response.user:
                status_label.setText("Account created! Signing in...")
                status_label.setStyleSheet("color: #35d48b;")
                # Auto-login after successful registration
                self._attempt_login(email, password, status_label, dialog)
                return

            status_label.setText("Registration failed. Try again.")
            status_label.setStyleSheet("color: #ff647c;")
        except Exception as exc:
            error_msg = str(exc)
            if "already" in error_msg.lower():
                status_label.setText("An account with this email already exists.")
            else:
                status_label.setText(f"Registration failed: {error_msg}")
            status_label.setStyleSheet("color: #ff647c;")
            print(f"[ERROR] Registration failed: {exc}")

    def _on_login_success(self, session, user):
        self.auth_token = getattr(session, "access_token", None)
        self.refresh_token = getattr(session, "refresh_token", None)
        self.user_id = str(getattr(user, "id", "")) if user else None
        self.user_email = getattr(user, "email", None)

        self._save_auth_token()
        self._ensure_user_profile()
        self._fetch_user_role()
        self._refresh_header_actions()

        setattr(self.service, "user_email", self.user_email)
        if self.user_id:
            try:
                self.device_info = device.get_info(self.user_id)
            except Exception as exc:
                print(f"[WARN] Failed to refresh device info after login: {exc}")

        self._refresh_rig_info()
        self._update_status_tick()

    def _load_auth_token(self):
        if not AUTH_FILE.exists():
            return
        try:
            data = json.loads(AUTH_FILE.read_text())
            self.auth_token = data.get("token")
            self.refresh_token = data.get("refresh_token")
            self.user_id = data.get("user_id")
            self.user_email = data.get("email")
        except Exception as exc:
            print(f"[WARN] Failed to load auth token: {exc}")

    def _save_auth_token(self):
        if not self.auth_token:
            self._clear_auth_token()
            return

        try:
            AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "token": self.auth_token,
                "refresh_token": self.refresh_token,
                "user_id": self.user_id,
                "email": self.user_email,
            }
            AUTH_FILE.write_text(json.dumps(payload, indent=2))
        except Exception as exc:
            print(f"[WARN] Failed to save auth token: {exc}")

    def _clear_auth_token(self):
        try:
            if AUTH_FILE.exists():
                AUTH_FILE.unlink()
        except Exception as exc:
            print(f"[WARN] Failed to clear auth token: {exc}")

    def _verify_auth_token(self):
        if not self.supabase_client or not self.auth_token:
            return

        try:
            auth_response = self.supabase_client.auth.get_user(self.auth_token)
            if auth_response and auth_response.user:
                self.user_id = str(auth_response.user.id)
                self.user_email = auth_response.user.email
                self._fetch_user_role()
                return
        except Exception as exc:
            print(f"[WARN] Auth token verification failed: {exc}")

        self.auth_token = None
        self.refresh_token = None
        self.user_id = None
        self.user_email = None
        self.user_role = None
        self._clear_auth_token()

    def _fetch_user_role(self):
        if not self.supabase_client or not self.user_id:
            self.user_role = None
            return

        try:
            result = (
                self.supabase_client.table("irc_user_profiles")
                .select("role")
                .eq("id", self.user_id)
                .limit(1)
                .execute()
            )

            data = getattr(result, "data", None)
            if data:
                self.user_role = data[0].get("role") or "driver"
            else:
                self.user_role = "driver"
        except Exception as exc:
            print(f"[WARN] Failed to fetch user role: {exc}")
            self.user_role = "driver"

    def _ensure_user_profile(self):
        if not self.supabase_service or not self.user_id:
            return

        try:
            result = (
                self.supabase_service.table("irc_user_profiles")
                .select("id")
                .eq("id", self.user_id)
                .limit(1)
                .execute()
            )
            data = getattr(result, "data", None)
            if data:
                return

            profile = {
                "id": self.user_id,
                "email": self.user_email,
                "role": "driver",
                "created_at": datetime.utcnow().isoformat() + "Z",
            }
            self.supabase_service.table("irc_user_profiles").insert(profile).execute()
        except Exception as exc:
            print(f"[WARN] Failed to ensure user profile: {exc}")

    def can_manage_rig(self) -> bool:
        if not self.user_id:
            return False

        owner_id = None
        if self.device_info:
            owner_id = self.device_info.get("owner_user_id")
        if owner_id and str(owner_id) == str(self.user_id):
            return True

        return self.user_role in {"rig_manager", "super_admin"}

    def _force_service_metadata_refresh(self):
        if not self.service:
            return
        try:
            if hasattr(self.service, "refresh_supabase_metadata"):
                self.service.refresh_supabase_metadata(force=True)
        except Exception as exc:
            print(f"[WARN] Failed to refresh service metadata: {exc}")

    # ------------------------------------------------------------------ Recent laps helpers
    def _handle_lap_recorded(self, lap_number, lap_time, data):
        QTimer.singleShot(0, lambda: self._fetch_recent_laps(force=True))
    
    def _on_command_notification(self, command_info: dict):
        """Handle command notification from service"""
        action = command_info.get('action', 'unknown')
        source = command_info.get('source', 'queue')
        success = command_info.get('success')
        message = command_info.get('message', '')
        
        if success is None:
            # Command received
            if hasattr(self, 'controls_feedback'):
                self.controls_feedback.setText(f"Command received: {action} (from {source})")
                self.controls_feedback.setStyleSheet("color: #ffb703;")
        else:
            # Command executed
            if hasattr(self, 'controls_feedback'):
                if success:
                    self.controls_feedback.setText(f"Command executed: {action} - {message}")
                    self.controls_feedback.setStyleSheet("color: #35d48b;")
                else:
                    self.controls_feedback.setText(f"Command failed: {action} - {message}")
                    self.controls_feedback.setStyleSheet("color: #ff647c;")
        
        # Also update controls log if available
        if hasattr(self, '_update_controls_log_display'):
            QTimer.singleShot(100, lambda: self._update_controls_log_display())

    def _refresh_rig_info(self, supabase_info: Dict | None = None):
        if not self.rig_info_labels:
            return

        try:
            if self.user_id:
                self.device_info = device.get_info(self.user_id)
            else:
                self.device_info = device.get_info()
        except Exception as exc:
            print(f"[WARN] Failed to refresh device info: {exc}")

        device_info = self.device_info or {}
        sup_info = supabase_info or {}

        combined = {
            "device_id": sup_info.get("device_id") or device_info.get("device_id") or "Not registered",
            "device_name": sup_info.get("device_name") or device_info.get("device_name") or "Unknown",
            "status": sup_info.get("status_text") or device_info.get("status") or "unregistered",
            "owner": sup_info.get("owner_user_id") or device_info.get("owner_user_id") or "None",
            "registered_at": sup_info.get("registered_at") or device_info.get("registered_at"),
            "last_seen": sup_info.get("last_seen"),
            "location": sup_info.get("location") or device_info.get("location") or "Not set",
            "local_ip": sup_info.get("local_ip") or device_info.get("local_ip") or "Unknown",
            "public_ip": sup_info.get("public_ip") or device_info.get("public_ip") or "Unknown",
        }

        owner_display = combined["owner"]
        if isinstance(owner_display, str) and len(owner_display) > 16:
            owner_display = owner_display[:13] + "..."

        self.rig_info_labels["device_id"].setText(combined["device_id"])
        self.rig_info_labels["device_name"].setText(combined["device_name"])
        self.rig_info_labels["status"].setText(str(combined["status"]).title())
        self.rig_info_labels["owner"].setText(owner_display)
        self.rig_info_labels["registered_at"].setText(self._format_iso(combined["registered_at"]))
        self.rig_info_labels["last_seen"].setText(self._format_iso(combined["last_seen"]))
        self.rig_info_labels["location"].setText(combined["location"])
        self.rig_info_labels["local_ip"].setText(combined["local_ip"])
        self.rig_info_labels["public_ip"].setText(combined["public_ip"])

        can_manage = self.can_manage_rig()
        is_registered = combined["device_id"] and combined["device_id"] != "Not registered"

        if self.rig_name_input:
            current_name = self.rig_name_input.text().strip()
            new_name = combined["device_name"] if is_registered else ""
            if current_name != new_name:
                self.rig_name_input.setText(new_name)
            self.rig_name_input.setEnabled(can_manage)

        if self.rig_location_input:
            current_loc = self.rig_location_input.text().strip()
            new_loc = "" if not is_registered else (combined["location"] if combined["location"] != "Not set" else "")
            if current_loc != new_loc:
                self.rig_location_input.setText(new_loc)
            self.rig_location_input.setEnabled(can_manage)

        if self.rig_register_button:
            self.rig_register_button.setVisible(can_manage and not is_registered)
            self.rig_register_button.setEnabled(can_manage and not is_registered)
        if self.rig_update_button:
            self.rig_update_button.setVisible(can_manage and is_registered)
            self.rig_update_button.setEnabled(can_manage and is_registered)
        
        # Show claim button if device is not claimed
        is_claimed = combined.get("status", "").lower() not in ("unclaimed", "unregistered") and combined.get("device_id") != "Not registered"
        if self.rig_claim_button:
            self.rig_claim_button.setVisible(not is_claimed)
            self.rig_claim_button.setEnabled(not is_claimed)

        if not self.user_id:
            self._set_rig_status("Login to manage this rig.", "info")
        elif not can_manage:
            self._set_rig_status("You are signed in as driver. Rig management is disabled.", "info")
        elif is_registered:
            self._set_rig_status("Rig registered. Update details as needed.", "success")
        else:
            self._set_rig_status("Rig not registered. Provide details and register.", "info")

    def _set_rig_status(self, message: str, tone: str = "info"):
        if not self.rig_form_status:
            return
        colors = {
            "info": "#97a2b3",
            "success": "#35d48b",
            "error": "#ff647c",
            "warning": "#ffb703",
        }
        self.rig_form_status.setText(message)
        self.rig_form_status.setStyleSheet(f"color: {colors.get(tone, '#97a2b3')};")

    def _handle_register_rig(self):
        if not self.can_manage_rig():
            self._set_rig_status("You do not have permission to register this rig.", "error")
            return
        if not self.user_id:
            self._set_rig_status("Login required before registering a rig.", "error")
            return

        name = self.rig_name_input.text().strip() if self.rig_name_input else ""
        location = self.rig_location_input.text().strip() if self.rig_location_input else ""

        if not name:
            self._set_rig_status("Rig name is required.", "error")
            return

        self._set_rig_status("Registering rig...", "info")
        if self.rig_register_button:
            self.rig_register_button.setEnabled(False)

        def worker():
            try:
                result = device.get_manager().register_device(
                    user_id=self.user_id,
                    device_name=name,
                    location=location or None,
                )
            except Exception as exc:
                result = {"success": False, "error": str(exc)}

            def apply():
                if result.get("success"):
                    self._set_rig_status(f"Rig registered: {name}", "success")
                    device_data = result.get("device", {})
                    if self.service and device_data.get("device_id"):
                        self.service.device_id = device_data["device_id"]
                        if hasattr(self.service, "_initialize_lap_tracking"):
                            try:
                                self.service._initialize_lap_tracking()
                            except Exception as exc_inner:
                                print(f"[WARN] Failed to reinitialize lap tracking: {exc_inner}")
                        self._force_service_metadata_refresh()
                    try:
                        self.device_info = device.get_info(self.user_id)
                    except Exception as exc_get:
                        print(f"[WARN] Failed to reload device info after registration: {exc_get}")
                    self._refresh_rig_info()
                    self._fetch_recent_laps(force=True)
                else:
                    self._set_rig_status(f"Registration failed: {result.get('error', 'Unknown error')}", "error")
                if self.rig_register_button:
                    self.rig_register_button.setEnabled(self.can_manage_rig())

            QTimer.singleShot(0, apply)

        threading.Thread(target=worker, daemon=True).start()

    def _handle_update_rig(self):
        if not self.can_manage_rig():
            self._set_rig_status("You do not have permission to update this rig.", "error")
            return
        if not self.user_id:
            self._set_rig_status("Login required before updating a rig.", "error")
            return
        device_id = (self.device_info or {}).get("device_id")
        if not device_id:
            self._set_rig_status("Rig is not registered yet.", "error")
            return

        name = self.rig_name_input.text().strip() if self.rig_name_input else ""
        location = self.rig_location_input.text().strip() if self.rig_location_input else ""

        if not name:
            self._set_rig_status("Rig name is required.", "error")
            return

        self._set_rig_status("Updating rig...", "info")
        if self.rig_update_button:
            self.rig_update_button.setEnabled(False)

        def worker():
            try:
                result = device.get_manager().update_device(
                    device_id=device_id,
                    device_name=name,
                    location=location or None,
                )
            except Exception as exc:
                result = {"success": False, "error": str(exc)}

            def apply():
                if result.get("success"):
                    self._set_rig_status(f"Rig updated: {name}", "success")
                    self._force_service_metadata_refresh()
                    try:
                        self.device_info = device.get_info(self.user_id)
                    except Exception as exc_get:
                        print(f"[WARN] Failed to reload device info after update: {exc_get}")
                    self._refresh_rig_info()
                else:
                    self._set_rig_status(f"Update failed: {result.get('error', 'Unknown error')}", "error")
                if self.rig_update_button:
                    self.rig_update_button.setEnabled(self.can_manage_rig())

            QTimer.singleShot(0, apply)

        threading.Thread(target=worker, daemon=True).start()

    def _handle_claim_rig(self):
        """Open the device claim page in the browser."""
        device_id = (self.device_info or {}).get("device_id")
        claim_code = (self.device_info or {}).get("claim_code")
        
        if not device_id or device_id == "Not registered":
            self._set_rig_status("Device ID not available. Please wait for device sync.", "error")
            return
        
        # Build the portal URL with claim code if available
        from core.device import DEVICE_PORTAL_BASE_URL
        portal_url = f"{DEVICE_PORTAL_BASE_URL}/{device_id}"
        
        # Add claim code to URL if available and device is unclaimed
        if claim_code and not (self.device_info or {}).get("claimed"):
            from urllib.parse import urlencode
            portal_url = f"{portal_url}?claimCode={claim_code}"
        
        # Open in default browser
        QDesktopServices.openUrl(QUrl(portal_url))
        self._set_rig_status(f"Opening claim page in browser: {portal_url}", "info")

    def _fetch_recent_laps(self, force: bool = False):
        if not self.supabase_client or not self.service.device_id:
            self.recent_laps = []
            self._update_laps_view()
            return
        if self._laps_inflight:
            if force:
                self._pending_laps_force = True
            return

        if not force and (time.time() - self.last_laps_refresh) < self.laps_refresh_interval:
            return

        self.laps_status_label.setText("Loading laps...")
        self.laps_status_label.setStyleSheet("color: #97a2b3;")

        self._laps_inflight = True

        def worker():
            try:
                query_client = self.supabase_service or self.supabase_client
                response = (
                    query_client.table("irc_laps")
                    .select("lap_number, lap_time, timestamp, track_id, car_id, telemetry")
                    .eq("device_id", self.service.device_id)
                    .order("timestamp", desc=True)
                    .limit(40)
                    .execute()
                )
                data = getattr(response, "data", None) if response is not None else None
                self.laps_ready.emit(data or [])
            except Exception as exc:
                self.laps_error.emit(str(exc))
            finally:
                self._laps_inflight = False

        threading.Thread(target=worker, daemon=True).start()

    def _update_laps_view(self):
        while self.laps_list_layout.count():
            item = self.laps_list_layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()

        if not self.recent_laps:
            self.laps_status_label.setText("No laps recorded yet.")
            self.laps_status_label.setStyleSheet("color: #97a2b3;")
            self._update_stats()
            return

        self.laps_status_label.setText(f"Showing latest {len(self.recent_laps)} laps.")
        self.laps_status_label.setStyleSheet("color: #97a2b3;")

        for lap in self.recent_laps:
            row = QFrame()
            row.setObjectName("LapRow")
            row.setFrameShape(QFrame.StyledPanel)
            layout = QHBoxLayout(row)
            layout.setContentsMargins(14, 10, 14, 10)
            layout.setSpacing(16)

            lap_number = lap.get("lap_number") or lap.get("lap_completed")
            lap_time = lap.get("lap_time")
            timestamp = lap.get("timestamp")
            track_name, car_name = self._parse_telemetry_snapshot(lap.get("telemetry"))
            if not track_name:
                track_name = lap.get("track_id") or "Unknown track"
            if not car_name:
                car_name = lap.get("car_id") or ""

            lap_label = QLabel(f"Lap {lap_number if lap_number is not None else '?'}")
            lap_label.setObjectName("ValueLabel")
            layout.addWidget(lap_label, stretch=1)

            lap_time_label = QLabel(self._format_lap_time(lap_time))
            lap_time_label.setObjectName("ValueLabel")
            layout.addWidget(lap_time_label, stretch=1)

            details_label = QLabel(f"{track_name} • {car_name}".strip(" •"))
            details_label.setObjectName("MetaLabel")
            details_label.setWordWrap(True)
            layout.addWidget(details_label, stretch=2)

            time_label = QLabel(self._format_relative_time(timestamp))
            time_label.setObjectName("MetaLabel")
            layout.addWidget(time_label, stretch=1)

            self.laps_list_layout.addWidget(row)

        self.laps_list_layout.addStretch()
        self._update_stats()

    def _on_laps_ready(self, data: List):
        self.recent_laps = data or []
        self.last_laps_refresh = time.time()
        self.laps_status_label.setText(f"Loaded {len(self.recent_laps)} laps from Supabase.")
        self.laps_status_label.setStyleSheet("color: #97a2b3;")
        self._update_laps_view()

        if self._pending_laps_force:
            self._pending_laps_force = False
            QTimer.singleShot(0, lambda: self._fetch_recent_laps(force=True))

    def _on_laps_error(self, message: str):
        self.laps_status_label.setText(f"Failed to load laps: {message}")
        self.laps_status_label.setStyleSheet("color: #ff647c;")
        print(f"[WARN] Failed to fetch recent laps: {message}")
        self._update_stats()

    def _format_lap_time(self, value):
        try:
            seconds = float(value)
        except (TypeError, ValueError):
            return "--"

        minutes = int(seconds // 60)
        remainder = seconds % 60
        if minutes:
            return f"{minutes}:{remainder:06.3f}"
        return f"{remainder:.3f}s"

    def _format_relative_time(self, value):
        if not value:
            return "Unknown"
        try:
            value_str = str(value)
            if value_str.endswith("Z"):
                value_str = value_str[:-1] + "+00:00"
            dt = datetime.fromisoformat(value_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            now = datetime.now(dt.tzinfo)
            delta = now - dt
            if delta.total_seconds() < 0:
                return "In progress"
            seconds = int(delta.total_seconds())
            if seconds < 60:
                return f"{seconds}s ago"
            minutes = seconds // 60
            if minutes < 60:
                return f"{minutes}m ago"
            hours = minutes // 60
            if hours < 24:
                return f"{hours}h ago"
            days = hours // 24
            return f"{days}d ago"
        except Exception:
            return str(value)

    def _parse_telemetry_snapshot(self, snapshot):
        if not snapshot:
            return None, None
        try:
            if isinstance(snapshot, str):
                snapshot = json.loads(snapshot)
            track = snapshot.get("track_name")
            car = snapshot.get("car_name")
            return track, car
        except Exception:
            pass
        return None, None

    # ------------------------------------------------------------------ Data updates
    def _update_status_tick(self):
        if not self.service:
            return
        if self._status_inflight:
            return
        self._status_inflight = True

        def worker():
            try:
                status = self.service.get_status()
                if isinstance(status, dict):
                    self.status_ready.emit(status)
            except Exception as exc:
                print(f"[WARN] Failed to poll service status: {exc}")
                if self._latest_status:
                    self.status_ready.emit(self._latest_status)
            finally:
                self._status_inflight = False

        threading.Thread(target=worker, daemon=True).start()

    def _apply_status(self, status: Dict):
        iracing = status.get("iracing", {})
        supabase = status.get("supabase", {})

        self.is_iracing_connected = bool(iracing.get("connected"))
        self.is_in_car = bool(iracing.get("in_car"))
        self._update_controls_availability()

        self.service_labels["status"].setText("RUNNING")
        self.service_labels["iracing"].setText("Connected" if self.is_iracing_connected else "Disconnected")
        self.service_labels["lap"].setText(str(iracing.get("current_lap", 0)))
        self.service_labels["speed"].setText(f"{iracing.get('speed_kph', 0):.1f} km/h")
        self.service_labels["rpm"].setText(str(int(iracing.get("rpm", 0))))
        self.service_labels["last_update"].setText(self._format_timestamp(iracing.get("last_update")))

        try:
            current_info = device.get_info()
            if current_info:
                self.device_info = current_info
        except Exception:
            if self.device_info is None:
                self.device_info = {}
        device_info = self.device_info or {}

        owner = supabase.get("owner_user_id") or device_info.get("owner_user_id")

        self.supabase_labels["device_id"].setText(supabase.get("device_id", "N/A"))
        self.supabase_labels["device_name"].setText(supabase.get("device_name", device_info.get("device_name", "N/A")))
        self.supabase_labels["status_text"].setText(supabase.get("status_text", device_info.get("status", "N/A")))
        self.supabase_labels["owner"].setText(owner[:12] + "..." if owner and len(owner) > 12 else (owner or "N/A"))
        self.supabase_labels["session_laps"].setText(str(supabase.get("laps_session", 0)))
        self.supabase_labels["total_laps"].setText(str(supabase.get("laps_total", 0)))
        self.supabase_labels["last_sync"].setText(self._format_timestamp(supabase.get("last_sync")))
        self.supabase_labels["last_seen"].setText(self._format_iso(supabase.get("last_seen")))
        self.supabase_labels["location"].setText(supabase.get("location") or device_info.get("location") or "Not set")
        self.supabase_labels["local_ip"].setText(supabase.get("local_ip") or device_info.get("local_ip", "N/A"))
        self.supabase_labels["public_ip"].setText(supabase.get("public_ip") or device_info.get("public_ip", "Unknown"))

        if self.status_labels:
            self.status_labels["telemetry"].setText(
                "Connected" if self.is_iracing_connected else "Disconnected"
            )
            driver_state = []
            if self.is_in_car:
                driver_state.append("In car")
            else:
                driver_state.append("Garage/Out of car")
            if iracing.get("on_track"):
                driver_state.append("On track")
            if iracing.get("in_pit_stall"):
                driver_state.append("Pit stall")
            self.status_labels["in_car"].setText(" • ".join(driver_state))

            database_connected = bool(supabase.get("connected"))
            self.status_labels["database"].setText("Connected" if database_connected else "Disconnected")

            device_registered = bool(supabase.get("device_id") or device_info.get("device_id"))
            device_label = supabase.get("device_id") or device_info.get("device_id") or "Not registered"
            if device_registered and isinstance(device_label, str) and len(device_label) > 18:
                device_label = f"{device_label[:8]}…{device_label[-4:]}"
            self.status_labels["device"].setText(device_label if device_registered else "Not registered")
            self.status_labels["last_sync"].setText(self._format_timestamp(supabase.get("last_sync")))
            
            # Update total laps
            total_laps = supabase.get("laps_total", 0) or device_info.get("total_laps", 0) or 0
            self.status_labels["total_laps"].setText(str(total_laps))
            
            # Update total drivers (refresh periodically)
            if not hasattr(self, '_last_drivers_check') or (time.time() - getattr(self, '_last_drivers_check', 0)) > 30:
                self._update_drivers_count()
                self._last_drivers_check = time.time()

        self._update_troubleshooting_messages(supabase, iracing)

        digest = (
            supabase.get("device_id"),
            supabase.get("status_text"),
            supabase.get("owner_user_id"),
            supabase.get("last_seen"),
            supabase.get("location"),
        )
        now = time.time()
        if (
            digest != self._last_supabase_digest
            or (now - self._last_rig_refresh) > self.rig_refresh_interval
        ):
            self._refresh_rig_info(supabase)
            self._last_supabase_digest = digest
            self._last_rig_refresh = now

        if time.time() - self.last_laps_refresh > self.laps_refresh_interval:
            self._fetch_recent_laps()

        # Periodically check for controls file changes
        now = time.time()
        if (now - self.last_controls_check) > self.controls_check_interval:
            self._check_controls_changes()
            self.last_controls_check = now

        self._update_stats()
        self._refresh_header_actions()

    def _on_status_ready(self, status: Dict):
        if isinstance(status, dict) and status:
            self._latest_status = status
            self._apply_status(status)
        elif self._latest_status:
            self._apply_status(self._latest_status)

    def _check_controls_changes(self):
        """Check if controls files have changed and reload if needed"""
        if not self.service or self._controls_inflight:
            return
        
        try:
            controls_manager = getattr(self.service, "controls_manager", None)
            if not controls_manager:
                return
            
            # Load bindings without force - it will check file mtime internally
            # and only reload if files have changed
            controls_manager.load_bindings(force=False)
            
            # Get current bindings
            new_bindings = controls_manager.get_bindings(force=False)
            
            # Compare bindings by serializing to detect actual changes
            import json
            current_str = json.dumps(self.controls_bindings, sort_keys=True) if self.controls_bindings else ""
            new_str = json.dumps(new_bindings, sort_keys=True) if new_bindings else ""
            
            if current_str != new_str:
                # Bindings changed, reload the display
                self._load_controls(force=False)
        except Exception:
            # Silently fail - we don't want to spam errors for periodic checks
            pass

    def _load_controls(self, force: bool = False):
        if self._controls_inflight or not self.service:
            return

        self._controls_inflight = True
        self.controls_status_label.setText("Loading controls...")
        self.controls_feedback.setText("")

        def worker():
            try:
                bindings = self.service.get_controls_mapping(force=force) or {}
                error = None
                controls_manager = getattr(self.service, "controls_manager", None)
                if controls_manager and hasattr(controls_manager, "get_last_error"):
                    error = controls_manager.get_last_error()
                self.controls_ready.emit({"bindings": bindings, "error": error})
            except Exception as exc:
                self.controls_error.emit(str(exc))
            finally:
                self._controls_inflight = False

        threading.Thread(target=worker, daemon=True).start()

    def _render_controls(self):
        self.control_buttons.clear()
        for i in reversed(range(self.controls_layout.count())):
            item = self.controls_layout.itemAt(i)
            widget = item.widget()
            if widget:
                widget.deleteLater()

        query = ""
        if hasattr(self, "controls_filter_input") and self.controls_filter_input:
            query = self.controls_filter_input.text().strip().lower()

        if not self.controls_bindings:
            label = QLabel("No commander controls detected. Configure bindings in iRacing.")
            label.setObjectName("MetaLabel")
            self.controls_layout.addWidget(label, 0, 0)
            return

        filtered_items = []
        for action, info in sorted(self.controls_bindings.items(), key=lambda item: item[1].get("label", "")):
            label_text = info.get("label", action) or action
            combo_text = info.get("combo") or ""
            searchable = f"{label_text} {combo_text}".lower()
            if query and query not in searchable:
                continue
            filtered_items.append((action, info))

        if not filtered_items:
            label = QLabel("No controls match this filter.")
            label.setObjectName("MetaLabel")
            self.controls_layout.addWidget(label, 0, 0)
            return

        for idx, (action, info) in enumerate(filtered_items):
            row = QWidget()
            row_layout = QHBoxLayout(row)
            row_layout.setContentsMargins(12, 12, 12, 12)
            row_layout.setSpacing(12)
            row.setObjectName("DashboardCard")
            row.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)

            name_label = QLabel(info.get("label", action))
            name_label.setObjectName("ValueLabel")
            row_layout.addWidget(name_label, stretch=2)

            combo = info.get("combo") or "Not mapped"
            source = info.get("source", "")
            combo_label = QLabel(combo if not source else f"{combo} ({source})")
            combo_label.setObjectName("MetaLabel")
            row_layout.addWidget(combo_label, stretch=3)

            trigger_button = QPushButton("Trigger")
            trigger_button.setCursor(Qt.PointingHandCursor)
            if info.get("combo"):
                trigger_button.setObjectName("Primary")
            else:
                trigger_button.setEnabled(False)
            trigger_button.clicked.connect(lambda _, a=action: self._trigger_control(a, source="manual"))
            row_layout.addWidget(trigger_button, stretch=0)

            self.controls_layout.addWidget(row, idx, 0)
            self.control_buttons[action] = trigger_button

        self._update_controls_availability()

    def _on_controls_ready(self, payload: Dict):
        self.controls_bindings = payload.get("bindings", {}) or {}
        self.controls_last_error = payload.get("error")
        self._render_controls()
        self._update_rig_keys_display()

        if self.controls_last_error:
            self.controls_feedback.setText(self.controls_last_error)
            self.controls_feedback.setStyleSheet("color: #ffb347;")
        else:
            self.controls_feedback.setText("Controls loaded.")
            self.controls_feedback.setStyleSheet("color: #97a2b3;")
        self._update_controls_availability()

    def _on_controls_error(self, message: str):
        self.controls_last_error = message
        self.controls_status_label.setText(f"Failed to load controls: {message}")
        self.controls_feedback.setText("")
        self.controls_feedback.setStyleSheet("color: #ff647c;")
        self._update_controls_availability()

    def _update_drivers_count(self):
        """Fetch and update total drivers count from database"""
        if not self.supabase_service:
            if self.status_labels.get("total_drivers"):
                self.status_labels["total_drivers"].setText("—")
            return
        
        try:
            result = self.supabase_service.table('irc_user_profiles')\
                .select('id', count='exact')\
                .execute()
            
            count = 0
            if hasattr(result, 'count') and result.count is not None:
                count = result.count
            elif isinstance(result, dict) and 'count' in result:
                count = result['count']
            elif result and hasattr(result, 'data') and result.data:
                count = len(result.data)
            
            if self.status_labels.get("total_drivers"):
                self.status_labels["total_drivers"].setText(str(count))
        except Exception:
            # Silently fail - don't spam errors
            if self.status_labels.get("total_drivers"):
                self.status_labels["total_drivers"].setText("—")

    def _update_rig_keys_display(self):
        """Update the registered keys display in the Rig Status card"""
        if not hasattr(self, "rig_keys_layout"):
            return

        # Clear existing keys
        while self.rig_keys_layout.count():
            item = self.rig_keys_layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()

        if not self.controls_bindings:
            no_keys_label = QLabel("No controls loaded")
            no_keys_label.setObjectName("MetaLabel")
            self.rig_keys_layout.addWidget(no_keys_label)
            return

        # Show registered keys (only those with combos)
        registered_keys = []
        for action, info in sorted(self.controls_bindings.items(), key=lambda item: item[1].get("label", "")):
            combo = info.get("combo")
            if combo:
                label_text = info.get("label", action)
                source = info.get("source", "")
                display_text = f"{label_text}: {combo}"
                if source:
                    display_text += f" ({source})"
                registered_keys.append((label_text, display_text))

        if not registered_keys:
            no_keys_label = QLabel("No keys mapped")
            no_keys_label.setObjectName("MetaLabel")
            self.rig_keys_layout.addWidget(no_keys_label)
            return

        # Display keys in a compact format (max 5 visible, scrollable if more)
        for label_text, display_text in registered_keys[:5]:
            key_row = QHBoxLayout()
            key_row.setContentsMargins(0, 0, 0, 0)
            key_row.setSpacing(6)
            
            key_label = QLabel(display_text)
            key_label.setObjectName("MetaLabel")
            key_label.setWordWrap(True)
            key_row.addWidget(key_label)
            
            key_widget = QWidget()
            key_widget.setLayout(key_row)
            self.rig_keys_layout.addWidget(key_widget)

        if len(registered_keys) > 5:
            more_label = QLabel(f"+ {len(registered_keys) - 5} more (see Commander Controls tab)")
            more_label.setObjectName("MetaLabel")
            self.rig_keys_layout.addWidget(more_label)

    def _update_controls_availability(self):
        if not self.control_buttons:
            return

        allow_controls = self.is_iracing_connected
        in_car = self.is_in_car

        reasons: List[str] = []
        if not allow_controls:
            reasons.append("iRacing not connected")
        elif not in_car:
            reasons.append("Driver not in car")

        for action, button in self.control_buttons.items():
            combo = self.controls_bindings.get(action, {}).get("combo")
            if not combo:
                button.setEnabled(False)
                continue

            if action == "reset_car":
                button.setEnabled(allow_controls)
            else:
                button.setEnabled(allow_controls and in_car)

        mapped = len([info for info in self.controls_bindings.values() if info.get("combo")])
        total = len(self.controls_bindings)
        base_text = ""
        if total:
            base_text = f"{mapped}/{total} controls mapped"
        if reasons:
            reason_text = " | ".join(reasons)
            self.controls_status_label.setText(f"{base_text} • {reason_text}" if base_text else reason_text)
        else:
            self.controls_status_label.setText(base_text or "Controls ready")

    def _trigger_control(self, action: str, source: str = "manual"):
        result = self.service.execute_control_action(action, source=source)
        success = result.get("success", False)
        self.controls_feedback.setText(result.get("message", ""))
        self.controls_feedback.setStyleSheet(
            "color: #35d48b;" if success else "color: #ff647c;"
        )

    # ------------------------------------------------------------------ Helpers
    def _logout(self):
        if self.supabase_client:
            try:
                self.supabase_client.auth.sign_out()
            except Exception as exc:
                print(f"[WARN] Supabase sign out failed: {exc}")

        self.auth_token = None
        self.refresh_token = None
        self.user_id = None
        self.user_email = None
        self.user_role = None
        self._clear_auth_token()

        setattr(self.service, "user_email", None)
        try:
            self.device_info = device.get_info()
        except Exception as exc:
            print(f"[WARN] Failed to refresh device info after logout: {exc}")

        self._refresh_header_actions()
        self._update_status_tick()
        self._fetch_recent_laps(force=True)
        self._refresh_rig_info()

        self.controls_feedback.setText("Signed out.")
        self.controls_feedback.setStyleSheet("color: #97a2b3;")

    def _format_timestamp(self, timestamp):
        if not timestamp:
            return "Never"
        try:
            import datetime

            dt = datetime.datetime.fromtimestamp(timestamp)
            return dt.strftime("%H:%M:%S")
        except Exception:
            return "Unknown"

    def _format_iso(self, value):
        if not value:
            return "Never"
        try:
            import datetime

            value_str = str(value)
            if value_str.endswith("Z"):
                value_str = value_str[:-1] + "+00:00"
            dt = datetime.datetime.fromisoformat(value_str)
            if dt.tzinfo:
                dt = dt.astimezone()
            return dt.strftime("%Y-%m-%d %H:%M")
        except Exception:
            return str(value)

