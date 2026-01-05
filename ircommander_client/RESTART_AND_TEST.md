# Restart and Test Instructions

## Current Status
- ✅ Login: Working
- ✅ Registration: Working  
- ✅ test-key endpoint: Finds API key
- ✅ debug-auth endpoint: Finds API key
- ❌ Heartbeat: Failing (401 Unauthorized)

## The Problem
The `validateDeviceKey` function in `tenant.ts` has been fixed to use the same query pattern as the working endpoints, but the Next.js server hasn't reloaded the new code.

## Solution: Full Restart

### Step 1: Stop Next.js Server
1. Find the terminal/PowerShell window running `npm run dev`
2. Press `Ctrl+C` to stop it
3. Wait for it to fully stop

### Step 2: Clear Build Cache
```powershell
cd ircommander
Remove-Item -Recurse -Force .next
```

### Step 3: Restart Server
```powershell
cd ircommander
npm run dev
```
Wait for the "Ready" message (usually takes 10-30 seconds)

### Step 4: Test
In a **new terminal**:
```powershell
cd ircommander_client
python test_full_flow.py pjlosey@outlook.com "!Google1!"
```

## Expected Results After Restart

You should see:
- ✅ Login successful
- ✅ Registration successful  
- ✅ **Heartbeat successful** (this is what we're fixing)

## If It Still Fails

Check the Next.js server console for `[validateDeviceKey]` log messages. You should see:
- `[validateDeviceKey] Starting lookup for: ...`
- `[validateDeviceKey] Query result: { found: true, ... }`

If you don't see these logs, the code changes aren't loaded.

## Quick Test Script

Run this to test all endpoints:
```powershell
cd ircommander_client
.\test_and_fix.ps1
```
