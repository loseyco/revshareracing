# iRCommander Testing Guide

**Complete testing checklist for the new iRCommander setup**

---

## 🧪 **Test Checklist**

### 1. API Health Check ✅
- [ ] Health endpoint responds
- [ ] Returns correct API name ("iRCommander API")
- [ ] All endpoint listings are correct

### 2. Authentication ✅
- [ ] User registration works
- [ ] User login works
- [ ] Token refresh works
- [ ] /api/v1/auth/me returns user info

### 3. Device Registration ✅
- [ ] Device can register
- [ ] Returns device_id and api_key
- [ ] Device appears in database

### 4. Device Operations ✅
- [ ] Heartbeat works
- [ ] Status update works
- [ ] Status retrieval works
- [ ] Commands polling works

### 5. Client Connection ✅
- [ ] Client can connect to API
- [ ] Client can register device
- [ ] Client can send heartbeat
- [ ] Client can upload laps

### 6. Database Connectivity ✅
- [ ] Supabase connection works
- [ ] Queries execute successfully
- [ ] Data persists correctly

---

## 🚀 **Quick Test Commands**

### Test API Health
```bash
curl https://ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app/api/v1/health
```

### Test Local API (if running dev server)
```bash
curl http://localhost:3001/api/v1/health
```

### Test Client Connection
```bash
cd ircommander_client
python -c "from api_client import get_api; api = get_api(); print(api.api_url)"
```

---

## 📝 **Detailed Tests**

See `TEST_SCRIPTS.md` for detailed test scripts.

---

**Last Updated:** January 2025
