# Creating a GitHub Release with Executable

This guide explains how to publish the built executable to GitHub Releases.

## Prerequisites

1. **GitHub CLI installed** (optional, but easiest method):
   ```bash
   winget install GitHub.cli
   ```
   Or download from: https://cli.github.com/

2. **Or use GitHub web interface** (no installation needed)

## Method 1: Using GitHub CLI (Recommended)

### Step 1: Build the Executable
```bash
cd pc-service
python build_exe.py
```

### Step 2: Create Release with GitHub CLI
```bash
# Authenticate (first time only)
gh auth login

# Create a release and upload the executable
gh release create v1.0.0 ^
  dist/RevShareRacing.exe ^
  --title "Rev Share Racing v1.0.0" ^
  --notes "Initial release of Rev Share Racing PC Service

Features:
- iRacing telemetry collection
- Remote command execution
- Lap tracking
- Standalone executable (no installation required)"
```

## Method 2: Using GitHub Web Interface

### Step 1: Build the Executable
```bash
cd pc-service
python build_exe.py
```

### Step 2: Create Release on GitHub

1. Go to your GitHub repository: https://github.com/loseyco/revshareracing
2. Click **"Releases"** (right sidebar)
3. Click **"Create a new release"**
4. Fill in:
   - **Tag version**: `v1.0.0` (or your version)
   - **Release title**: `Rev Share Racing v1.0.0`
   - **Description**: Add release notes
5. **Drag and drop** `pc-service/dist/RevShareRacing.exe` into the "Attach binaries" area
6. Click **"Publish release"**

## Method 3: Using Git Tags (Manual)

If you prefer to tag and push manually:

```bash
# Tag the current commit
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Then go to GitHub web interface and create release from the tag
# Upload the .exe file manually
```

## Release Notes Template

```
## Rev Share Racing PC Service v1.0.0

### Features
- ✅ iRacing telemetry collection
- ✅ Remote command execution (enter car, reset car, ignition, etc.)
- ✅ Automatic lap tracking
- ✅ Real-time status updates
- ✅ Standalone executable (no Python installation required)

### Installation
1. Download `RevShareRacing.exe`
2. Double-click to run
3. No installation or dependencies needed!

### Requirements
- Windows 10/11
- iRacing installed and running (for telemetry)
- Internet connection (for Supabase sync)

### Notes
- First run will create device configuration
- Use the claim code shown in console to claim your rig on the web portal
- Logs are saved to `logs/` folder next to the executable
```

## Best Practices

1. **Version your releases**: Use semantic versioning (v1.0.0, v1.1.0, etc.)
2. **Include release notes**: Describe what's new or fixed
3. **Test before releasing**: Always test the .exe on a clean machine
4. **Keep releases**: Don't delete old releases (users may need them)
5. **Use tags**: Tag your commits when creating releases

## Quick Release Script

You can create a batch file to automate this:

```batch
@echo off
echo Building executable...
cd pc-service
python build_exe.py

echo.
echo Release the executable:
echo 1. Go to: https://github.com/loseyco/revshareracing/releases/new
echo 2. Create a new release
echo 3. Upload: pc-service\dist\RevShareRacing.exe
pause
```
