# iRCommander Refactor - Notes

**Fresh start with new naming and structure**

---

## ✅ **Completed**

1. ✅ Created new `ircommander/` directory with fresh Next.js app
2. ✅ Migrated all API routes from `gridpass-app/` to `ircommander/`
3. ✅ Updated branding to "iRCommander" throughout
4. ✅ Updated API URL references to `ircommander.gridpass.app`
5. ✅ Updated client code to use `IRCommanderAPI` and new URL

---

## 📁 **New Structure**

```
RevShareRacing/
├── ircommander/              # 🌐 New Next.js app (website + API)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/v1/       # All API routes
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── lib/              # Utilities
│   └── package.json
│
├── commander_client/         # 🖥️ Client (to be renamed to ircommander_client)
│   ├── api_client.py         # Updated to IRCommanderAPI
│   ├── config.py             # Updated to use ircommander.gridpass.app
│   └── ...
│
└── gridpass-app/             # 📦 Old app (can be archived later)
```

---

## 🔄 **Still To Do**

### 1. Rename Directory
The `commander_client/` directory needs to be renamed to `ircommander_client/`. 
**Note:** If rename fails due to file locks, close any open files/processes and try again.

```bash
# When ready, rename:
Rename-Item -Path "commander_client" -NewName "ircommander_client"
```

### 2. Update All References
Search for remaining references to:
- `commander_client` → `ircommander_client`
- `GridPassAPI` → `IRCommanderAPI` (should be done)
- `GRIDPASS_API_URL` → `IRCOMMANDER_API_URL` (legacy support added)

### 3. Update Documentation
- Update README.md files
- Update PROJECT_STRUCTURE.md
- Create migration guide

### 4. Vercel Setup
1. Create new Vercel project: `ircommander`
2. Connect to `ircommander/` directory
3. Set domain: `ircommander.gridpass.app`
4. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 5. Client Configuration
Update `ircommander_client/.env` (when renamed):
```env
IRCOMMANDER_API_URL=https://ircommander.gridpass.app
```

---

## 🔗 **API URL Changes**

**Old:**
- Default: `https://gridpass.app`
- Client config: `GRIDPASS_API_URL`

**New:**
- Default: `https://ircommander.gridpass.app`
- Client config: `IRCOMMANDER_API_URL` (with `GRIDPASS_API_URL` fallback for compatibility)

---

## 📝 **Environment Variables**

### ircommander/ (Next.js App)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### ircommander_client/ (Python Client)
```env
IRCOMMANDER_API_URL=https://ircommander.gridpass.app
# Or for local dev:
IRCOMMANDER_API_URL=http://localhost:3001
```

---

## 🚀 **Next Steps**

1. **Test the new app locally:**
   ```bash
   cd ircommander
   npm install
   npm run dev
   ```

2. **Test API endpoints:**
   - Visit: http://localhost:3001/api/v1/health
   - Should return: `{ "api": "iRCommander API", ... }`

3. **Deploy to Vercel:**
   ```bash
   cd ircommander
   vercel --prod
   ```

4. **Update client to use new URL:**
   - Update `commander_client/.env` (or `ircommander_client/.env` when renamed)
   - Test connection

---

**Last Updated:** January 2025
