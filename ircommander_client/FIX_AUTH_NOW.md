# 🔴 URGENT: Fix Authentication Errors

**Your device can't authenticate - here's the immediate fix**

---

## 🚨 **The Problem**

Your device has an API key stored, but it's failing authentication. This is because:
- The API key might be from the old system
- OR the API URL `https://ircommander.gridpass.app` doesn't have DNS configured yet
- OR the API key doesn't exist in the database

---

## ✅ **IMMEDIATE FIX (2 minutes)**

### Step 1: Stop the Application
Press `Ctrl+C` in the terminal running the app

### Step 2: Update API URL (Use Vercel URL for now)
Edit `ircommander_client/.env` (create it if it doesn't exist):

```env
IRCOMMANDER_API_URL=https://ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app
```

**OR** delete the config and let it use the default (but default might not work if DNS isn't set up).

### Step 3: Delete Old Config
```bash
cd ircommander_client
del data\device_config.json
```

### Step 4: Restart
```bash
python main.py
```

### Step 5: Login
When prompted, login with your credentials. The device will automatically re-register with a new API key.

---

## 🔍 **Why This Happens**

The device config shows:
- API URL: `https://ircommander.gridpass.app` 
- API Key: `irc_device_rig-866eaad1_cb22d117bd94dc15f2383547e366a4f6`

**Problem:** The domain `ircommander.gridpass.app` might not have DNS configured yet, so requests are failing. Use the Vercel URL instead until DNS is set up.

---

## 📝 **After Fix**

Once working, you should see:
- ✅ `[OK] Device registered: rig-xxxxx`
- ✅ No more "Authentication failed" errors
- ✅ Heartbeat working
- ✅ Command polling working

---

**Last Updated:** January 2025
