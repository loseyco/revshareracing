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
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://revshareracing.com
```

**Note:** `NEXT_PUBLIC_SITE_URL` is optional. If not set, it will use `window.location.origin` (useful for local development). For production, set it to your production domain (e.g., `https://revshareracing.com`).

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



