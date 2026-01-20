import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function loadProjects() {
    setLoading(true);
    setError(null);

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) {
      setLoading(false);
      setProjects([]);
      return;
    }

    const { data, error: qErr } = await supabase
      .from("projects")
      .select("id,name,description,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);
    if (qErr) {
      setError(qErr.message);
      return;
    }
    setProjects((data as ProjectRow[]) ?? []);
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;

    setCreating(true);
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) {
      setCreating(false);
      setError("You must be signed in.");
      return;
    }

    const { error: insErr } = await supabase.from("projects").insert({
      user_id: userId,
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      team_id: null,
    });

    setCreating(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }

    setName("");
    setDescription("");
    await loadProjects();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">Create a project to scope memory ingestion and recall.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create project</CardTitle>
          <CardDescription>Projects are private to your account for now.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createProject} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="projectName">Name</label>
              <Input id="projectName" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="projectDesc">Description</label>
              <Textarea id="projectDesc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Your projects</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  {p.description ? (
                    <CardDescription>{p.description}</CardDescription>
                  ) : null}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
