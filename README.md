# GridPass Commander V4

**Professional, Clean, Organized Version**

---

## 📋 **Project Overview**

GridPass Commander V4 is a complete rebuild with clean architecture, professional organization, and comprehensive documentation.

**Key Principles:**
- ✅ Clean separation of concerns
- ✅ Professional documentation structure
- ✅ Organized codebase
- ✅ Clear guides and references
- ✅ Best practices throughout

---

## 🏗️ **Architecture**

### **Two-Component System:**

1. **Python PC Service** (`pc-service/`)
   - Lightweight service for rig operations
   - Lap collection, rig registration, keystrokes, configs
   - Direct Supabase communication

2. **Vercel Web Application** (`web-app/`)
   - All webpages hosted on Vercel
   - User authentication, dashboards, queue management
   - Direct Supabase communication

### **Shared Database:**
- Supabase PostgreSQL
- Single source of truth
- Real-time sync

---

## 📁 **Directory Structure**

```
_V4/
├── README.md                    # This file
├── docs/                        # Documentation hub
│   ├── architecture/            # System architecture docs
│   ├── guides/                  # How-to guides
│   ├── reference/               # API & schema reference
│   ├── notes/                   # Development notes
│   └── decisions/               # Architecture decisions
├── pc-service/                  # Python PC service
│   ├── README.md
│   ├── src/
│   ├── tests/
│   └── docs/
├── web-app/                     # Vercel web application
│   ├── README.md
│   ├── src/
│   ├── public/
│   └── docs/
└── reference/                   # Reference materials from old versions
    ├── ircommander/             # Reference to old code
    └── notes/                   # Migration notes
```

---

## 🚀 **Quick Start**

### **1. PC Service**
```bash
cd pc-service
python start.py
```

### **2. Web Application**
```bash
cd web-app
npm install
npm run dev
```

---

## 📚 **Documentation**

- **Architecture**: `docs/architecture/`
- **Guides**: `docs/guides/`
- **Reference**: `docs/reference/`
- **Notes**: `docs/notes/`
- **Decisions**: `docs/decisions/`

---

## 🎯 **Development Status**

**Current Phase:** PC Service Complete  
**Status:** 🟢 PC Service Ready

### **Completed:**
- ✅ PC Service structure and code
- ✅ Core modules (device, telemetry, laps, controls)
- ✅ Service with lap collection
- ✅ GUI support
- ✅ Configuration system
- ✅ Documentation

### **Next:**
- ⏳ Web application (Vercel)
- ⏳ Minimal API server (optional)

---

## 📝 **Contributing**

This is a clean rebuild. Use old versions (`ircommander/`, `Archive/`) as reference only.

---

**Version:** 4.0.0  
**Last Updated:** January 2025

