# Environment Setup for iRCommander

## ✅ Created `.env.local` file

The `.env.local` file has been created with:
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅

## ⚠️ Action Required: Add Service Role Key

You need to add the `SUPABASE_SERVICE_ROLE_KEY` to complete the setup:

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/wonlunpmgsnxctvgozva/settings/api

2. **Copy the Service Role Key:**
   - Find the "service_role" key (it's marked as "secret")
   - Click "Reveal" to show it
   - Copy the entire key

3. **Add to `.env.local`:**
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## 🔄 Restart Dev Server

After adding the service role key, **restart the Next.js dev server**:

1. Stop the current server (Ctrl+C in the terminal)
2. Run: `npm run dev`
3. The server will pick up the new environment variables

## ✅ Test Login

Once the server restarts, try logging in again at:
- http://localhost:3001/auth/login

The "Network error" should be resolved!

---

**Note:** The `.env.local` file is gitignored and won't be committed to the repository.
