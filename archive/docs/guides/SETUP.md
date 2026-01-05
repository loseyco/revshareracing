# Complete Setup Guide

**Detailed setup instructions for Rev Share Racing**

---

## 📋 **Prerequisites**

### **Required:**
- Python 3.10 or higher
- Node.js 18 or higher
- Git
- Supabase account (free tier works)

### **Optional:**
- iRacing installed (for PC service testing)
- Vercel account (for web app deployment)

---

## 🔧 **Step 1: Environment Setup**

### **Python Environment:**
```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate
```

### **Node.js Environment:**
```bash
# Verify Node.js version
node --version  # Should be 18+

# Install dependencies (when ready)
cd web-app
npm install
```

---

## 🗄️ **Step 2: Supabase Setup**

### **Create Project:**
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note your project URL and API keys

### **Get API Keys:**
- **Project URL:** `https://your-project.supabase.co`
- **Anon Key:** Found in Settings → API
- **Service Role Key:** Found in Settings → API (keep secret!)

---

## 🖥️ **Step 3: PC Service Setup**

### **Install Dependencies:**
```bash
cd pc-service
pip install -r requirements.txt
```

### **Configure:**
Create `pc-service/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### **Test:**
```bash
python start.py
```

Should see:
- ✅ GUI window (if tkinter available)
- ✅ Supabase connection successful
- ✅ Service started

---

## 🌐 **Step 4: Web App Setup**

### **Install Dependencies:**
```bash
cd web-app
npm install
```

### **Configure:**
Create `web-app/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### **Test:**
```bash
npm run dev
```

Open `http://localhost:3000`

---

## ✅ **Step 5: Verify Setup**

### **PC Service:**
- [ ] GUI opens (or runs headless)
- [ ] Supabase connection successful
- [ ] No errors in logs

### **Web App:**
- [ ] Dev server starts
- [ ] Page loads at localhost:3000
- [ ] No console errors

---

## 🚀 **Next Steps**

- See `QUICK_START.md` for basic usage
- See `DEPLOYMENT.md` for production setup
- See `DEVELOPMENT.md` for development workflow

---

**Need Help?** Check `docs/guides/` for more guides.



