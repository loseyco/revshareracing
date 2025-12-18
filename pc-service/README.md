# GridPass PC Service

**Lightweight Python service for rig operations**

Part of the GridPass platform - provides the local rig management component that runs on racing simulator computers.

---

## 🎯 **Purpose**

Handles PC-specific operations that require direct hardware/software access:
- ✅ Lap collection from iRacing SDK
- ✅ Rig registration and heartbeat to Supabase
- ✅ Queue monitoring and session management
- ✅ Keystroke/control commands to iRacing
- ✅ Real-time telemetry updates

This service is used by tenant applications like RevShareRacing.com to manage physical racing rigs.

---

## 🚀 **Quick Start**

### **1. Install Dependencies**
```bash
cd pc-service
pip install -r requirements.txt
```

### **2. Configure**
Copy `.env.example` to `.env` and fill in your Supabase credentials:
```bash
cp .env.example .env
# Edit .env with your Supabase URL and keys
```

### **3. Run Service**
```bash
# With GUI (default)
python start.py

# Without GUI
python start.py --no-gui

# With API server
python start.py --api
```

---

## 📁 **Structure**

```
pc-service/
├── README.md           # This file
├── requirements.txt    # Python dependencies
├── .env.example       # Environment template
├── start.py           # Entry point
├── data/              # Local data (device config, etc.)
└── src/               # Source code
    ├── config.py      # Configuration loader
    ├── service.py     # Main service
    ├── core/          # Core modules
    │   ├── device.py  # Device management
    │   ├── telemetry.py  # iRacing SDK
    │   ├── laps.py    # Lap recording
    │   └── controls.py # Keystroke controls
    └── gui/           # Tkinter GUI (optional)
        └── main.py    # GUI window
```

---

## ⚙️ **Configuration**

Create `.env` file in `pc-service/` directory:

```env
# Supabase Configuration (GridPass database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# GridPass Platform Settings (optional)
GRIDPASS_PORTAL_URL=https://gridpass.app
REVSHARERACING_PORTAL_URL=https://revshareracing.com
GRIDPASS_DEFAULT_TENANT_ID=a0000000-0000-0000-0000-000000000001
```

For production distribution, the service includes hardcoded defaults for the GridPass Supabase instance.

---

## 🎮 **Features**

### **Lap Collection**
- Connects to iRacing SDK automatically
- Detects lap completion
- Uploads lap data to Supabase
- Runs in background thread (~10Hz check rate)

### **Rig Registration**
- Registers rig to Supabase
- Saves device config locally
- Updates network info automatically

### **Keystroke Controls**
- Maps keyboard shortcuts to iRacing actions
- F1-F12 emergency controls
- Direct SDK integration

### **GUI (Optional)**
- Beautiful dark theme
- Device info display
- Service status
- System logs
- Quick actions

---

## 📚 **Documentation**

- Architecture: `../docs/architecture/`
- Guides: `../docs/guides/`
- Reference: `../docs/reference/`

---

## 🔧 **Development**

### **Test Individual Modules:**
```bash
# Test device module
python -m src.core.device

# Test telemetry module
python -m src.core.telemetry

# Test laps module
python -m src.core.laps
```

### **Run Service:**
```bash
python start.py
```

---

## 🏗️ **Architecture**

The PC Service is part of the GridPass platform architecture:

```
┌─────────────────────┐
│  Tenant Apps        │
│  (RevShareRacing)   │
└──────────┬──────────┘
           │ API calls
           ▼
┌─────────────────────┐
│  GridPass Platform  │
│  (gridpass.app)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     Supabase        │◄──────┐
│    (Database)       │       │ Direct access
└─────────────────────┘       │
                              │
                    ┌─────────┴─────────┐
                    │   PC Service      │
                    │ (This component)  │
                    │ Runs on each rig  │
                    └───────────────────┘
```

## ✅ **Status**

**Current:** ✅ Core functionality complete  
**Platform:** GridPass v1.0.0

---

**Version:** 4.0.0 (GridPass Platform)
