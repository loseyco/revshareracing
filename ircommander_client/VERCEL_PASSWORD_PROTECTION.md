# Vercel Password Protection Issue

## The Problem

The Vercel deployment `https://ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app` is **password protected**.

When the Python client tries to connect, it gets:
- HTML response instead of JSON
- "Authentication Required" page
- Error: "Expecting value: line 1 column 1 (char 0)" (trying to parse HTML as JSON)

## The Solution

**Use the local development server for testing:**

1. **Make sure the dev server is running:**
   ```bash
   cd ircommander
   npm run dev
   ```

2. **The client is now configured to use:**
   - Default: `http://localhost:3001` (local development)
   - Can be overridden via `.env` file

3. **Restart the Python client:**
   ```bash
   python main.py
   ```

## For Production

Once you're ready for production:

1. **Disable password protection in Vercel:**
   - Go to Vercel dashboard
   - Select the `ircommander` project
   - Go to Settings > Deployment Protection
   - Disable password protection for production/preview deployments

2. **Or configure DNS:**
   - Set up DNS for `ircommander.gridpass.app`
   - Production deployments usually don't have password protection

3. **Update client config:**
   ```env
   IRCOMMANDER_API_URL=https://ircommander.gridpass.app
   ```

## Current Configuration

- **Client default:** `http://localhost:3001` ✅
- **Local dev server:** Running on port 3001 ✅
- **All API endpoints:** Working on localhost ✅

---

**For development, use localhost. For production, disable Vercel password protection or use custom domain.**
