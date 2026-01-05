# iRCommander

**iRacing rig management platform - Fresh start**

---

## 📋 **Overview**

iRCommander is a complete refactor of the GridPass platform, providing:
- **Website & API** - Next.js app hosted at `ircommander.gridpass.app`
- **Client** - Python service that runs on racing rigs
- **Same Supabase** - Uses existing database (no migration needed)

---

## 🏗️ **Architecture**

```
                    ┌──────────────────────────────────┐
                    │       End Users / Drivers        │
                    └────────────────┬─────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │    ircommander.gridpass.app      │
                    │    (Website + API - ircommander/)│
                    │  • Public REST APIs              │
                    │  • Authentication                │
                    │  • Device Management             │
                    └────────────────┬─────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │         Supabase                 │
                    │       (Database Layer)           │
                    └────────────────▲─────────────────┘
                                     │ API calls
                    ┌────────────────┴─────────────────┐
                    │   iRCommander Client                │
                    │   (ircommander_client/)              │
                    │  • Runs on each rig               │
                    │  • iRacing SDK integration        │
                    │  • Telemetry & lap collection     │
                    │  • API-first architecture         │
                    └───────────────────────────────────┘
```

---

## 📁 **Repository Structure**

```
RevShareRacing/
├── ircommander/              # 🌐 Website + API (Next.js)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/v1/       # REST API endpoints
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── lib/              # Utilities
│   └── package.json
│
├── ircommander_client/         # 🖥️ Client (Python)
│   ├── api_client.py         # IRCommanderAPI client
│   ├── service.py            # Main service
│   ├── gui.py                # PyQt6 GUI
│   └── core/                 # Core modules
│
├── gridpass-app/             # 📦 Old app (can archive)
│
├── migrations/               # 📊 Database Migrations
│
└── docs/                     # 📚 Documentation
```

---

## 🚀 **Quick Start**

### **iRCommander Website/API (ircommander/)**
```bash
cd ircommander
npm install
npm run dev  # Runs on port 3001
```

### **iRCommander Client (ircommander_client/)**
```bash
cd ircommander_client
pip install -r requirements.txt

# Run with GUI
python main.py

# Run headless
python main.py --headless
```

---

## 🔐 **Configuration**

### **iRCommander Website/API**
Create `ircommander/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### **iRCommander Client**
Create `ircommander_client/.env`:
```env
# Point to your iRCommander deployment
IRCOMMANDER_API_URL=https://ircommander.gridpass.app

# Or for local development:
IRCOMMANDER_API_URL=http://localhost:3001
```

**⚠️ Important:** The client must point to the same URL where your `ircommander/` app is deployed.

---

## 📡 **API Endpoints**

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Token refresh
- `GET /api/v1/auth/me` - Current user profile

### Devices
- `POST /api/v1/device/register` - Register device
- `POST /api/v1/device/heartbeat` - Device heartbeat
- `GET /api/v1/device/status` - Device status
- `PUT /api/v1/device/status` - Update device status
- `POST /api/v1/device/laps` - Upload lap data
- `GET /api/v1/device/commands` - Poll for commands
- `POST /api/v1/device/commands/:id/complete` - Complete command

### Queue
- `GET /api/v1/devices/:id/queue` - Current queue
- `POST /api/v1/devices/:id/queue` - Join queue
- `DELETE /api/v1/devices/:id/queue` - Leave queue
- `POST /api/v1/devices/:id/queue/activate` - Start session
- `POST /api/v1/devices/:id/queue/complete` - End session

### Leaderboards & Credits
- `GET /api/v1/leaderboards` - Global leaderboards
- `GET /api/v1/credits/balance` - Credit balance
- `POST /api/v1/credits/purchase` - Purchase credits

---

## 🚢 **Deployment**

### Vercel (Website/API)
1. Create new Vercel project: `ircommander`
2. Connect to `ircommander/` directory
3. Set custom domain: `ircommander.gridpass.app`
4. Set environment variables in Vercel dashboard
5. Deploy: `vercel --prod`

### Client
The client runs on Windows machines with iRacing installed. No deployment needed - just run `python main.py` or use the compiled executable.

---

## 📚 **Documentation**

- [Refactor Notes](REFACTOR_NOTES.md) - Details about the refactor
- [Project Structure](PROJECT_STRUCTURE.md) - Directory structure
- [Vercel Projects](VERCEL_PROJECTS.md) - Vercel project reference
- [Configuration Guide](docs/guides/CONFIGURATION.md) - Setup help

---

## 🔄 **Migration from GridPass**

This is a **fresh start** with the same Supabase database:
- ✅ All API routes migrated
- ✅ Same database schema
- ✅ Same authentication
- ✅ New branding: "iRCommander"
- ✅ New URL: `ircommander.gridpass.app`

**No database migration needed** - just update your client configuration to point to the new URL.

---

## 🎯 **What's New**

1. **Clean Structure** - Fresh Next.js app, no legacy code
2. **Clear Naming** - "iRCommander" throughout
3. **Better Organization** - Single project, clear purpose
4. **Same Database** - No data loss, seamless transition

---

**Version:** 1.0.0 (Fresh Start)  
**Last Updated:** January 2025
