# Get Supabase Service Role Key

## The Problem

The `SUPABASE_SERVICE_ROLE_KEY` is missing from `.env.local`, which is causing network errors.

## The Solution

You need to get the service role key from your Supabase dashboard and add it to `.env.local`.

### Step 1: Get the Key

1. Go to: **https://supabase.com/dashboard/project/wonlunpmgsnxctvgozva/settings/api**

2. Scroll down to **"Project API keys"** section

3. Find the **"service_role"** key (it's marked as "secret")

4. Click **"Reveal"** to show the key

5. **Copy the entire key** (it's a long JWT token)

### Step 2: Add to .env.local

Open `ircommander/.env.local` and **uncomment and update** this line:

```env
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
```

Replace `your_actual_service_role_key_here` with the key you copied.

### Step 3: Restart Dev Server

1. Stop the current server (Ctrl+C in terminal)
2. Run: `npm run dev`
3. The server will now have access to the service role key

## Why This Is Needed

The service role key is required for:
- Creating user profiles in `irc_user_profiles` table during registration
- Fetching tenant information during login
- Other server-side operations that bypass Row Level Security (RLS)

## Security Note

⚠️ **Never commit the service role key to git!** 

The `.env.local` file is already in `.gitignore`, so it won't be committed. The service role key has full access to your database, so keep it secret.

---

**Once you add the key and restart, all authentication endpoints will work properly!**
