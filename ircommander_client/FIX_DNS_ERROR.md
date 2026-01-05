# Fix DNS Resolution Error

## The Problem

The Python client is trying to connect to `ircommander.gridpass.app` but getting:
```
NameResolutionError: Failed to resolve 'ircommander.gridpass.app'
```

This happens because the DNS for `ircommander.gridpass.app` hasn't been configured yet.

## The Solution

I've updated the default API URL to use the **working Vercel deployment URL** instead.

### Changes Made

1. **Updated `config.py`:**
   - Changed default from `https://ircommander.gridpass.app`
   - To: `https://ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app`

2. **Created `.env` file:**
   - Explicitly sets `IRCOMMANDER_API_URL` to the working Vercel URL

### Next Steps

1. **Delete old device config** (if it exists):
   ```bash
   del data\device_config.json
   ```
   This forces re-registration with the new URL.

2. **Restart the client:**
   ```bash
   python main.py
   ```

3. **Login and register:**
   - The client will now connect to the working Vercel URL
   - Login should work
   - Device registration should work

## Once DNS is Configured

After you configure DNS for `ircommander.gridpass.app`:

1. Update `.env`:
   ```env
   IRCOMMANDER_API_URL=https://ircommander.gridpass.app
   ```

2. Or update `config.py` default back to the custom domain

3. Restart the client

---

**The client will now use the working Vercel URL and should connect successfully!**
