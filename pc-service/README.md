# PC Service - iRacing Commander V4

**Lightweight Python service for rig operations**

---

## 🎯 **Purpose**

Handles PC-specific operations that require direct hardware/software access:
- ✅ Lap collection from iRacing
- ✅ Rig registration to Supabase
- ✅ Keystroke/control commands
- ✅ Config retrieval

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
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

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

## ✅ **Status**

**Current:** ✅ Core functionality complete  
**Next:** Add minimal API server, enhance GUI

---

**Version:** 4.0.0
