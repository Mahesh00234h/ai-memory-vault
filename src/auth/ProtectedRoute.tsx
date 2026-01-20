import { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/auth/useSession";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();

  const redirectTo = useMemo(() => {
    const next = encodeURIComponent(location.pathname + location.search);
    return `/login?next=${next}`;
  }, [location.pathname, location.search]);

  if (loading) return null;
  if (!session) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
