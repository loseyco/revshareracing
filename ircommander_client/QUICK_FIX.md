# Quick Fix for Authentication Errors

**Your device API key is invalid - here's the fastest fix:**

---

## 🚀 **Quick Fix (30 seconds)**

1. **Stop the application** (Ctrl+C in the terminal)

2. **Delete the device config:**
   ```bash
   cd ircommander_client
   del data\device_config.json
   ```

3. **Restart:**
   ```bash
   python main.py
   ```

4. **Login when prompted** - device will auto-register with a new key

---

## ✅ **That's It!**

After re-registering, authentication will work and you'll see:
- ✅ `[OK] Device registered: rig-xxxxx`
- ✅ Heartbeat working (no more errors)
- ✅ Command polling working

---

**The issue:** Your old API key doesn't match the new database format. Re-registering creates a new key that works.

---

**Last Updated:** January 2025
