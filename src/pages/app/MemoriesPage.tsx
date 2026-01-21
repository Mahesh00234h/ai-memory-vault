import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Calendar, 
  FileText, 
  Lightbulb, 
  CheckCircle, 
  HelpCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  ArrowRightLeft,
  History,
  Database,
  Clock,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Memory {
  id: string;
  title: string;
  topic: string | null;
  summary: string | null;
  key_points: string[];
  decisions: string[];
  open_questions: string[];
  source_platform: string | null;
  source_url: string | null;
  created_at: string;
  project_id: string | null;
  memory_version: number;
  source_captured_at: string | null;
}

interface RecallResponse {
  success: boolean;
  count: number;
  memories: Memory[];
  promptBlock: string;
  error?: string;
}

interface MigrationResponse {
  success: boolean;
  message: string;
  total: number;
  alreadyMigrated: number;
  migrated: number;
  failed?: number;
  errors?: string[];
  dryRun?: boolean;
  toMigrate?: number;
}

interface MigrationStats {
  totalMemories: number;
  v1Memories: number;
  v2Memories: number;
  oldestMigration: string | null;
  latestMigration: string | null;
}

export function MemoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debounce search
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    // Simple debounce
    setTimeout(() => setDebouncedQuery(value), 300);
  };

  // Fetch memories using recall-memory endpoint
  const { data, isLoading, error, refetch } = useQuery<RecallResponse>({
    queryKey: ["memories", debouncedQuery],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recall-memory`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            query: debouncedQuery,
            limit: 100,
            recencyDays: 365,
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch memories: ${text}`);
      }

      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  // Fetch migration stats
  const { data: migrationStats } = useQuery<MigrationStats>({
    queryKey: ["migration-stats"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error("Not authenticated");
      }

      // Get counts by version
      const { data: memories, error } = await supabase
        .from("memories")
        .select("id, memory_version, created_at")
        .eq("user_id", session.user.id);

      if (error) throw error;

      const v1Memories = memories?.filter(m => m.memory_version === 1) || [];
      const v2Memories = memories?.filter(m => m.memory_version !== 1) || [];
      
      // Sort v1 memories by created_at for migration timeline
      const sortedV1 = [...v1Memories].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return {
        totalMemories: memories?.length || 0,
        v1Memories: v1Memories.length,
        v2Memories: v2Memories.length,
        oldestMigration: sortedV1.length > 0 ? sortedV1[0].created_at : null,
        latestMigration: sortedV1.length > 0 ? sortedV1[sortedV1.length - 1].created_at : null,
      };
    },
    refetchOnWindowFocus: false,
  });

  // Migration mutation
  const migrationMutation = useMutation({
    mutationFn: async (dryRun: boolean): Promise<MigrationResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate-v1-memories`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ dryRun }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Migration failed: ${text}`);
      }

      return response.json();
    },
    onSuccess: (result) => {
      if (result.dryRun) {
        toast({
          title: "Migration Preview",
          description: `Found ${result.toMigrate} V1 contexts to migrate (${result.alreadyMigrated} already migrated)`,
        });
      } else {
        toast({
          title: "Migration Complete",
          description: `Migrated ${result.migrated} memories${result.failed ? `, ${result.failed} failed` : ""}`,
        });
        queryClient.invalidateQueries({ queryKey: ["memories"] });
      }
    },
    onError: (error) => {
      toast({
        title: "Migration Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const copyPromptBlock = async () => {
    if (!data?.promptBlock) return;
    
    try {
      await navigator.clipboard.writeText(data.promptBlock);
      setCopiedId("all");
      toast({
        title: "Copied!",
        description: "Prompt block copied to clipboard",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  const copyMemoryAsPrompt = async (memory: Memory) => {
    const prompt = formatMemoryAsPrompt(memory);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(memory.id);
      toast({
        title: "Copied!",
        description: "Memory copied as prompt",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  const formatMemoryAsPrompt = (memory: Memory): string => {
    const lines: string[] = [];
    lines.push(`## ${memory.title}`);
    if (memory.topic) lines.push(`**Topic:** ${memory.topic}`);
    if (memory.source_platform) lines.push(`**Source:** ${memory.source_platform}`);
    lines.push(`**Date:** ${new Date(memory.created_at).toLocaleDateString()}`);
    
    if (memory.summary) {
      lines.push("");
      lines.push(memory.summary);
    }
    
    if (memory.key_points?.length) {
      lines.push("");
      lines.push("**Key Points:**");
      memory.key_points.forEach((p) => lines.push(`- ${p}`));
    }
    
    if (memory.decisions?.length) {
      lines.push("");
      lines.push("**Decisions:**");
      memory.decisions.forEach((d) => lines.push(`- ${d}`));
    }
    
    if (memory.open_questions?.length) {
      lines.push("");
      lines.push("**Open Questions:**");
      memory.open_questions.forEach((q) => lines.push(`- ${q}`));
    }
    
    return lines.join("\n");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Filter memories based on active tab
  const filteredMemories = data?.memories?.filter(memory => {
    if (activeTab === "migrated") return memory.memory_version === 1;
    if (activeTab === "native") return memory.memory_version !== 1;
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Memories</h1>
          <p className="text-muted-foreground">
            Your captured context from AI conversations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* V1 Migration Button */}
          <Button
            variant="outline"
            onClick={() => migrationMutation.mutate(false)}
            disabled={migrationMutation.isPending}
            className="gap-2"
          >
            {migrationMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-4 w-4" />
            )}
            Migrate V1
          </Button>
          {data?.count ? (
            <Button
              variant="outline"
              onClick={copyPromptBlock}
              className="gap-2"
            >
              {copiedId === "all" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy All as Prompt
            </Button>
          ) : null}
        </div>
      </div>

      {/* Migration Stats Cards */}
      {migrationStats && migrationStats.v1Memories > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Total Memories
              </CardDescription>
              <CardTitle className="text-3xl">{migrationStats.totalMemories}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Migrated from V1
              </CardDescription>
              <CardTitle className="text-3xl">{migrationStats.v1Memories}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                {migrationStats.oldestMigration && (
                  <>From {new Date(migrationStats.oldestMigration).toLocaleDateString()}</>
                )}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Native V2
              </CardDescription>
              <CardTitle className="text-3xl">{migrationStats.v2Memories}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                Captured with V2 extension
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              <FileText className="h-4 w-4" />
              All
              {data?.count !== undefined && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {data.count}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="migrated" className="gap-2">
              <History className="h-4 w-4" />
              Migrated
              {migrationStats?.v1Memories !== undefined && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {migrationStats.v1Memories}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="native" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Native
              {migrationStats?.v2Memories !== undefined && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {migrationStats.v2Memories}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search memories by keyword..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats */}
        {filteredMemories.length > 0 && (
          <div className="text-sm text-muted-foreground mt-4">
            {filteredMemories.length} {filteredMemories.length === 1 ? "memory" : "memories"}
            {activeTab === "migrated" && " migrated from V1"}
            {activeTab === "native" && " captured natively"}
            {debouncedQuery && ` matching "${debouncedQuery}"`}
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card className="border-destructive mt-4">
            <CardContent className="pt-6">
              <p className="text-destructive">{(error as Error).message}</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid gap-4 mt-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty states */}
        <TabsContent value="all" className="mt-4">
          {!isLoading && filteredMemories.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No memories yet</h3>
                <p className="text-muted-foreground max-w-sm mt-1">
                  {debouncedQuery
                    ? `No memories match "${debouncedQuery}". Try a different search.`
                    : "Enable V2 Memory in the Chrome extension and capture some AI conversations to see them here."}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="migrated" className="mt-4">
          {!isLoading && filteredMemories.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No migrated memories</h3>
                <p className="text-muted-foreground max-w-sm mt-1">
                  Click "Migrate V1" to import your legacy captured contexts from the old extension format.
                </p>
                <Button
                  variant="outline"
                  onClick={() => migrationMutation.mutate(true)}
                  disabled={migrationMutation.isPending}
                  className="mt-4 gap-2"
                >
                  {migrationMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-4 w-4" />
                  )}
                  Preview Migration
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="native" className="mt-4">
          {!isLoading && filteredMemories.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No native V2 memories</h3>
                <p className="text-muted-foreground max-w-sm mt-1">
                  Enable the "V2 Memory" toggle in the Chrome extension to start capturing conversations directly to V2.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Memory cards */}
      {!isLoading && filteredMemories.length > 0 && (
        <div className="grid gap-4">
          {filteredMemories.map((memory) => (
            <Card key={memory.id} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg leading-tight">
                        {memory.title}
                      </CardTitle>
                      {memory.memory_version === 1 && (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                          <History className="h-3 w-3 mr-1" />
                          Migrated
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {memory.source_platform && (
                        <Badge variant="secondary" className="text-xs">
                          {memory.source_platform}
                        </Badge>
                      )}
                      {memory.topic && (
                        <Badge variant="outline" className="text-xs">
                          {memory.topic}
                        </Badge>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(memory.created_at)}
                      </span>
                      {memory.memory_version === 1 && memory.source_captured_at && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                          <Clock className="h-3 w-3" />
                          Originally: {formatDate(memory.source_captured_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyMemoryAsPrompt(memory)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copiedId === memory.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                {memory.summary && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {memory.summary}
                  </p>
                )}

                {/* Key Points */}
                {memory.key_points?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Key Points
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      {memory.key_points.slice(0, 3).map((point, i) => (
                        <li key={i} className="list-disc">
                          {point}
                        </li>
                      ))}
                      {memory.key_points.length > 3 && (
                        <li className="text-xs text-muted-foreground/70">
                          +{memory.key_points.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Decisions */}
                {memory.decisions?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Decisions
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      {memory.decisions.slice(0, 2).map((decision, i) => (
                        <li key={i} className="list-disc">
                          {decision}
                        </li>
                      ))}
                      {memory.decisions.length > 2 && (
                        <li className="text-xs text-muted-foreground/70">
                          +{memory.decisions.length - 2} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Open Questions */}
                {memory.open_questions?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HelpCircle className="h-4 w-4 text-blue-500" />
                      Open Questions
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      {memory.open_questions.slice(0, 2).map((q, i) => (
                        <li key={i} className="list-disc">
                          {q}
                        </li>
                      ))}
                      {memory.open_questions.length > 2 && (
                        <li className="text-xs text-muted-foreground/70">
                          +{memory.open_questions.length - 2} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Source URL */}
                {memory.source_url && (
                  <a
                    href={memory.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground underline block truncate"
                  >
                    {memory.source_url}
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
