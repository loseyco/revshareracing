# Quick Start Guide

**Get GridPass Commander V4 running in minutes**

---

## 🚀 **Prerequisites**

- Python 3.10+ installed
- Node.js 18+ installed
- Supabase account and project
- iRacing installed (for PC service)

---

## 📋 **Step 1: Clone & Setup**

```bash
# Navigate to V4 directory
cd _V4

# Setup PC Service
cd pc-service
pip install -r requirements.txt

# Setup Web App
cd ../web-app
npm install
```

---

## ⚙️ **Step 2: Configuration**

### **PC Service:**

Create `pc-service/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### **Web App:**

Create `web-app/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🖥️ **Step 3: Run PC Service**

```bash
cd pc-service
python start.py
```

**With GUI:**
- GUI window opens automatically
- Shows device info and status
- "Open Vercel Dashboard" button

**Without GUI:**
```bash
python start.py --no-gui
```

**With API Server:**
```bash
python start.py --api
```

---

## 🌐 **Step 4: Run Web App**

```bash
cd web-app
npm run dev
```

Open `http://localhost:3000`

---

## ✅ **Verify Setup**

1. **PC Service:**
   - Check GUI shows device info
   - Verify Supabase connection in logs

2. **Web App:**
   - Open `http://localhost:3000`
   - Try signup/login
   - Verify Supabase connection

---

## 🎯 **Next Steps**

- See `SETUP.md` for complete setup
- See `DEPLOYMENT.md` for production deployment
- See `DEVELOPMENT.md` for development workflow

---

**Need Help?** Check `docs/guides/` for detailed guides.



