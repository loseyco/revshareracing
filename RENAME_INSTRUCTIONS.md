# Rename commander_client to ircommander_client

**Instructions for completing the rename**

---

## ✅ **Files Updated**

All code and documentation has been updated to use "iRCommander" branding:
- ✅ GUI window title: "iRCommander v{VERSION}"
- ✅ GUI header: "iRCommander"
- ✅ Login dialog: "Login to iRCommander"
- ✅ API label: "iRCommander API"
- ✅ Class names: `IRCommanderWindow`, `IRCommanderService`, `IRCommanderAPI`
- ✅ README updated with new branding
- ✅ All references to "GridPass Commander" changed to "iRCommander"

---

## 🔄 **Directory Rename**

The directory rename failed because files are in use. To complete the rename:

### Option 1: Close All Files and Rename
1. Close any open files in `commander_client/`
2. Close any running Python processes
3. Close your IDE/editor
4. Run:
   ```powershell
   cd c:\Users\pjlos\OneDrive\Projects\RevShareRacing
   Rename-Item -Path "commander_client" -NewName "ircommander_client"
   ```

### Option 2: Use Git (if using version control)
```bash
git mv commander_client ircommander_client
git commit -m "Rename commander_client to ircommander_client"
```

### Option 3: Manual Rename
1. Close all programs using files in `commander_client/`
2. In File Explorer, right-click `commander_client` folder
3. Select "Rename"
4. Type: `ircommander_client`
5. Press Enter

---

## 📝 **After Renaming**

Once the directory is renamed, update these files that reference the old path:

1. **README.md** - Already updated (uses `ircommander_client/`)
2. **TESTING_GUIDE.md** - Update paths
3. **TEST_RESULTS.md** - Update paths
4. **Any batch files** - Update paths if they reference the directory

---

## ✅ **What's Already Done**

- [x] All Python code updated
- [x] GUI branding updated
- [x] README updated
- [x] API references updated
- [x] Class names updated
- [ ] Directory renamed (pending - files in use)

---

**Last Updated:** January 2025
