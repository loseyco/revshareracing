# GridPass Platform + RevShareRacing

**Multi-tenant sim racing management platform**

---

## 📋 **Overview**

This repository contains two related but legally separate entities:

1. **GridPass** - The platform that manages racing rigs, queues, and telemetry
2. **RevShareRacing** - A tenant application that uses GridPass for sim racing experiences

This separation allows GridPass to operate as an independent B2B platform while RevShareRacing focuses on the consumer racing experience.

---

## 🏗️ **Architecture**

```
                    ┌──────────────────────────────────┐
                    │       End Users / Drivers        │
                    └────────────────┬─────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │      RevShareRacing.com          │
                    │      (Tenant Application)        │
                    │      web-app/                    │
                    └────────────────┬─────────────────┘
                                     │ API calls
                    ┌────────────────▼─────────────────┐
                    │        GridPass.app              │
                    │    (Platform - gridpass-app/)    │
                    │  • Public REST APIs              │
                    │  • Authentication                │
                    │  • Tenant Management             │
                    └────────────────┬─────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │         Supabase                 │
                    │       (Database Layer)           │
                    └────────────────▲─────────────────┘
                                     │ Direct access
                    ┌────────────────┴─────────────────┐
                    │       PC Service                 │
                    │      (pc-service/)               │
                    │  • Runs on each rig              │
                    │  • iRacing SDK integration       │
                    │  • Telemetry & lap collection    │
                    └──────────────────────────────────┘
```

---

## 📁 **Repository Structure**

```
RevShareRacing/
├── gridpass-app/           # GridPass Platform (NEW)
│   ├── src/app/api/v1/     # Public REST APIs
│   ├── src/lib/            # Platform utilities
│   └── README.md           # Platform documentation
│
├── web-app/                # RevShareRacing.com (Tenant)
│   ├── src/app/            # Next.js pages and API routes
│   ├── src/components/     # React components
│   ├── src/lib/            # Client libraries (incl. GridPass client)
│   └── README.md           # Tenant app documentation
│
├── pc-service/             # PC Service (Part of GridPass)
│   ├── src/                # Python service code
│   ├── data/               # Local device config
│   └── README.md           # Service documentation
│
├── migrations/             # Database migrations
│   └── create_gridpass_tenants.sql  # Multi-tenant setup
│
└── docs/                   # Documentation
    ├── architecture/       # System architecture
    ├── guides/             # How-to guides
    └── decisions/          # Architecture decisions
```

---

## 🚀 **Quick Start**

### **GridPass Platform (gridpass-app/)**
```bash
cd gridpass-app
npm install
npm run dev  # Runs on port 3001
```

### **RevShareRacing (web-app/)**
```bash
cd web-app
npm install
npm run dev  # Runs on port 3000
```

### **PC Service (pc-service/)**
```bash
cd pc-service
pip install -r requirements.txt
python start.py
```

---

## 🔐 **Configuration**

### **GridPass Platform**
Create `gridpass-app/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### **RevShareRacing**
Create `web-app/.env.local`:
```env
# Direct Supabase access (current mode)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# To use GridPass APIs instead:
NEXT_PUBLIC_USE_GRIDPASS=true
NEXT_PUBLIC_GRIDPASS_API_URL=https://gridpass.app
GRIDPASS_TENANT_KEY=your-tenant-api-key
```

---

## 📡 **GridPass API Endpoints**

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Token refresh
- `GET /api/v1/auth/me` - Current user profile

### Devices
- `GET /api/v1/devices` - List devices
- `GET /api/v1/devices/:id` - Device details
- `GET /api/v1/devices/:id/status` - Real-time status

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

## 🎯 **Key Benefits**

1. **Legal Separation** - GridPass and RevShareRacing are independent entities
2. **Multi-tenant** - GridPass can serve multiple racing companies
3. **API-First** - Clean contract between platform and tenants
4. **Scalable** - Each component scales independently
5. **Maintainable** - Clear separation of concerns

---

## 📚 **Documentation**

- [Architecture Overview](docs/architecture/ARCHITECTURE.md)
- [GridPass Platform](gridpass-app/README.md)
- [RevShareRacing Web App](web-app/README.md)
- [PC Service](pc-service/README.md)
- [Database Migrations](migrations/)

---

## 🔄 **Migration Mode**

RevShareRacing can operate in two modes:

1. **Direct Mode** (current) - Direct Supabase access
2. **GridPass Mode** - API calls to GridPass platform

Set `NEXT_PUBLIC_USE_GRIDPASS=true` to switch to GridPass mode.

---

**Version:** 4.0.0 (GridPass Platform)  
**Last Updated:** December 2024
