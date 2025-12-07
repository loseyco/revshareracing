# iRacing Status Verification Checklist

## Data Flow Verification

### 1. PC Service → Database
**File:** `pc-service/src/service.py` (lines 498-537)
- ✅ Gets iRacing status: `telemetry_mgr.is_connected`
- ✅ Updates Supabase: `irc_devices` table with `iracing_connected` field
- ✅ Has error handling if column doesn't exist
- ✅ Logs: `[INFO] Heartbeat updated: iracing_connected=...`

**To verify:**
- Check PC service logs for heartbeat messages
- Look for `[INFO] Heartbeat updated: iracing_connected=True/False`
- If you see `[WARN] Failed to update heartbeat with iracing_connected`, the database column is missing

### 2. Database Schema
**Required Column:** `irc_devices.iracing_connected` (boolean, nullable)

**To add if missing:**
```sql
ALTER TABLE irc_devices 
ADD COLUMN IF NOT EXISTS iracing_connected BOOLEAN DEFAULT NULL;
```

### 3. Web App API Route
**File:** `web-app/src/app/api/device/[deviceId]/status/route.ts`
- ✅ Reads `iracing_connected` from database
- ✅ Falls back to inferring from `status` if column doesn't exist
- ✅ Returns proper JSON response

**Route Path:** `/api/device/[deviceId]/status`
**Example:** `/api/device/rig-3fab2ef5ceb6/status`

### 4. Web App Frontend
**File:** `web-app/src/app/device/[deviceId]/details/page.tsx`
- ✅ Calls `/api/device/${deviceId}/status`
- ✅ Handles null carState safely
- ✅ Displays connection status

## Current Issues Found

1. **API Route 404 Error**
   - The route file exists at correct path
   - Next.js may need restart to recognize it
   - **Fix:** Restart Next.js dev server

2. **Database Column May Not Exist**
   - Code has fallback, but column should exist for proper functionality
   - **Fix:** Run SQL migration to add column

3. **PC Service May Not Be Updated**
   - Service needs restart to pick up code changes
   - **Fix:** Restart PC service

## Verification Steps

1. **Check Database Column:**
   - Go to Supabase Dashboard → Table Editor → `irc_devices`
   - Verify `iracing_connected` column exists (boolean type)

2. **Check PC Service Logs:**
   - Look for heartbeat update messages
   - Should see: `[INFO] Heartbeat updated: iracing_connected=...`

3. **Test API Route:**
   - Open browser dev tools → Network tab
   - Navigate to device details page
   - Check if `/api/device/[deviceId]/status` returns 200 (not 404)

4. **Verify iRacing is in Session:**
   - iRacing SDK only connects when in an active session
   - Just having iRacing UI open is NOT enough
   - Must be in a practice/test/race session

## Quick Fixes

### Add Database Column (if missing):
```sql
ALTER TABLE irc_devices 
ADD COLUMN IF NOT EXISTS iracing_connected BOOLEAN DEFAULT NULL;
```

### Restart Services:
1. Restart PC service (to pick up code changes)
2. Restart Next.js dev server (to recognize API route)

### Verify Connection:
- Make sure iRacing is in an ACTIVE SESSION (not just UI)
- Check PC service logs for connection status
- Wait ~30 seconds for heartbeat to update

