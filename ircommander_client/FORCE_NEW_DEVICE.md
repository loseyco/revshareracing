# Force New Device Registration

**Make the device register as a completely new device/computer**

---

## ✅ **Device Config Deleted!**

The device configuration has been cleared. When you restart, it will register as a NEW device.

---

## 🚀 **Next Steps**

1. **Stop the application** (Ctrl+C)

2. **Make sure you have the correct API URL:**
   Create `ircommander_client/.env`:
   ```env
   IRCOMMANDER_API_URL=https://ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app
   ```

3. **Restart:**
   ```bash
   python main.py
   ```

4. **Login when prompted** - Device will automatically register as a NEW device with:
   - New device_id (with random suffix)
   - New API key
   - Fresh registration

---

## 🔧 **What Changed**

- ✅ Device config deleted
- ✅ Registration now forces new device_id (adds random suffix)
- ✅ Will get completely fresh API key
- ✅ Treated as a brand new device

---

## 📝 **After Restart**

You should see:
- ✅ `[INFO] User logged in, attempting device registration...`
- ✅ `[OK] Registered device: rig-xxxxx-xxxxxxxx` (new ID with suffix)
- ✅ `[OK] iRCommander service started`
- ✅ No authentication errors!

---

**The device will now register as a completely new device!**

---

**Last Updated:** January 2025
