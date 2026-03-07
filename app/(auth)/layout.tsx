/**
 * Auth layout — wraps the login and signup pages.
 * Centres content on screen with a clean background.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      {children}
    </div>
  );
}
