# Web Application

**Next.js application hosted on Vercel**

---

## 🎯 **Purpose**

Public-facing website with all user interfaces:
- User authentication
- Dashboards
- Queue management
- Leaderboards
- User profiles

---

## 📁 **Structure**

```
web-app/
├── README.md           # This file
├── src/                # Source code
│   ├── app/            # Next.js app directory
│   ├── components/     # React components
│   └── lib/            # Utilities
├── public/             # Static assets
├── docs/               # App-specific docs
└── package.json        # Dependencies
```

---

## 🚀 **Quick Start**

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Production
npm start
```

---

## ⚙️ **Configuration**

Create `.env.local` file:
```env
# Supabase Configuration (for direct database access)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://revshareracing.com

# GridPass Platform Configuration (optional)
# Set NEXT_PUBLIC_USE_GRIDPASS=true to use GridPass APIs instead of direct Supabase
NEXT_PUBLIC_USE_GRIDPASS=false
NEXT_PUBLIC_GRIDPASS_API_URL=https://gridpass.app
GRIDPASS_TENANT_KEY=your-gridpass-tenant-key
```

**Notes:**
- `NEXT_PUBLIC_SITE_URL` is optional. If not set, it will use `window.location.origin`.
- When `NEXT_PUBLIC_USE_GRIDPASS=true`, the app communicates with GridPass platform APIs instead of direct Supabase access.
- `GRIDPASS_TENANT_KEY` is required for B2B API access to GridPass.

---

## 📚 **Documentation**

- Architecture: `docs/architecture/`
- Guides: `docs/guides/`
- API Reference: `docs/reference/`

---

## 🚀 **Deployment**

Deploy to Vercel:
```bash
vercel
```

Or connect GitHub repo for auto-deploy.

---

**Version:** 4.0.0



