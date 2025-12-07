// Force dynamic rendering for all auth pages to prevent static generation issues
// This is needed because auth pages use useSearchParams() which requires dynamic rendering
export const dynamic = 'force-dynamic';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
