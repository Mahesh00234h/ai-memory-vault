import { Outlet, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout() {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/app/projects" className="font-semibold tracking-tight">
              AI Memory Vault
            </Link>
            <Link to="/app/projects" className="text-sm text-muted-foreground hover:text-foreground">
              Projects
            </Link>
          </div>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
