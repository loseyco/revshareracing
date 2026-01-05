# Fix Authentication Errors

**Device authentication is failing - here's how to fix it**

---

## 🔍 **The Problem**

Your device is registered but the API key authentication is failing. This happens when:
- The API key stored locally doesn't match what's in the database
- The API key was revoked or expired
- The device was registered with the old system

---

## ✅ **Solution: Re-register Device**

### Option 1: Delete Config and Re-register (Recommended)

1. **Stop the application** (Ctrl+C)

2. **Delete the device config:**
   ```bash
   cd ircommander_client
   del data\device_config.json
   ```
   Or manually delete: `ircommander_client\data\device_config.json`

3. **Restart the application:**
   ```bash
   python main.py
   ```

4. **Login when prompted:**
   - Enter your email and password
   - The device will automatically re-register with a new API key

### Option 2: Manual Re-registration via GUI

1. **Open the GUI:**
   ```bash
   python main.py
   ```

2. **Login** (if not already logged in)

3. **Click "Register Device"** button in the Account section

4. **Wait for confirmation** that device is registered

---

## 🔧 **Why This Happens**

The device API key is stored in:
- **Local:** `ircommander_client/data/device_config.json`
- **Database:** `irc_device_api_keys` table

If these don't match, authentication fails. Re-registering creates a new key that matches in both places.

---

## 📝 **After Re-registration**

Once re-registered, you should see:
- ✅ `[OK] Device registered: rig-xxxxx`
- ✅ Heartbeat working (no more authentication errors)
- ✅ Command polling working

---

**Last Updated:** January 2025
