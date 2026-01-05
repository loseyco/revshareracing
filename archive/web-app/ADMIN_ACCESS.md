# Admin Access Configuration

## Current Status

**Currently, NO users have admin access** until you configure it.

The admin section is now protected - only users with admin privileges can access it.

## How to Grant Admin Access

### Option 1: Environment Variable (Recommended)

Add admin email addresses to your `.env.local` file:

```env
# For client-side access (required for admin checks in browser)
NEXT_PUBLIC_ADMIN_EMAILS=admin@revshareracing.com,your-email@example.com,another-admin@example.com

# For server-side only (optional, more secure but requires API calls)
ADMIN_EMAILS=admin@revshareracing.com,your-email@example.com,another-admin@example.com
```

**Important:** `NEXT_PUBLIC_ADMIN_EMAILS` is exposed to the browser, so anyone can see the admin emails. For better security, use the hardcoded list approach or implement a server-side API check.

Multiple emails should be comma-separated.

### Option 2: Hardcoded List

Edit `web-app/src/lib/admin.ts` and add email addresses to the `ADMIN_EMAILS` array:

```typescript
const ADMIN_EMAILS = [
  "admin@revshareracing.com",
  "your-email@example.com",
];
```

## How It Works

1. When a user tries to access `/admin`, the system checks if their email is in the admin list
2. If not an admin, they are redirected to the dashboard with an access denied message
3. The "Admin" link in the header only appears for admin users
4. All admin API routes are protected (though they use service role key, so they work regardless - but the UI blocks non-admins)

## Security Notes

- Admin emails are checked on both client and server side
- The admin list is case-insensitive
- Email addresses are trimmed of whitespace
- Currently uses a simple email whitelist approach

## Future Improvements

For production, consider:
- Storing admin status in the database (`irc_user_profiles` table)
- Using Supabase user metadata
- Implementing role-based access control (RBAC)
- Adding audit logging for admin actions

