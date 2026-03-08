import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { 
  Search, Calendar, FileText, Lightbulb, CheckCircle, HelpCircle, 
  Copy, Check, RefreshCw, ArrowRightLeft, History, Database, Clock, 
  AlertCircle, MessageSquare, FileJson, FileCode, Quote, Bot, Send, 
  X, Download, Share2, User, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ──
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
  source_page_title?: string | null;
  source_thread_key?: string | null;
  message_count?: number | null;
  raw_text?: string | null;
  captured_by_name?: string | null;
  created_at: string;
  project_id: string | null;
  memory_version: number;
  source_captured_at: string | null;
  relevance_score?: number;
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

type ChatMsg = { role: "user" | "assistant"; content: string };

// ── Helpers ──
function extractExcerpts(rawText: string, query: string, maxExcerpts = 3): string[] {
  if (!rawText || !query) return [];
  const keywords = query.toLowerCase().split(/\s+/).filter(kw => kw.length >= 2).slice(0, 8);
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  if (!keywords.length) return lines.slice(0, maxExcerpts).map(l => l.slice(0, 200));
  const hits: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!keywords.some(kw => lower.includes(kw))) continue;
    const clipped = line.length > 200 ? line.slice(0, 199) + "…" : line;
    if (!seen.has(clipped)) { hits.push(clipped); seen.add(clipped); }
    if (hits.length >= maxExcerpts) break;
  }
  return hits;
}

function ExcerptSection({ rawText, query }: { rawText: string; query: string }) {
  const excerpts = extractExcerpts(rawText, query, 3);
  if (!excerpts.length) return null;
  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Quote className="h-4 w-4" /> Relevant Excerpts
      </div>
      <div className="space-y-1.5">
        {excerpts.map((excerpt, i) => (
          <p key={i} className="text-xs text-muted-foreground/80 italic bg-muted/30 rounded px-2 py-1.5 leading-relaxed">
            "{excerpt}"
          </p>
        ))}
      </div>
    </div>
  );
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-memories`;

async function streamChat({ messages, onDelta, onDone }: { messages: ChatMsg[]; onDelta: (t: string) => void; onDone: () => void }) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok || !resp.body) {
    const err = await resp.text();
    throw new Error(err || "Stream failed");
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || !line.trim() || !line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const c = JSON.parse(json).choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { buf = line + "\n" + buf; break; }
    }
  }
  onDone();
}

function formatMemoryAsMarkdown(memory: Memory): string {
  const lines: string[] = [`## ${memory.title}`];
  if (memory.captured_by_name) lines.push(`**Captured by:** ${memory.captured_by_name}`);
  if (memory.topic) lines.push(`**Topic:** ${memory.topic}`);
  if (memory.source_platform) lines.push(`**Source:** ${memory.source_platform}`);
  lines.push(`**Date:** ${new Date(memory.created_at).toLocaleDateString()}`);
  if (memory.summary) { lines.push(""); lines.push(memory.summary); }
  if (memory.key_points?.length) { lines.push(""); lines.push("**Key Points:**"); memory.key_points.forEach(p => lines.push(`- ${p}`)); }
  if (memory.decisions?.length) { lines.push(""); lines.push("**Decisions:**"); memory.decisions.forEach(d => lines.push(`- ${d}`)); }
  if (memory.open_questions?.length) { lines.push(""); lines.push("**Open Questions:**"); memory.open_questions.forEach(q => lines.push(`- ${q}`)); }
  return lines.join("\n");
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

// ── Main Component ──
export function MemoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [viewingMemory, setViewingMemory] = useState<Memory | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setTimeout(() => setDebouncedQuery(value), 300);
  };

  // Fetch memories
  const { data, isLoading, error, refetch } = useQuery<RecallResponse>({
    queryKey: ["memories", debouncedQuery],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recall-memory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ query: debouncedQuery, limit: 100, recencyDays: 365 }),
        }
      );
      if (!response.ok) throw new Error(`Failed to fetch memories: ${await response.text()}`);
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  // Migration stats
  const { data: migrationStats } = useQuery<MigrationStats>({
    queryKey: ["migration-stats"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data: memories, error } = await supabase
        .from("memories")
        .select("id, memory_version, created_at")
        .eq("user_id", session.user.id);
      if (error) throw error;
      const v1 = memories?.filter(m => m.memory_version === 1) || [];
      const v2 = memories?.filter(m => m.memory_version !== 1) || [];
      const sorted = [...v1].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return {
        totalMemories: memories?.length || 0,
        v1Memories: v1.length,
        v2Memories: v2.length,
        oldestMigration: sorted[0]?.created_at ?? null,
        latestMigration: sorted[sorted.length - 1]?.created_at ?? null,
      };
    },
    refetchOnWindowFocus: false,
  });

  // Migration
  const migrationMutation = useMutation({
    mutationFn: async (dryRun: boolean): Promise<MigrationResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate-v1-memories`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ dryRun }) }
      );
      if (!response.ok) throw new Error(`Migration failed: ${await response.text()}`);
      return response.json();
    },
    onSuccess: (result) => {
      toast({ title: result.dryRun ? "Migration Preview" : "Migration Complete", description: result.dryRun ? `Found ${result.toMigrate} V1 contexts to migrate` : `Migrated ${result.migrated} memories${result.failed ? `, ${result.failed} failed` : ""}` });
      if (!result.dryRun) queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (e) => { toast({ title: "Migration Failed", description: (e as Error).message, variant: "destructive" }); },
  });

  // ── AI Chat ──
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: "user", content: chatInput.trim() };
    setChatInput("");
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    let soFar = "";
    const upsert = (chunk: string) => {
      soFar += chunk;
      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: soFar } : m);
        return [...prev, { role: "assistant", content: soFar }];
      });
    };
    try {
      await streamChat({ messages: [...chatMessages, userMsg], onDelta: upsert, onDone: () => setChatLoading(false) });
    } catch (e) {
      setChatLoading(false);
      toast({ title: "Chat error", description: (e as Error).message, variant: "destructive" });
    }
  };

  // ── Export ──
  const exportMemories = (format: "markdown" | "json") => {
    const memories = filteredMemories;
    if (!memories.length) return;
    let content: string;
    let filename: string;
    let mime: string;

    if (format === "json") {
      content = JSON.stringify(memories.map(m => ({
        title: m.title, captured_by: m.captured_by_name, topic: m.topic, summary: m.summary,
        key_points: m.key_points, decisions: m.decisions, open_questions: m.open_questions,
        source_platform: m.source_platform, source_url: m.source_url, created_at: m.created_at,
      })), null, 2);
      filename = "memories-export.json";
      mime = "application/json";
    } else {
      content = memories.map(formatMemoryAsMarkdown).join("\n\n---\n\n");
      filename = "memories-export.md";
      mime = "text/markdown";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported!", description: `${memories.length} memories exported as ${format.toUpperCase()}` });
  };

  const shareMemory = async (memory: Memory) => {
    const text = formatMemoryAsMarkdown(memory);
    if (navigator.share) {
      try { await navigator.share({ title: memory.title, text }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      setCopiedId(`share-${memory.id}`);
      toast({ title: "Copied!", description: "Memory copied to clipboard for sharing" });
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // ── Copy helpers ──
  const parseHybridBlocks = (promptBlock: string) => {
    const jsonMatch = promptBlock.match(/```json\n([\s\S]*?)```/);
    const mdMatch = promptBlock.match(/## Markdown \(for direct injection\)\n\n([\s\S]*?)(?=\n## Recommended next step|$)/);
    return { json: jsonMatch?.[1]?.trim() || "", markdown: mdMatch?.[1]?.trim() || "" };
  };

  const copyPromptBlock = async (format: "full" | "json" | "markdown" = "full") => {
    if (!data?.promptBlock) return;
    const { json, markdown } = parseHybridBlocks(data.promptBlock);
    const textToCopy = format === "json" ? json : format === "markdown" ? markdown : data.promptBlock;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(`all-${format}`);
      toast({ title: "Copied!" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast({ title: "Failed to copy", variant: "destructive" }); }
  };

  const copyMemoryAsPrompt = async (memory: Memory) => {
    try {
      await navigator.clipboard.writeText(formatMemoryAsMarkdown(memory));
      setCopiedId(memory.id);
      toast({ title: "Copied!", description: "Memory copied as prompt" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast({ title: "Failed to copy", variant: "destructive" }); }
  };

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
          <p className="text-muted-foreground">Your captured context from AI conversations</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={showChat ? "default" : "outline"} onClick={() => setShowChat(!showChat)} className="gap-2">
            <Bot className="h-4 w-4" />
            {showChat ? "Close Chat" : "Ask AI"}
          </Button>
          <Button variant="outline" onClick={() => exportMemories("markdown")} className="gap-2">
            <Download className="h-4 w-4" /> Export MD
          </Button>
          <Button variant="outline" onClick={() => exportMemories("json")} className="gap-2">
            <FileJson className="h-4 w-4" /> Export JSON
          </Button>
          <Button variant="outline" onClick={() => migrationMutation.mutate(false)} disabled={migrationMutation.isPending} className="gap-2">
            {migrationMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Migrate V1
          </Button>
          {data?.count ? (
            <>
              <Button variant="outline" size="sm" onClick={() => copyPromptBlock("json")} className="gap-1.5">
                {copiedId === "all-json" ? <Check className="h-4 w-4" /> : <FileJson className="h-4 w-4" />} JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyPromptBlock("markdown")} className="gap-1.5">
                {copiedId === "all-markdown" ? <Check className="h-4 w-4" /> : <FileCode className="h-4 w-4" />} Markdown
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyPromptBlock("full")} className="gap-1.5">
                {copiedId === "all-full" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Full
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* AI Chat Panel */}
      {showChat && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> Ask AI about your memories
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowChat(false)}><X className="h-4 w-4" /></Button>
            </div>
            <CardDescription>Ask questions about your captured context and get AI-powered answers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {chatMessages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Try asking: "What decisions have we made about the API?" or "Summarize my recent conversations"
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && <Bot className="h-5 w-5 text-primary mt-1 shrink-0" />}
                  <div className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                  {msg.role === "user" && <User className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />}
                </div>
              ))}
              {chatLoading && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-2">
                  <Bot className="h-5 w-5 text-primary mt-1 shrink-0" />
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <Textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about your memories..."
                className="min-h-[40px] max-h-[100px] resize-none"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              />
              <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} size="sm" className="shrink-0 self-end">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Migration Stats */}
      {migrationStats && migrationStats.v1Memories > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2"><Database className="h-4 w-4" /> Total Memories</CardDescription>
              <CardTitle className="text-3xl">{migrationStats.totalMemories}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2"><History className="h-4 w-4" /> Migrated from V1</CardDescription>
              <CardTitle className="text-3xl">{migrationStats.v1Memories}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {migrationStats.oldestMigration && (
                <p className="text-xs text-muted-foreground">From {new Date(migrationStats.oldestMigration).toLocaleDateString()}</p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Native V2</CardDescription>
              <CardTitle className="text-3xl">{migrationStats.v2Memories}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0"><p className="text-xs text-muted-foreground">Captured with V2 extension</p></CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              <FileText className="h-4 w-4" /> All
              {data?.count !== undefined && <Badge variant="secondary" className="ml-1 text-xs">{data.count}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="migrated" className="gap-2">
              <History className="h-4 w-4" /> Migrated
              {migrationStats?.v1Memories !== undefined && <Badge variant="secondary" className="ml-1 text-xs">{migrationStats.v1Memories}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="native" className="gap-2">
              <CheckCircle className="h-4 w-4" /> Native
              {migrationStats?.v2Memories !== undefined && <Badge variant="secondary" className="ml-1 text-xs">{migrationStats.v2Memories}</Badge>}
            </TabsTrigger>
          </TabsList>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search memories by keyword..." value={searchQuery} onChange={e => handleSearch(e.target.value)} className="pl-10" />
          </div>
        </div>

        {filteredMemories.length > 0 && (
          <div className="text-sm text-muted-foreground mt-4">
            {filteredMemories.length} {filteredMemories.length === 1 ? "memory" : "memories"}
            {activeTab === "migrated" && " migrated from V1"}
            {activeTab === "native" && " captured natively"}
            {debouncedQuery && ` matching "${debouncedQuery}"`}
          </div>
        )}

        {error && (
          <Card className="border-destructive mt-4">
            <CardContent className="pt-6">
              <p className="text-destructive">{(error as Error).message}</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4">Retry</Button>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="grid gap-4 mt-4">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardHeader><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/3" /></CardHeader><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        )}

        <TabsContent value="all" className="mt-4">
          {!isLoading && filteredMemories.length === 0 && (
            <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No memories yet</h3>
              <p className="text-muted-foreground max-w-sm mt-1">
                {debouncedQuery ? `No memories match "${debouncedQuery}".` : "Enable V2 Memory in the Chrome extension to start."}
              </p>
            </CardContent></Card>
          )}
        </TabsContent>
        <TabsContent value="migrated" className="mt-4">
          {!isLoading && filteredMemories.length === 0 && (
            <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No migrated memories</h3>
              <p className="text-muted-foreground max-w-sm mt-1">Click "Migrate V1" to import legacy contexts.</p>
              <Button variant="outline" onClick={() => migrationMutation.mutate(true)} disabled={migrationMutation.isPending} className="mt-4 gap-2">
                {migrationMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Preview Migration
              </Button>
            </CardContent></Card>
          )}
        </TabsContent>
        <TabsContent value="native" className="mt-4">
          {!isLoading && filteredMemories.length === 0 && (
            <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No native V2 memories</h3>
              <p className="text-muted-foreground max-w-sm mt-1">Enable "V2 Memory" toggle in the Chrome extension.</p>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Memory Cards */}
      {!isLoading && filteredMemories.length > 0 && (
        <div className="grid gap-4">
          {filteredMemories.map(memory => (
            <Card key={memory.id} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg leading-tight">{memory.title}</CardTitle>
                      {memory.memory_version === 1 && (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                          <History className="h-3 w-3 mr-1" /> Migrated
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {memory.captured_by_name && (
                        <span className="flex items-center gap-1 text-xs font-medium text-foreground/80">
                          <User className="h-3 w-3" /> {memory.captured_by_name}
                        </span>
                      )}
                      {memory.source_platform && <Badge variant="secondary" className="text-xs">{memory.source_platform}</Badge>}
                      {memory.topic && <Badge variant="outline" className="text-xs">{memory.topic}</Badge>}
                      {typeof memory.message_count === "number" && memory.message_count > 0 && (
                        <span className="flex items-center gap-1 text-xs"><MessageSquare className="h-3 w-3" /> {memory.message_count} msgs</span>
                      )}
                      {typeof memory.relevance_score === "number" && memory.relevance_score > 0 && (
                        <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">Score: {memory.relevance_score}</Badge>
                      )}
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(memory.created_at)}</span>
                      {memory.memory_version === 1 && memory.source_captured_at && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                          <Clock className="h-3 w-3" /> Originally: {formatDate(memory.source_captured_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {memory.raw_text && (
                      <Button variant="ghost" size="sm" onClick={() => setViewingMemory(memory)} title="View full chat">
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => shareMemory(memory)} title="Share">
                      {copiedId === `share-${memory.id}` ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => copyMemoryAsPrompt(memory)} title="Copy as prompt">
                      {copiedId === memory.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {memory.summary && <p className="text-sm text-muted-foreground leading-relaxed">{memory.summary}</p>}
                {memory.key_points?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium"><Lightbulb className="h-4 w-4 text-amber-500" /> Key Points</div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      {memory.key_points.slice(0, 3).map((p, i) => <li key={i} className="list-disc">{p}</li>)}
                      {memory.key_points.length > 3 && <li className="text-xs text-muted-foreground/70">+{memory.key_points.length - 3} more</li>}
                    </ul>
                  </div>
                )}
                {memory.decisions?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium"><CheckCircle className="h-4 w-4 text-green-500" /> Decisions</div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      {memory.decisions.slice(0, 2).map((d, i) => <li key={i} className="list-disc">{d}</li>)}
                      {memory.decisions.length > 2 && <li className="text-xs text-muted-foreground/70">+{memory.decisions.length - 2} more</li>}
                    </ul>
                  </div>
                )}
                {memory.open_questions?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium"><HelpCircle className="h-4 w-4 text-blue-500" /> Open Questions</div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      {memory.open_questions.slice(0, 2).map((q, i) => <li key={i} className="list-disc">{q}</li>)}
                      {memory.open_questions.length > 2 && <li className="text-xs text-muted-foreground/70">+{memory.open_questions.length - 2} more</li>}
                    </ul>
                  </div>
                )}
                {memory.source_page_title && <p className="text-xs text-muted-foreground"><span className="font-medium">Page:</span> {memory.source_page_title}</p>}
                {memory.source_url && (
                  <a href={memory.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline block truncate">
                    {memory.source_url}
                  </a>
                )}
                {memory.raw_text && debouncedQuery && <ExcerptSection rawText={memory.raw_text} query={debouncedQuery} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Full Chat Dialog */}
      <Dialog open={!!viewingMemory} onOpenChange={(open) => !open && setViewingMemory(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {viewingMemory?.title}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground pt-1">
              {viewingMemory?.captured_by_name && (
                <span className="flex items-center gap-1 text-xs font-medium">
                  <User className="h-3 w-3" /> {viewingMemory.captured_by_name}
                </span>
              )}
              {viewingMemory?.source_platform && <Badge variant="secondary" className="text-xs">{viewingMemory.source_platform}</Badge>}
              {viewingMemory?.created_at && <span className="text-xs">{formatDate(viewingMemory.created_at)}</span>}
              {typeof viewingMemory?.message_count === "number" && viewingMemory.message_count > 0 && (
                <span className="text-xs">{viewingMemory.message_count} messages</span>
              )}
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-2">
            <div className="space-y-0 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/90 bg-muted/30 rounded-lg p-4">
              {viewingMemory?.raw_text || "No raw chat text available for this memory."}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-2">
            {viewingMemory?.source_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={viewingMemory.source_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                  Open original link
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={async () => {
              if (viewingMemory?.raw_text) {
                await navigator.clipboard.writeText(viewingMemory.raw_text);
                toast({ title: "Copied!", description: "Full chat text copied to clipboard" });
              }
            }} className="gap-2">
              <Copy className="h-4 w-4" /> Copy text
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
