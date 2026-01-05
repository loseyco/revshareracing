# Auto-Updater Setup Guide

## How It Works

The auto-updater checks for new versions and automatically downloads/installs them from Supabase Storage. Here's how it works:

### 1. **Version Checking**
- Checks Supabase Storage for `version.json` every hour (configurable)
- Compares current version with latest release
- Only triggers if a newer version is found

### 2. **Download Process**
- Downloads the new `.exe` file to `iRCommander_new.exe` in the same directory
- Shows progress percentage during download
- Validates the download completed successfully

### 3. **Installation Process**
- Creates a backup of current executable (`iRCommander.exe.backup`)
- Replaces the current executable with the new one
- If the exe is in use, schedules update for next restart

### 4. **User Experience**
- Automatic background checks (every hour)
- Manual check available from GUI
- User can choose when to install updates
- Safe rollback via backup file

## Supabase Storage Setup

### Step 1: Create Storage Bucket

1. **Go to Supabase Dashboard:**
   - Navigate to Storage → Create a new bucket
   - Bucket name: `releases`
   - Make it **Public** (so clients can download without auth)
   - Click "Create bucket"

2. **Upload version.json:**
   Create a file called `version.json` with this structure:
   ```json
   {
     "version": "1.0.1",
     "filename": "iRCommander.exe",
     "release_notes": "Bug fixes and improvements",
     "published_at": "2024-01-15T10:00:00Z",
     "size": 0
   }
   ```
   - Upload this file to the `releases` bucket
   - Note: `size` is optional (will be calculated automatically)

3. **Upload the executable:**
   - Build your executable: `build_exe.bat`
   - Upload `dist/iRCommander.exe` to the `releases` bucket
   - Make sure the filename matches what's in `version.json`

### Step 2: Upload Releases

**Option A: Using the upload script (Recommended)**

After building your executable:

```bash
python upload_release.py 1.0.1 dist/iRCommander.exe "Bug fixes and improvements"
```

This script will:
- Upload the executable to the `releases` bucket
- Create and upload `version.json` with the correct version
- Show you the public URLs

**Option B: Manual upload via Supabase Dashboard**

When releasing a new version:

1. **Build the executable:**
   ```batch
   build_exe.bat
   ```

2. **Create version.json:**
   ```json
   {
     "version": "1.0.2",
     "filename": "iRCommander.exe",
     "release_notes": "New features and bug fixes",
     "published_at": "2024-01-20T10:00:00Z"
   }
   ```

3. **Upload via Supabase Dashboard:**
   - Go to Storage → `releases` bucket
   - Upload `dist/iRCommander.exe` (replace existing)
   - Upload `version.json` (replace existing)

### Storage Structure

Your `releases` bucket should contain:
```
releases/
  ├── version.json          (version info)
  └── iRCommander.exe       (the executable)
```

### Public URLs

Files will be accessible at:
- Version: `https://your-project.supabase.co/storage/v1/object/public/releases/version.json`
- Executable: `https://your-project.supabase.co/storage/v1/object/public/releases/iRCommander.exe`

## Alternative: GitHub Releases

**Pros:**
- Already using Supabase
- Private storage
- Custom version checking

**Setup Steps:**

1. Create a storage bucket called `releases` (public)
2. Upload `iRCommander.exe` to the bucket
3. Create a `version.json` file:
   ```json
   {
     "version": "1.0.1",
     "download_url": "https://your-project.supabase.co/storage/v1/object/public/releases/iRCommander.exe",
     "release_notes": "Bug fixes and improvements"
   }
   ```
4. Update `updater.py` to use Supabase Storage instead of GitHub

### Option 3: Custom API Endpoint

Create an API endpoint that returns version info:
```json
{
  "version": "1.0.1",
  "download_url": "https://your-cdn.com/releases/iRCommander.exe",
  "release_notes": "..."
}
```

## Configuration

### Update Check Interval

In `service.py`, you can change how often it checks:
```python
self._update_check_interval = 3600  # Check every hour (in seconds)
```

### Manual Update Check

Users can manually check for updates from the GUI (we'll add this button).

## Building and Releasing

### Step-by-Step Release Process:

1. **Update version in `config.py`:**
   ```python
   VERSION = "1.0.1"  # Increment this
   ```

2. **Build the executable:**
   ```batch
   build_exe.bat
   ```

3. **Test the executable** to make sure it works

4. **Upload to Supabase Storage:**
   - Upload `dist/iRCommander.exe` to the `releases` bucket
   - Update `version.json` in the bucket with new version
   - Make sure `version.json` has the correct version number

5. **Users will automatically get notified** of the update (checks every hour)

## How Users Get Updates

1. **Automatic Check:**
   - App checks GitHub every hour
   - If update found, logs message: `[UPDATE] New version available: 1.0.1`

2. **Manual Check:**
   - User clicks "Check for Updates" in GUI
   - Shows update dialog if available

3. **Download & Install:**
   - User clicks "Download Update"
   - Downloads to `iRCommander_new.exe`
   - User clicks "Install Update"
   - Replaces current exe
   - User restarts app

## Security Considerations

- **Code Signing:** Consider signing your executables (optional but recommended)
- **Checksums:** GitHub automatically provides SHA256 checksums for releases
- **HTTPS:** All downloads use HTTPS (GitHub uses HTTPS)

## Troubleshooting

**Update not detected:**
- Check version in `config.py` matches version in `version.json` (without 'v' prefix)
- Verify Supabase URL is configured correctly in `config.py`
- Check that `releases` bucket exists and is public
- Verify `version.json` is accessible at the public URL
- Check internet connection

**Download fails:**
- Check firewall/antivirus isn't blocking
- Verify `iRCommander.exe` exists in the `releases` bucket
- Check that the bucket is public (not private)
- Verify the filename in `version.json` matches the uploaded file
- Check disk space

**Installation fails:**
- Make sure app has write permissions in the directory
- Close any other instances of the app
- Try running as administrator

## Example Workflow

```bash
# 1. Make changes to code
# 2. Update version
echo "VERSION = \"1.0.2\"" > config.py

# 3. Build
build_exe.bat

# 4. Test locally
dist\iRCommander.exe

# 5. Upload to Supabase Storage
python upload_release.py 1.0.2 dist/iRCommander.exe "Release notes"

# 6. Users automatically get update within 1 hour
```
