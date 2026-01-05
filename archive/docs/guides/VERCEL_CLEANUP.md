# Vercel Projects Cleanup Guide

**Consolidating your GridPass Vercel deployments**

---

## 🔍 **Current Situation**

Based on your Vercel dashboard, you have multiple projects that appear to be duplicates:

### GridPass-Related Projects (Same Repo: `loseyco/iracingcommander`)

1. **`gridpass-app`** ✅ **KEEP THIS ONE**
   - Domain: `gridpass-app.vercel.app`
   - Repo: `loseyco/iracingcommander`
   - **This matches your current codebase structure** (`gridpass-app/` directory)
   - Last deployment: Recent (5m ago)

2. **`iracingcommander`** ❌ **DELETE (Duplicate)**
   - Domain: `commander.gridpass.app`
   - Repo: `loseyco/iracingcommander` (same as gridpass-app)
   - Last deployment: 12/22/25

3. **`ircommander`** ❌ **DELETE (Duplicate)**
   - Domain: `ircommander.vercel.app`
   - Repo: `loseyco/iracingcommander` (same as gridpass-app)
   - Last deployment: 12/22/25

### Other GridPass Projects (Different Repos)

4. **`gridpass`** ⚠️ **REVIEW**
   - Domain: `www.gridpass.app`
   - Repo: `loseyco/gridpass` (different repo!)
   - Last deployment: 11/5/25
   - **Question:** Is this an old version or a different project?

5. **`gridpass-iracing`** ⚠️ **REVIEW**
   - Domain: `iracing.gridpass.app`
   - Repo: `loseyco/gridpass-iracing` (different repo!)
   - Last deployment: 9/9/25
   - **Question:** Is this still needed?

---

## ✅ **Recommended Action Plan**

### Step 1: Identify Your Primary Project

**Primary Project:** `gridpass-app`
- This matches your codebase structure
- Most recent deployment
- Should be your main GridPass platform deployment

### Step 2: Set Up Domain Aliases (Optional)

If you want `commander.gridpass.app` to work, add it as an alias to `gridpass-app`:

1. Go to Vercel Dashboard → `gridpass-app` project
2. Settings → Domains
3. Add `commander.gridpass.app` as an alias
4. This way you can keep the domain without duplicate projects

### Step 3: Delete Duplicate Projects

**Safe to Delete:**
- `iracingcommander` (duplicate of gridpass-app)
- `ircommander` (duplicate of gridpass-app)

**Before Deleting:**
1. Verify `gridpass-app` is working correctly
2. Check if any devices/clients are using the old URLs
3. Update any hardcoded URLs in your code/config

### Step 4: Review Other Projects

**Decide on:**
- `gridpass` - Is this an old version? Archive or delete?
- `gridpass-iracing` - Still needed? Archive or delete?

---

## 🗑️ **How to Delete Projects in Vercel**

### Via Dashboard:
1. Go to Vercel Dashboard
2. Click on the project you want to delete
3. Go to **Settings** → **General**
4. Scroll to bottom → **Delete Project**
5. Type project name to confirm
6. Click **Delete**

### Via CLI:
```bash
# List projects
vercel ls

# Delete a project (you'll need the project ID)
vercel remove <project-name>
```

---

## 📝 **After Cleanup: Update Configuration**

Once you've consolidated to a single project, update:

### 1. Commander Client Config
Update `commander_client/.env`:
```env
# Use your primary Vercel project URL
GRIDPASS_API_URL=https://gridpass-app.vercel.app

# OR if you set up a custom domain alias:
GRIDPASS_API_URL=https://commander.gridpass.app
```

### 2. Document Your Setup
Create a note of:
- Primary Vercel project: `gridpass-app`
- Primary domain: `gridpass-app.vercel.app`
- Custom domain (if any): `commander.gridpass.app` (alias)

---

## 🎯 **Recommended Final Structure**

**Keep:**
- ✅ `gridpass-app` - Primary GridPass platform (from `gridpass-app/` directory)

**Delete:**
- ❌ `iracingcommander` - Duplicate
- ❌ `ircommander` - Duplicate

**Review & Decide:**
- ⚠️ `gridpass` - Different repo, might be old version
- ⚠️ `gridpass-iracing` - Different repo, might be old version

**Other Projects (Keep - Different Purpose):**
- ✅ `revshareracing` - Tenant application (different purpose)
- ✅ Other personal projects (resume, loseyco, etc.)

---

## ⚠️ **Before You Delete: Checklist**

- [ ] Verify `gridpass-app` is working and has latest code
- [ ] Check if any devices are using old URLs (`commander.gridpass.app`, `ircommander.vercel.app`)
- [ ] Update `commander_client/.env` to point to `gridpass-app.vercel.app`
- [ ] Test API connection from commander client
- [ ] Set up domain alias if you want to keep `commander.gridpass.app`
- [ ] Document which project is the "real" one

---

## 🔗 **Setting Up Domain Aliases**

If you want `commander.gridpass.app` to point to `gridpass-app`:

1. **In Vercel Dashboard:**
   - Go to `gridpass-app` project
   - Settings → Domains
   - Add Domain: `commander.gridpass.app`
   - Vercel will handle DNS automatically

2. **Update Commander Client:**
   ```env
   GRIDPASS_API_URL=https://commander.gridpass.app
   ```

This way you get the nice domain name without duplicate projects!

---

## 📊 **Project Mapping Reference**

| Project Name | Domain | Repo | Status | Action |
|--------------|--------|------|--------|--------|
| `gridpass-app` | `gridpass-app.vercel.app` | `loseyco/iracingcommander` | ✅ Primary | **KEEP** |
| `iracingcommander` | `commander.gridpass.app` | `loseyco/iracingcommander` | ❌ Duplicate | **DELETE** (or add as alias) |
| `ircommander` | `ircommander.vercel.app` | `loseyco/iracingcommander` | ❌ Duplicate | **DELETE** |
| `gridpass` | `www.gridpass.app` | `loseyco/gridpass` | ⚠️ Different | **REVIEW** |
| `gridpass-iracing` | `iracing.gridpass.app` | `loseyco/gridpass-iracing` | ⚠️ Different | **REVIEW** |

---

**Last Updated:** January 2025
