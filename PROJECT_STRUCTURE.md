# Project Structure

**Complete directory structure for Rev Share Racing**

---

## 📁 **Full Structure**

```
_V4/
├── README.md                      # Main project README
├── PROJECT_STRUCTURE.md           # This file
├── .gitignore                     # Git ignore rules
│
├── docs/                          # 📚 Documentation Hub
│   ├── README.md                  # Documentation index
│   │
│   ├── architecture/              # System architecture
│   │   ├── ARCHITECTURE.md        # Main architecture doc
│   │   ├── SEPARATED_ARCHITECTURE.md
│   │   ├── DATA_FLOW.md
│   │   └── SECURITY.md
│   │
│   ├── guides/                    # How-to guides
│   │   ├── QUICK_START.md        # Quick start guide
│   │   ├── SETUP.md              # Complete setup
│   │   ├── DEPLOYMENT.md         # Deployment guide
│   │   └── DEVELOPMENT.md       # Development workflow
│   │
│   ├── reference/                 # API & schema reference
│   │   ├── API_REFERENCE.md      # API endpoints
│   │   ├── DATABASE_SCHEMA.md    # Database structure
│   │   └── CONFIGURATION.md     # Config options
│   │
│   ├── notes/                     # Development notes
│   │   ├── DEVELOPMENT_NOTES.md  # Ongoing notes
│   │   ├── IDEAS.md              # Feature ideas
│   │   └── ISSUES.md             # Known issues
│   │
│   └── decisions/                 # Architecture decisions (ADRs)
│       ├── 001_SEPARATED_ARCHITECTURE.md
│       ├── 002_SUPABASE_DIRECT.md
│       └── 003_VERCEL_HOSTING.md
│
├── pc-service/                    # 🖥️ Python PC Service
│   ├── README.md                  # Service README
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # Environment template
│   │
│   ├── src/                       # Source code
│   │   ├── service.py             # Main service
│   │   ├── start.py               # Entry point
│   │   │
│   │   ├── core/                  # Core modules
│   │   │   ├── device.py          # Device management
│   │   │   ├── telemetry.py       # iRacing SDK
│   │   │   ├── laps.py            # Lap recording
│   │   │   └── controls.py        # Keystroke controls
│   │   │
│   │   ├── api/                   # Optional API server
│   │   │   └── minimal_server.py  # Minimal Flask API
│   │   │
│   │   └── gui/                   # Tkinter GUI
│   │       └── main.py            # GUI window
│   │
│   ├── tests/                     # Tests
│   │   └── test_service.py
│   │
│   └── docs/                      # Service-specific docs
│       └── API.md
│
├── web-app/                       # 🌐 Next.js Web Application
│   ├── README.md                  # App README
│   ├── package.json               # Node dependencies
│   ├── .env.example               # Environment template
│   │
│   ├── src/                       # Source code
│   │   ├── app/                   # Next.js app directory
│   │   │   ├── layout.tsx         # Root layout
│   │   │   ├── page.tsx           # Home page
│   │   │   ├── dashboard/         # Dashboard pages
│   │   │   └── globals.css        # Global styles
│   │   │
│   │   ├── components/            # React components
│   │   │   ├── Hero.tsx
│   │   │   ├── Features.tsx
│   │   │   └── ...
│   │   │
│   │   └── lib/                  # Utilities
│   │       └── supabase.ts       # Supabase client
│   │
│   ├── public/                    # Static assets
│   │   └── ...
│   │
│   └── docs/                      # App-specific docs
│       └── COMPONENTS.md
│
└── reference/                     # 📖 Reference Materials
    ├── README.md                  # Reference guide
    ├── ircommander/               # Notes from old version
    ├── archive/                   # Notes from Archive/
    └── migration/                # Migration notes
```

---

## 📂 **Directory Purposes**

### **`docs/`** - Documentation Hub
All project documentation organized by type.

### **`pc-service/`** - Python PC Service
Lightweight service for rig operations.

### **`web-app/`** - Next.js Web Application
Public-facing website hosted on Vercel.

### **`reference/`** - Reference Materials
Old code references (for learning, not copying).

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
- **API reference:** `docs/reference/`
- **PC service code:** `pc-service/src/`
- **Web app code:** `web-app/src/`

---

**Last Updated:** January 2025



