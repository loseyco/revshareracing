# Complete Testing Guide

**Step-by-step guide to test everything**

---

## 🚀 **Quick Start Testing**

### 1. Test Client Configuration
```bash
cd ircommander_client
python test_client.py
```

This will:
- ✅ Check API URL configuration
- ✅ Test connection to API
- ✅ Verify device registration status
- ✅ Check authentication status

### 2. Test Local API Server
```bash
cd ircommander
npm run dev
```

Then in another terminal:
```bash
# Test health endpoint
curl http://localhost:3001/api/v1/health

# Or use PowerShell:
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/health"
```

### 3. Test Production API
```bash
# First, disable password protection in Vercel:
# Dashboard → ircommander → Settings → Deployment Protection → Disable

# Then test:
curl https://ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app/api/v1/health
```

---

## 📋 **Complete Test Checklist**

### ✅ Code Structure
- [x] All API routes migrated to `ircommander/`
- [x] All lib files in place
- [x] Client code updated to use `IRCommanderAPI`
- [x] Configuration files correct

### ⏳ API Testing
- [ ] Local dev server starts (`npm run dev`)
- [ ] Health endpoint works (`/api/v1/health`)
- [ ] Returns "iRCommander API" in response
- [ ] All endpoint routes accessible

### ⏳ Client Testing
- [ ] Client can read API URL from config
- [ ] Client can connect to API
- [ ] Client can register device (with auth)
- [ ] Client can send heartbeat
- [ ] Client can upload laps

### ⏳ Authentication Testing
- [ ] User registration works
- [ ] User login works
- [ ] Token refresh works
- [ ] `/api/v1/auth/me` returns user info

### ⏳ Database Testing
- [ ] Supabase connection works
- [ ] Queries execute successfully
- [ ] Data persists correctly

---

## 🔧 **Troubleshooting**

### Issue: Vercel Password Protection
**Solution:** Disable in Vercel Dashboard → Settings → Deployment Protection

### Issue: Client Can't Connect
**Check:**
1. API URL in `ircommander_client/.env` is correct
2. API server is running (local or production)
3. No firewall blocking connection

### Issue: Unicode Errors in Tests
**Solution:** Fixed in `test_client.py` - uses UTF-8 encoding

---

## 📊 **Test Results**

See `TEST_RESULTS.md` for detailed test results.

---

**Last Updated:** January 2025
