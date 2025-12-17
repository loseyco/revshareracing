# How Auto-Update Determines Check URL and Install Location

## 1. Where It Checks for Updates

The updater automatically detects the portal URL using the same logic as the device module:

### Detection Priority:
1. **Device Module Portal URL** (Primary)
   - Reads from `data/device_config.json` if it exists
   - Extracts base URL from the stored portal URL
   - Example: `https://revshareracing.com/device/rig-abc123` → `https://revshareracing.com`

2. **Environment Variable** (Override)
   - `REVSHARERACING_PORTAL_BASE_URL` environment variable
   - Allows overriding for development/testing

3. **Default Production URL** (Fallback)
   - `https://revshareracing.com` if nothing else is found

### API Endpoint:
Once the base URL is determined, it constructs:
```
{portal_base_url}/api/github/latest-release
```

Example: `https://revshareracing.com/api/github/latest-release`

This endpoint returns:
- Latest version number
- Download URL (GitHub release asset)
- Release information

## 2. Where It Installs Updates

The updater uses Python's `sys.executable` to find the current executable location:

### For Compiled Executables (`.exe`):
```python
current_exe = Path(sys.executable)  # e.g., C:\Users\John\Desktop\RevShareRacing.exe
update_dir = current_exe.parent    # e.g., C:\Users\John\Desktop\
```

**Download Location:**
- Downloads to: `{exe_directory}/RevShareRacing_new.exe`
- Example: `C:\Users\John\Desktop\RevShareRacing_new.exe`

**Installation Location:**
- Installs to: Same location as current executable
- Replaces: `RevShareRacing.exe` with `RevShareRacing_new.exe`
- Creates backup: `RevShareRacing_backup_{timestamp}.exe`

### For Development (Running as Script):
- Downloads to: `pc-service/RevShareRacing_new.exe`
- Note: Auto-install only works for compiled executables

## 3. Installation Process

1. **Download**: Saves new executable as `RevShareRacing_new.exe` in the same directory
2. **Backup**: Creates `RevShareRacing_backup_{timestamp}.exe` of current version
3. **Replace**: Moves `RevShareRacing_new.exe` → `RevShareRacing.exe`
4. **Restart**: Launches new executable and exits current process

## 4. Example Flow

### Scenario: User has executable at `C:\Racing\RevShareRacing.exe`

1. **Check for Updates**:
   - Detects portal URL: `https://revshareracing.com`
   - Calls: `https://revshareracing.com/api/github/latest-release`
   - Compares versions

2. **Download Update**:
   - Downloads to: `C:\Racing\RevShareRacing_new.exe`
   - Shows progress

3. **Install Update**:
   - Creates backup: `C:\Racing\RevShareRacing_backup_1704067200.exe`
   - Replaces: `C:\Racing\RevShareRacing.exe` with new version
   - Restarts from: `C:\Racing\RevShareRacing.exe`

## 5. Configuration

### Override Portal URL:
Set environment variable:
```bash
set REVSHARERACING_PORTAL_BASE_URL=https://staging.revshareracing.com
```

### Override for Development:
```bash
set REVSHARERACING_ENV=development
```
This will use `http://localhost:3000` instead of production URL.

## 6. Key Points

- **Portal URL**: Auto-detected from device config or environment
- **Install Location**: Always same directory as current executable
- **Backup**: Always created before installation
- **Works Anywhere**: Executable can be in any folder, update installs to same location

