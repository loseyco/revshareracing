# Project Structure

**Complete directory structure for Rev Share Racing**

---

## 📁 **Full Structure**

```
RevShareRacing/
├── README.md                      # Main project README
├── PROJECT_STRUCTURE.md           # This file
├── .gitignore                     # Git ignore rules
│
├── gridpass-app/                  # 🌐 GridPass Platform
│   ├── README.md                  # Platform README
│   ├── package.json               # Node dependencies
│   ├── src/                       # Source code
│   │   ├── app/                   # Next.js app directory
│   │   │   ├── api/v1/            # REST API endpoints
│   │   │   └── ...
│   │   └── lib/                   # Platform utilities
│   └── ...
│
├── ircommander_client/              # 🖥️ PC Service (API-first)
│   ├── README.md                  # Service README
│   ├── requirements.txt           # Python dependencies
│   ├── main.py                    # Entry point
│   ├── service.py                 # Main service orchestrator
│   ├── api_client.py              # iRCommander API client
│   ├── gui.py                     # PyQt6 GUI
│   ├── dev_reload.py              # Auto-reload dev mode
│   ├── core/                      # Core modules
│   │   ├── device.py              # Device fingerprinting
│   │   ├── telemetry.py           # iRacing SDK integration
│   │   ├── controls.py            # Key bindings & window control
│   │   ├── joystick_config.py     # Joystick configuration
│   │   └── joystick_monitor.py    # Joystick monitoring
│   └── data/                      # Local device config
│
├── migrations/                    # 📊 Database Migrations
│   ├── create_gridpass_tenants.sql
│   └── ...
│
├── docs/                          # 📚 Documentation Hub
│   ├── README.md                  # Documentation index
│   ├── architecture/              # System architecture
│   │   ├── ARCHITECTURE.md        # Main architecture doc
│   │   └── ...
│   ├── guides/                    # How-to guides
│   │   ├── QUICK_START.md        # Quick start guide
│   │   ├── SETUP.md              # Complete setup
│   │   └── ...
│   ├── notes/                     # Development notes
│   │   ├── DEVELOPMENT_NOTES.md  # Ongoing notes
│   │   ├── IDEAS.md              # Feature ideas
│   │   └── ISSUES.md             # Known issues
│   └── decisions/                 # Architecture decisions (ADRs)
│       └── ...
│
└── archive/                       # 📦 Archived Old Implementations
    ├── pc-service/                # Old direct Supabase PC service
    ├── web-app/                   # Old tenant web application
    ├── reference/                 # Old reference materials
    ├── assets/                    # Old assets
    └── ...                        # Other archived files
```

---

## 📂 **Directory Purposes**

### **`gridpass-app/`** - GridPass Platform
Multi-tenant B2B platform providing REST APIs for device management, authentication, and telemetry.

### **`ircommander_client/`** - PC Service
API-first Python service that runs on racing rigs. Connects to iRCommander platform via REST APIs.

### **`migrations/`** - Database Migrations
SQL migration files for Supabase database schema changes.

### **`docs/`** - Documentation Hub
All project documentation organized by type (architecture, guides, notes, decisions).

### **`archive/`** - Archived Code
Old implementations and reference materials preserved for historical reference.

---

## 📝 **File Naming Conventions**

- **Documentation:** `UPPERCASE.md` (e.g., `ARCHITECTURE.md`)
- **Code:** `snake_case.py` (Python) or `camelCase.tsx` (TypeScript)
- **Config:** `.env`, `.env.example`
- **Tests:** `test_*.py` or `*.test.tsx`

---

## 🔍 **Finding Files**

- **Architecture docs:** `docs/architecture/`
- **How-to guides:** `docs/guides/`
- **GridPass platform code:** `gridpass-app/src/`
- **iRCommander client code:** `ircommander_client/`
- **Database migrations:** `migrations/`
- **Old implementations:** `archive/`

---

**Last Updated:** January 2025



