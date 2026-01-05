# Configuration Guide

**Ensuring your site and service are properly configured**

---

## 🔗 **URL Alignment Issue**

If your site and service are talking to different Vercel projects or URLs, they won't be able to communicate. This guide helps you align them.

---

## 📍 **Understanding the Architecture**

```
┌─────────────────────┐
│  Commander Client   │  (commander_client/)
│  (On Rig PC)        │
└──────────┬──────────┘
           │ API calls to
           ▼
┌─────────────────────┐
│  GridPass Platform  │  (gridpass-app/)
│  (Vercel)           │
│  /api/v1/*          │
└─────────────────────┘
```

Both components need to use the **same base URL** for the GridPass API.

---

## ✅ **Step 1: Find Your Vercel Deployment URL**

### Option A: Using Vercel CLI
```bash
cd gridpass-app
vercel ls
```

Look for the production deployment URL (usually the most recent one).

### Option B: Using Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Select your `gridpass-app` project
3. Check the **Domains** section for your deployment URL
4. It will be either:
   - A Vercel URL: `https://gridpass-app-xxxxx.vercel.app`
   - A custom domain: `https://gridpass.app` (if configured)

---

## ✅ **Step 2: Configure Commander Client**

The commander client needs to point to your Vercel deployment.

### Create/Update `.env` file

Create `commander_client/.env`:

```env
# Replace with your actual Vercel deployment URL
GRIDPASS_API_URL=https://your-actual-vercel-url.vercel.app
```

**Examples:**
- Vercel URL: `GRIDPASS_API_URL=https://gridpass-app-abc123.vercel.app`
- Custom domain: `GRIDPASS_API_URL=https://gridpass.app`
- Local dev: `GRIDPASS_API_URL=http://localhost:3001`

---

## ✅ **Step 3: Verify Configuration**

### Check Commander Client Config
```bash
cd commander_client
python -c "from config import GRIDPASS_API_URL; print(f'API URL: {GRIDPASS_API_URL}')"
```

### Test API Connection
```bash
# From commander_client directory
python -c "
from api_client import GridPassAPI
api = GridPassAPI()
try:
    result = api._request('GET', '/api/v1/health', auth=False)
    print('✅ API connection successful!')
    print(f'Response: {result}')
except Exception as e:
    print(f'❌ API connection failed: {e}')
"
```

---

## ✅ **Step 4: Verify Vercel Environment Variables**

Make sure your Vercel deployment has the correct environment variables:

```bash
cd gridpass-app
vercel env ls
```

You should see:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 🔍 **Troubleshooting**

### Issue: "Site and service talking to different projects"

**Symptoms:**
- Commander client can't register devices
- API calls return 404 or connection errors
- Devices don't appear in the web dashboard

**Solution:**
1. Check `commander_client/.env` has the correct `GRIDPASS_API_URL`
2. Verify the URL matches your Vercel deployment
3. Test the API endpoint directly:
   ```bash
   curl https://your-vercel-url.vercel.app/api/v1/health
   ```

### Issue: "API URL mismatch"

**Check:**
- Commander client default: `commander_client/config.py` → `GRIDPASS_API_URL`
- Your `.env` file: `commander_client/.env` → `GRIDPASS_API_URL`
- Vercel deployment URL: Check Vercel dashboard

**Fix:**
- Update `commander_client/.env` to match your Vercel URL
- Restart the commander client

### Issue: "Can't connect to API"

**Check:**
1. Is Vercel deployment live? Check Vercel dashboard
2. Is the URL correct? Test with `curl` or browser
3. Are environment variables set? Check `vercel env ls`
4. Is CORS configured? Check `next.config.js`

---

## 📝 **Quick Reference**

| Component | Config File | Variable | Default |
|-----------|-------------|----------|---------|
| Commander Client | `commander_client/.env` | `GRIDPASS_API_URL` | `https://gridpass.app` |
| GridPass Platform | Vercel Dashboard | (deployed URL) | (Vercel assigns) |

**Remember:** Both must point to the same deployment!

---

## 🎯 **Best Practices**

1. **Use Environment Variables**: Never hardcode URLs in code
2. **Document Your URLs**: Keep a note of your production URL
3. **Test Locally First**: Use `http://localhost:3001` for development
4. **Verify After Deployment**: Always test API connection after deploying
5. **Use Custom Domains**: Set up a custom domain in Vercel for consistency

---

**Need Help?** Check the main [README.md](../../README.md) or [QUICK_START.md](QUICK_START.md)
