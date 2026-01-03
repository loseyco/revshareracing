# iRCommander

**iRacing rig management platform - API and web interface**

---

## Overview

iRCommander is the platform that manages racing rigs, queues, and telemetry for iRacing operations. It provides REST APIs and a web interface for device management.

---

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev  # Runs on port 3001

# Build for production
npm run build
npm start
```

---

## Configuration

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## API Endpoints

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

## Deployment

Deploy to Vercel with domain: `ircommander.gridpass.app`

```bash
vercel --prod
```

---

**Version:** 1.0.0  
**Last Updated:** January 2025
