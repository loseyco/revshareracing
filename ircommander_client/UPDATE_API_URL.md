# Update API URL

**Your device is trying to connect to `ircommander.gridpass.app` which doesn't have DNS yet.**

---

## ✅ **Solution**

I've created a `.env` file with the working Vercel URL. 

**Now you need to:**

1. **Stop the application** (Ctrl+C)

2. **Delete the old device config** (it has the wrong URL saved):
   ```bash
   del data\device_config.json
   ```

3. **Restart the application:**
   ```bash
   python main.py
   ```

4. **Login when prompted** - device will re-register and use the correct API URL from `.env`

---

## 📝 **What Changed**

- ✅ Created `.env` file with working Vercel URL
- ✅ Device will now use: `https://ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app`
- ✅ Once DNS is configured, update `.env` to use `https://ircommander.gridpass.app`

---

**After restarting, authentication should work!**

---

**Last Updated:** January 2025
