# Vercel Blob Storage Setup

This guide explains how to set up Vercel Blob Storage for uploading large release files (293+ MB).

## Why Vercel Blob?

Supabase Storage has a file size limit that prevents uploading large executables. Vercel Blob supports files up to **5TB**, making it perfect for large build artifacts.

## Setup Steps

### 1. Create a Vercel Blob Store

1. Go to your Vercel project dashboard: https://vercel.com
2. Navigate to your `ircommander` project
3. Go to the **Storage** tab
4. Click **Create Database** or **Add Storage**
5. Select **Blob**
6. Name your store (e.g., "releases" or "ircommander-releases")
7. Click **Create**

### 2. Get Your Blob Token

After creating the store, Vercel automatically adds a `BLOB_READ_WRITE_TOKEN` environment variable to your project.

**Option A: Get from Vercel Dashboard**
1. Go to your project settings
2. Navigate to **Environment Variables**
3. Find `BLOB_READ_WRITE_TOKEN`
4. Copy the value

**Option B: Get from Vercel CLI**
```bash
cd ircommander
vercel env pull
# This will create a .env.local file with the token
```

### 3. Configure the Client

Add the token to your `ircommander_client/.env` file:

```env
VERCEL_BLOB_TOKEN=vercel_blob_xxxxxxxxxxxxx
VERCEL_BLOB_STORE_ID=your-store-id  # Optional, only if you have multiple stores
```

Or set it as an environment variable:
```powershell
$env:VERCEL_BLOB_TOKEN = "vercel_blob_xxxxxxxxxxxxx"
```

### 4. Upload Your Release

The upload script will automatically:
1. Try Vercel Blob first (if token is configured)
2. Fall back to Supabase Storage if Vercel Blob fails or isn't configured

```bash
cd ircommander_client
python upload_release.py 1.0.1 dist\iRCommander.exe "Release notes"
```

### 5. Update Database Link

After uploading, update the database with the download URL:

```bash
# If upload_release.py printed a Vercel Blob URL, use it:
python update_download_link.py 1.0.1 "https://blob.vercel-storage.com/..."

# Or let it use the default Supabase URL:
python update_download_link.py 1.0.1
```

## How It Works

1. **Upload Script** (`upload_release.py`):
   - Checks for `VERCEL_BLOB_TOKEN` in config
   - If found, uploads to Vercel Blob with progress tracking
   - If not found or upload fails, falls back to Supabase Storage
   - Returns the download URL

2. **Database Update** (`update_download_link.py`):
   - Accepts optional download URL parameter
   - Updates `app_releases` table with the download URL
   - Website automatically fetches from `/api/v1/releases/latest`

## Troubleshooting

**"Vercel Blob upload failed"**
- Check that `VERCEL_BLOB_TOKEN` is set correctly
- Verify the token has read/write permissions
- Check your internet connection

**"File still too large"**
- Vercel Blob supports up to 5TB, so this shouldn't happen
- Check that you're using the correct token
- Verify the file isn't corrupted

**"Download URL not working"**
- Make sure the blob was uploaded with `access: 'public'` (default)
- Check the URL format in the database
- Verify the blob store is active in Vercel dashboard

## Notes

- Vercel Blob files are cached up to 512 MB
- Files larger than 512 MB are not cached (but still accessible)
- The upload script shows real-time progress with percentage and MB
- Both Vercel Blob and Supabase URLs work with the existing API
