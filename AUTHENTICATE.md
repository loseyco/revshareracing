# Git Authentication Fix

Since it was working before, your credentials may have expired. Here are the easiest ways to fix it:

## Option 1: Use GitHub CLI (Easiest)

If you have GitHub CLI installed:
```powershell
gh auth login
```
Follow the prompts to authenticate.

Then push:
```powershell
git push origin main
```

## Option 2: Personal Access Token (Most Common)

1. **Create a token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a name like "RevShareRacing"
   - Select scope: **repo** (all checkboxes under repo)
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again!)

2. **Use the token:**
   - When you push, Git will ask for username and password
   - Username: your GitHub username
   - Password: paste the token (not your GitHub password)

3. **Windows will save it:**
   - After the first successful push, Windows Credential Manager will save it
   - Future pushes won't ask for credentials

## Option 3: Clear and Re-enter Credentials

If credentials are cached incorrectly:

1. Open Windows Credential Manager:
   - Press `Win + R`
   - Type: `control /name Microsoft.CredentialManager`
   - Or search "Credential Manager" in Start menu

2. Find and delete:
   - Look for `git:https://github.com` or similar
   - Delete any GitHub-related entries

3. Push again - it will prompt for new credentials

## Quick Test

Run this to see the actual error:
```powershell
cd "c:\Users\pjlos\OneDrive\Projects\RevShareRacing"
git push origin main
```

The error message will tell you exactly what's wrong!




