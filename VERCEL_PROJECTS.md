# Vercel Projects Reference

**Quick reference for which Vercel project is which**

---

## 🎯 **Primary Projects**

### GridPass Platform
- **Project:** `gridpass-app`
- **Domain:** `gridpass-app.vercel.app`
- **Repo:** `loseyco/iracingcommander`
- **Directory:** `gridpass-app/`
- **Purpose:** Main GridPass platform API (`/api/v1/*` endpoints)
- **Status:** ✅ **ACTIVE - Use this one!**

### RevShareRacing (Tenant App)
- **Project:** `revshareracing`
- **Domain:** `www.revshareracing.com`
- **Repo:** `loseyco/revshareracing`
- **Purpose:** Tenant application using GridPass APIs
- **Status:** ✅ Active

---

## 🗑️ **Duplicate Projects (To Delete)**

These are duplicates of `gridpass-app` pointing to the same repo:

1. **`iracingcommander`**
   - Domain: `commander.gridpass.app`
   - **Action:** Delete (or add `commander.gridpass.app` as alias to `gridpass-app`)

2. **`ircommander`**
   - Domain: `ircommander.vercel.app`
   - **Action:** Delete

---

## ⚠️ **Projects to Review**

1. **`gridpass`**
   - Domain: `www.gridpass.app`
   - Repo: `loseyco/gridpass` (different repo!)
   - **Question:** Old version? Different project?

2. **`gridpass-iracing`**
   - Domain: `iracing.gridpass.app`
   - Repo: `loseyco/gridpass-iracing` (different repo!)
   - **Question:** Still needed?

---

## 📝 **Configuration**

### Commander Client
Point to your primary project:
```env
GRIDPASS_API_URL=https://gridpass-app.vercel.app
```

Or if you set up a custom domain alias:
```env
GRIDPASS_API_URL=https://commander.gridpass.app
```

---

## 🔄 **Quick Commands**

### Check Current Deployment
```bash
cd gridpass-app
vercel ls
```

### Deploy to Primary Project
```bash
cd gridpass-app
vercel --prod
```

### List All Projects
```bash
vercel ls
```

---

**Last Updated:** January 2025
