# PC Service Setup Guide

**Complete setup instructions for iRacing Commander V4 PC Service**

---

## 📋 **Prerequisites**

- Python 3.10 or higher
- Supabase account and project
- iRacing installed (optional, for testing)

---

## 🔧 **Step 1: Install Dependencies**

```bash
cd _V4/pc-service
pip install -r requirements.txt
```

**Optional:** Install iRacing SDK (if you have iRacing):
```bash
pip install irsdk
```

---

## ⚙️ **Step 2: Configure**

### **Create `.env` file:**

Copy the example:
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### **Get Supabase Credentials:**

1. Go to [supabase.com](https://supabase.com)
2. Open your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

---

## 🚀 **Step 3: Run Service**

### **With GUI (Recommended):**
```bash
python start.py
```

### **Without GUI:**
```bash
python start.py --no-gui
```

### **With API Server:**
```bash
python start.py --api
```

---

## ✅ **Step 4: Verify**

### **Check Console Output:**
You should see:
```
[*] Connecting to Supabase...
[OK] Supabase connected!
[OK] Modules configured
[OK] Rig service started
[*] Collecting laps for device: [device_id or Not registered]
```

### **Check GUI (if enabled):**
- GUI window opens
- Shows device info
- Shows service status
- Logs show connection success

---

## 🎯 **What It Does**

### **Automatically:**
- ✅ Connects to Supabase
- ✅ Collects laps from iRacing (if running)
- ✅ Uploads lap data to Supabase
- ✅ Monitors telemetry (~10Hz)

### **On Demand:**
- Register rig (via API or web interface)
- Send keystrokes (via API)
- Get config (via API)

---

## 🐛 **Troubleshooting**

### **"Supabase not connected"**
- Check `.env` file exists
- Verify credentials are correct
- Check internet connection

### **"iRacing SDK not available"**
- This is normal if iRacing isn't running
- Service will run in mock mode
- Install `irsdk` package if you have iRacing

### **"Device not registered"**
- This is normal on first run
- Register device via web interface or API
- Device will be registered automatically

---

## 📚 **Next Steps**

- See `README.md` for more info
- See `../docs/guides/` for detailed guides
- Register your rig via the Vercel web interface

---

**Need Help?** Check `../docs/guides/` for more guides.

