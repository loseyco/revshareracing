# Release Guide

## How Releases Work

### 1. Website Download Links
The website automatically fetches the **latest** GitHub release using the `/api/github/latest-release` endpoint. This means:
- ✅ **No manual updates needed** - the website always shows the latest release
- ✅ **Automatic version display** - shows the current version number
- ✅ **Always up-to-date** - as soon as you create a new release, it becomes available

### 2. Auto-Update System
The PC Service includes an auto-update system that:
- Checks for updates every hour
- Compares current version with latest GitHub release
- Automatically downloads and installs updates
- Restarts the service after installation

## Creating a New Release

### Step 1: Update Version Number
Edit `src/core/updater.py`:
```python
CURRENT_VERSION = "1.0.2"  # Update this to match your release
```

### Step 2: Build the Executable
```bash
python build_exe.py
```

This creates: `dist/RevShareRacing.exe`

### Step 3: Create GitHub Release

#### Option A: Using PowerShell Script (Recommended)
```powershell
.\upload-release.ps1 -Version "1.0.2"
```

#### Option B: Using GitHub CLI Manually
```bash
gh release create v1.0.2 \
  dist/RevShareRacing.exe \
  --title "Rev Share Racing v1.0.2" \
  --notes "Release notes here" \
  --latest
```

#### Option C: Using GitHub Web Interface
1. Go to: https://github.com/loseyco/revshareracing/releases/new
2. Tag: `v1.0.2`
3. Title: `Rev Share Racing v1.0.2`
4. Description: Add release notes
5. Upload: `dist/RevShareRacing.exe`
6. Check "Set as the latest release"
7. Click "Publish release"

### Step 4: Verify
1. Check the release: https://github.com/loseyco/revshareracing/releases
2. Visit the website - it should automatically show the new version
3. Test auto-update by running an older version

## Release Checklist

- [ ] Update `CURRENT_VERSION` in `src/core/updater.py`
- [ ] Build executable: `python build_exe.py`
- [ ] Test the executable locally
- [ ] Create GitHub release with tag `v{version}`
- [ ] Upload `dist/RevShareRacing.exe` to release
- [ ] Mark as "latest release" on GitHub
- [ ] Verify website shows new version
- [ ] Test auto-update from previous version

## Version Numbering

Use semantic versioning: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

Examples:
- `1.0.0` → `1.0.1` (bug fix)
- `1.0.1` → `1.1.0` (new feature)
- `1.1.0` → `2.0.0` (breaking change)

## Important Notes

1. **Always update `CURRENT_VERSION`** before building - this is what the auto-updater uses to compare versions
2. **Tag must start with `v`** - e.g., `v1.0.2` (GitHub convention)
3. **Executable must be named `RevShareRacing.exe`** - the API looks for this exact name
4. **Mark as latest release** - ensures it shows up as the latest on GitHub

## Troubleshooting

### Website shows old version
- Check that the release is marked as "latest" on GitHub
- The API caches for 5 minutes - wait a few minutes and refresh

### Auto-update not working
- Verify `CURRENT_VERSION` matches the release tag (without the `v` prefix)
- Check that the release has `RevShareRacing.exe` as an asset
- Ensure the portal API endpoint is accessible: `/api/github/latest-release`


