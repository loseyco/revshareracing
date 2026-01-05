# Get Vercel Blob Token

To complete the upload setup, you need to get the BLOB_READ_WRITE_TOKEN from Vercel:

## Steps:

1. Go to: https://vercel.com/pj-loseys-projects/ircommander/storage
2. Click on the "releases" blob store
3. Go to the "Settings" or "Tokens" tab
4. Copy the `BLOB_READ_WRITE_TOKEN` value
5. Add it to your environment:

```powershell
# In ircommander_client directory
$env:VERCEL_BLOB_TOKEN = "vercel_blob_xxxxxxxxxxxxx"
```

Or add to `ircommander_client/.env`:
```
VERCEL_BLOB_TOKEN=vercel_blob_xxxxxxxxxxxxx
```

Then run:
```bash
python upload_release.py 1.0.1 dist\iRCommander.exe "Release notes"
python update_download_link.py 1.0.1 <download_url_from_upload>
```

## Alternative: Use the API Route

The API route at `/api/v1/releases/upload` is deployed and should work once the blob store is properly linked in Vercel. The SSL error might be temporary - try again or check the Vercel deployment logs.
