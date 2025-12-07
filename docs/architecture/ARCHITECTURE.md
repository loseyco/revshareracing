# GridPass Commander V4 - Architecture

**Version:** 4.0.0  
**Date:** January 2025  
**Status:** ✅ Documented

---

## 🎯 **Overview**

GridPass Commander V4 uses a clean, separated architecture with two main components:

1. **PC Service** - Runs on rig computers
2. **Web Application** - Hosted on Vercel

Both communicate directly with Supabase (no intermediate API layer).

---

## 🏗️ **System Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Web)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Login      │  │   Dashboard  │  │    Queue     │ │
│  │   Signup     │  │  Leaderboard │  │   Join/Leave │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Supabase    │
                    │   (Database)  │
                    └───────┬───────┘
                            │
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    PC Service                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Lap Collect  │  │   Register   │  │  Keystrokes  │ │
│  │  (iRacing)   │  │     Rig      │  │   (iRacing)  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Supabase    │
                    │   (Database)  │
                    └───────────────┘
```

---

## 🖥️ **PC Service**

### **Purpose:**
Handles PC-specific operations requiring direct hardware/software access.

### **Responsibilities:**
- ✅ Lap collection from iRacing SDK
- ✅ Rig registration to Supabase
- ✅ Keystroke/control commands to iRacing
- ✅ Config retrieval from Supabase
- ✅ Direct Supabase communication

### **Technology:**
- Python 3.10+
- iRacing SDK (irsdk)
- Supabase Python client
- Tkinter GUI (optional)

### **Location:**
`pc-service/`

---

## 🌐 **Web Application**

### **Purpose:**
Public-facing website with all user interfaces.

### **Responsibilities:**
- ✅ User authentication (Supabase Auth)
- ✅ Dashboards and data display
- ✅ Queue management
- ✅ Leaderboards
- ✅ User profiles

### **Technology:**
- Next.js 14
- React 18
- Tailwind CSS
- Supabase JS client

### **Location:**
`web-app/`

---

## 💾 **Database (Supabase)**

### **Purpose:**
Single source of truth for all data.

### **Tables:**
- `irc_user_profiles` - User accounts
- `irc_devices` - Registered rigs
- `irc_laps` - Lap records
- `irc_device_queue` - Queue entries
- `irc_companies` - Venue/company info
- `irc_sessions` - Driving sessions

### **Features:**
- Row-Level Security (RLS)
- Real-time subscriptions
- Automatic backups
- Encrypted connections

---

## 🔄 **Data Flow**

### **User Joins Queue (Vercel):**
```
User → Vercel Web → Supabase → Queue Table
```

### **Lap Collection (PC Service):**
```
iRacing SDK → PC Service → Supabase → Laps Table
```

### **Queue Activation (PC Service):**
```
PC Service → Polls Supabase → Detects Queue Change → Activates iRacing
```

---

## 🔐 **Security**

### **Vercel Web:**
- HTTPS only
- Supabase RLS policies
- No rig control access
- Public read, authenticated write

### **PC Service:**
- Localhost only
- Direct Supabase (HTTPS)
- Service-role key for admin ops
- No inbound connections

### **Supabase:**
- Row-Level Security
- Encrypted connections
- API key security
- User data isolation

---

## 📊 **Benefits**

1. **Simplicity** - Clear separation of concerns
2. **Scalability** - Vercel handles web traffic, PC service is lightweight
3. **Maintainability** - Update components independently
4. **Cost** - Free/low-cost hosting (Vercel + Supabase free tiers)
5. **Performance** - Direct database connections, no API overhead

---

## 📝 **Related Documents**

- `SEPARATED_ARCHITECTURE.md` - Detailed separation explanation
- `DATA_FLOW.md` - Data flow diagrams
- `SECURITY.md` - Security model details

---

**Last Updated:** January 2025



