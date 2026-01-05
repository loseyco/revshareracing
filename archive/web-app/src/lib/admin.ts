/**
 * Admin access control
 * 
 * Uses a combination of:
 * 1. Hardcoded super admin email list (for initial access)
 * 2. Database roles stored in irc_user_profiles table
 */

// List of super admin email addresses (hardcoded for initial access)
// These users have super_admin access regardless of database role
const SUPER_ADMIN_EMAILS = [
  "pjlosey@outlook.com" // Super admin
];

/**
 * Check if a user email is in the hardcoded super admin list
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Get super admin emails from environment variable (comma-separated)
 * Falls back to hardcoded list if env var not set
 * 
 * Note: For client-side use, we need NEXT_PUBLIC_ADMIN_EMAILS
 * For server-side, ADMIN_EMAILS works (but shouldn't be public)
 */
export function getSuperAdminEmails(): string[] {
  // Check for public environment variable (works in client components)
  const envAdmins = typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_ADMIN_EMAILS 
    : process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    
  if (envAdmins) {
    return envAdmins
      .split(",")
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
  }
  
  // Fall back to hardcoded list
  return SUPER_ADMIN_EMAILS.map(email => email.toLowerCase().trim());
}

/**
 * Check if user has admin access
 * 
 * Client-side: Checks hardcoded list and environment variables
 * Server-side: Should also check database roles via API
 * 
 * For full role checking, use the API endpoint /api/admin/check-access
 */
export function checkAdminAccess(email: string | null | undefined): boolean {
  if (!email) return false;
  
  // Check hardcoded super admin list
  const superAdminEmails = getSuperAdminEmails();
  if (superAdminEmails.includes(email.toLowerCase().trim())) {
    return true;
  }
  
  // Note: Database role checking should be done server-side via API
  // This function is used client-side for UI visibility
  // Actual access control is enforced in API routes and layout
  return false;
}

/**
 * Check if a role has admin access
 */
export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role === "admin" || role === "super_admin";
  // Note: "driver" is a user role, not an admin role
}

