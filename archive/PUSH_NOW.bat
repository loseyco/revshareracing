@echo off
echo ========================================
echo Pushing Vercel Build Fixes to GitHub
echo ========================================
echo.

cd /d "c:\Users\pjlos\OneDrive\Projects\RevShareRacing"

echo [1/4] Staging files...
git add web-app/src/app/api/device/list/route.ts
git add web-app/src/app/auth/login/page.tsx
git add web-app/src/app/auth/register/page.tsx
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to stage files
    pause
    exit /b 1
)

echo [2/4] Committing changes...
git commit -m "Fix Vercel build errors: add Suspense boundaries and fix dynamic route"
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Commit may have failed or nothing to commit
)

echo [3/4] Verifying remote...
git remote set-url origin https://github.com/loseyco/revshareracing.git
git remote -v

echo [4/4] Pushing to GitHub...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Changes pushed to GitHub
    echo ========================================
    echo Check: https://github.com/loseyco/revshareracing
) else (
    echo.
    echo ========================================
    echo ERROR: Push failed
    echo ========================================
    echo You may need to authenticate.
    echo Try running: git push origin main
    echo.
)

pause




