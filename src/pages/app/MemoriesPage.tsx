import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar, FileText, Lightbulb, CheckCircle, HelpCircle, Copy, Check } from "lucide-react";
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
}

interface RecallResponse {
  success: boolean;
  count: number;
  memories: Memory[];
  promptBlock: string;
  error?: string;
}

export function MemoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

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
            limit: 50,
            recencyDays: 90,
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search memories by keyword..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      {data?.count !== undefined && (
        <div className="text-sm text-muted-foreground">
          {data.count} {data.count === 1 ? "memory" : "memories"} found
          {debouncedQuery && ` matching "${debouncedQuery}"`}
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
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
        <div className="grid gap-4">
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

      {/* Empty state */}
      {!isLoading && data?.count === 0 && (
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

      {/* Memory cards */}
      {!isLoading && data?.memories && data.memories.length > 0 && (
        <div className="grid gap-4">
          {data.memories.map((memory) => (
            <Card key={memory.id} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg leading-tight">
                      {memory.title}
                    </CardTitle>
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
