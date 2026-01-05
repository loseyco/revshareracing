# Build and Release Process

## Quick Start

Run the automated build and release script:

```batch
build_and_release.bat
```

This script will:
1. ✅ Clean previous builds
2. ✅ Check credentials
3. ✅ Build the executable (shows progress)
4. ✅ Upload to Supabase Storage
5. ✅ Update download link in database
6. ✅ Show summary

## Manual Steps

### 1. Create Database Table (One-time setup)

Run the migration SQL in Supabase:

```sql
-- Run migrations/create_app_releases_table.sql in Supabase SQL Editor
```

Or use the Supabase MCP tool:
```bash
# The migration file is at: migrations/create_app_releases_table.sql
```

### 2. Build Executable

```batch
build_and_release.bat
```

Or manually:
```batch
build_exe.bat
python upload_release.py 1.0.1 dist/iRCommander.exe "Release notes"
python update_download_link.py 1.0.1
```

## How It Works

### Build Process
- Cleans `build/` and `dist/` directories
- Validates credentials are set
- Builds executable using PyInstaller
- Shows file size when complete

### Upload Process
- Uploads `iRCommander.exe` to Supabase Storage (`releases` bucket)
- Updates `version.json` with new version info
- Shows upload progress

### Database Update
- Updates `app_releases` table with:
  - Version number
  - Download URL
  - Release notes
  - Published date
  - Marks as `is_latest = true`

### Website Integration
- Website fetches latest release from `/api/v1/releases/latest`
- Download button shows current version automatically
- No Vercel redeploy needed!

## Version Management

Update version in `config.py`:
```python
VERSION = "1.0.1"  # Increment this
```

Then run `build_and_release.bat` - it will use this version automatically.

## Troubleshooting

**Build fails:**
- Close any running iRCommander.exe instances
- Check credentials.py exists and has values
- Try cleaning build/dist manually

**Upload fails:**
- Check Supabase credentials in config.py
- Verify `releases` bucket exists and is public
- Check internet connection

**Database update fails:**
- Run the migration SQL to create `app_releases` table
- Check Supabase service role key is correct
- Table will be created automatically on first insert (if permissions allow)

## Files

- `build_and_release.bat` - Main build script
- `build_exe.bat` - Just builds (no upload)
- `upload_release.py` - Uploads to Supabase Storage
- `update_download_link.py` - Updates database
- `migrations/create_app_releases_table.sql` - Database schema
