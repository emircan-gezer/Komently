"use client";

import { useEffect, useState, useCallback, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase/client";
import {
  Settings,
  ShieldCheck,
  Terminal,
  BarChart3,
  Save,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Info,
  Sparkles,
  Send,
  Bot,
  User,
  Copy,
  Check,
  Activity,
  MessageSquare,
  Clock,
  Zap,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  ShieldAlert,
  Trash2,
  Filter,
  EyeOff,
  UserX,
  FileText,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectionSettings {
  max_chars: number;
  blacklist: string[];
  ai_moderation_enabled: boolean;
  ai_toxicity_threshold: number;
  rate_limit_seconds?: number;
  spam_guard_enabled?: boolean;
  context_analyzer_enabled?: boolean;
  sentiment_analysis_enabled?: boolean;
  auto_action_strikes?: number;
}

interface Section {
  id: string;
  public_id: string;
  name: string;
  status: "active" | "paused";
  settings: SectionSettings;
  created_at: string;
}

type Tab = "general" | "rules" | "ai" | "moderation" | "analytics" | "reports" | "assistant";

// ── Helpers ───────────────────────────────────────────────────────────────────

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return { copied, copy };
}

function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SidebarButton({
  tab,
  active,
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  tab: Tab;
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all text-left ${
        active
          ? accent
            ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
            : "bg-primary/10 text-primary border border-primary/20 shadow-sm"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? (accent ? "text-violet-400" : "text-primary") : ""}`} />
      {label}
    </button>
  );
}

function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="flex items-center gap-2 group focus:outline-none"
      aria-label={label}
    >
      {enabled ? (
        <ToggleRight className="h-7 w-7 text-primary transition-colors group-hover:opacity-80" />
      ) : (
        <ToggleLeft className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-foreground" />
      )}
      <span className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${enabled ? "text-primary" : "text-muted-foreground"}`}>
        {enabled ? "Enabled" : "Disabled"}
      </span>
    </button>
  );
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          <Info className="h-3 w-3 shrink-0" />
          {hint}
        </p>
      )}
    </div>
  );
}

function PanelCard({
  title,
  description,
  children,
  action,
}: {
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] border border-border/60 bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border/40 bg-muted/10 px-6 py-5">
        <div>
          <h3 className="font-bold tracking-tight text-foreground flex items-center gap-2">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[13px] text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-6 py-6 space-y-6">{children}</div>
    </div>
  );
}

// ── Embed Snippet ─────────────────────────────────────────────────────────────

function EmbedSnippet({ publicId }: { publicId: string }) {
  const snippet = `import { KomentlyWidget } from 'komently-sdk';\n\n<KomentlyWidget publicId="${publicId}" />`;
  const { copied, copy } = useCopy(snippet);

  return (
    <div className="rounded-[1rem] border border-border/40 bg-background overflow-hidden relative group shadow-sm">
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={copy}
          className="flex items-center justify-center h-7 w-7 rounded border border-border/60 bg-muted/50 text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="px-5 py-4 text-[12px] font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed overflow-x-auto">
        {snippet}
      </pre>
    </div>
  );
}

// ── Tab panels ────────────────────────────────────────────────────────────────

function GeneralTab({
  section,
  editName,
  setEditName,
  editStatus,
  setEditStatus,
}: {
  section: Section;
  editName: string;
  setEditName: (v: string) => void;
  editStatus: "active" | "paused";
  setEditStatus: (v: "active" | "paused") => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PanelCard
        title="Identity"
        description="Internal label and permanent public identifier for this section."
      >
        <FieldGroup label="Display Name" hint="For your internal dashboard only — not shown to commenters.">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </FieldGroup>

        <FieldGroup label="Public ID" hint="Used in the embed snippet to link comments to this section.">
          <input
            readOnly
            value={section.public_id}
            className="w-full rounded-xl border border-dashed border-border/60 bg-muted/20 px-3.5 py-2.5 font-mono text-sm text-muted-foreground cursor-default focus:outline-none"
          />
        </FieldGroup>
      </PanelCard>

      <PanelCard
        title="Operational Status"
        description="Quickly halt or resume discussion activity across your live deployment."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => setEditStatus("active")}
            className={`flex items-start gap-4 rounded-[1rem] border p-5 text-left transition-all ${
              editStatus === "active"
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                : "border-border/50 bg-background/20 hover:bg-card hover:border-border"
            }`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${editStatus === "active" ? "bg-primary/20" : "bg-muted"}`}>
               <CheckCircle2 className={`h-4.5 w-4.5 ${editStatus === "active" ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-bold text-sm">Active</p>
              <p className="mt-1 text-[12px] text-muted-foreground leading-snug">
                Comments open and being moderated in real time.
              </p>
            </div>
          </button>

          <button
            onClick={() => setEditStatus("paused")}
            className={`flex items-start gap-4 rounded-[1rem] border p-5 text-left transition-all ${
              editStatus === "paused"
                ? "border-destructive/40 bg-destructive/5 ring-1 ring-destructive/20 shadow-sm"
                : "border-border/50 bg-background/20 hover:bg-card hover:border-border"
            }`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${editStatus === "paused" ? "bg-destructive/20" : "bg-muted"}`}>
              <XCircle className={`h-4.5 w-4.5 ${editStatus === "paused" ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-bold text-sm">Paused</p>
              <p className="mt-1 text-[12px] text-muted-foreground leading-snug">
                New comments disabled. Existing comments remain visible.
              </p>
            </div>
          </button>
        </div>
      </PanelCard>

      <PanelCard title="Embed" description="Drop this component into your codebase to render the section.">
        <EmbedSnippet publicId={section.public_id} />
        <a
          href={`/api/comments/${section.public_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors hover:underline underline-offset-2"
        >
          <ExternalLink className="h-3 w-3" /> View live API response
        </a>
      </PanelCard>
    </div>
  );
}

function RulesTab({
  editMaxChars,
  setEditMaxChars,
  editBlacklist,
  setEditBlacklist,
}: {
  editMaxChars: number;
  setEditMaxChars: (v: number) => void;
  editBlacklist: string;
  setEditBlacklist: (v: string) => void;
}) {
  const blacklistCount = editBlacklist
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PanelCard
        title="Content Limits"
        description="Hard constraints applied immediately before AI analysis."
      >
        <FieldGroup
          label="Maximum Comment Length"
          hint={`Current limit: ${editMaxChars.toLocaleString()} characters. Allowable range: 100 to 10,000.`}
        >
          <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
            <input
              type="range"
              min={100}
              max={10000}
              step={100}
              value={editMaxChars}
              onChange={(e) => setEditMaxChars(Number(e.target.value))}
              className="flex-1 h-1.5 accent-primary cursor-pointer w-full"
            />
            <div className="bg-card border border-border/60 rounded px-2.5 py-1 min-w-[5rem] text-center shadow-sm">
                <span className="font-mono text-[13px] font-bold text-foreground">
                {editMaxChars.toLocaleString()}
                </span>
            </div>
          </div>
        </FieldGroup>
      </PanelCard>

      <PanelCard
        title="Keyword Blacklist"
        description="Strict moderation bounds. Mentions of these exact strings instantly reject a comment."
        action={
          blacklistCount > 0 ? (
            <span className="rounded-full bg-destructive/10 border border-destructive/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-destructive">
              {blacklistCount} blocked term{blacklistCount !== 1 ? "s" : ""}
            </span>
          ) : null
        }
      >
        <FieldGroup label="Blocked Terms" hint="Comma separated. Matches exactly (case-insensitive) anywhere in the text.">
          <textarea
            value={editBlacklist}
            onChange={(e) => setEditBlacklist(e.target.value)}
            rows={5}
            placeholder="buy now, crypto, casino, http://suspicious-link.com"
            className="w-full resize-none rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </FieldGroup>
      </PanelCard>
    </div>
  );
}

function AiTab({
  editAiEnabled, setEditAiEnabled,
  editAiThreshold, setEditAiThreshold,
  spamGuard, setSpamGuard,
  contextAnalyzer, setContextAnalyzer,
  sentimentAnalysis, setSentimentAnalysis,
  autoActionStrikes, setAutoActionStrikes,
}: {
  editAiEnabled: boolean; setEditAiEnabled: (v: boolean) => void;
  editAiThreshold: number; setEditAiThreshold: (v: number) => void;
  spamGuard: boolean; setSpamGuard: (v: boolean) => void;
  contextAnalyzer: boolean; setContextAnalyzer: (v: boolean) => void;
  sentimentAnalysis: boolean; setSentimentAnalysis: (v: boolean) => void;
  autoActionStrikes: number; setAutoActionStrikes: (v: number) => void;
}) {
  const thresholdLabel =
    editAiThreshold < 0.35 ? "Very lenient" :
    editAiThreshold < 0.6 ? "Balanced" :
    editAiThreshold < 0.8 ? "Strict" : "Zero tolerance";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PanelCard
        title={<><Bot className="h-5 w-5 text-primary" /> Global AI Moderation</>}
        description="The master switch for your autonomous moderation pipeline."
        action={<Toggle enabled={editAiEnabled} onChange={setEditAiEnabled} label="Toggle AI Engine" />}
      >
        <div className={`space-y-6 transition-all duration-300 ${editAiEnabled ? "opacity-100" : "opacity-40 grayscale pointer-events-none select-none"}`}>
          <FieldGroup label="Toxicity Strictness">
            <div className="bg-muted/10 p-5 rounded-2xl border border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                 <span className="text-[13px] font-semibold text-foreground">{thresholdLabel}</span>
                 <span className="bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 font-mono text-[12px] font-bold">
                    {Math.round(editAiThreshold * 100)}% Match
                 </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.95}
                step={0.05}
                value={editAiThreshold}
                onChange={(e) => setEditAiThreshold(Number(e.target.value))}
                className="w-full h-1.5 accent-primary cursor-pointer"
              />
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                 AI scores comments from 0 (Safe) to 1.0 (Toxic). <br/>
                 Current setting flags content exceeding a score of <strong className="text-foreground">{editAiThreshold.toFixed(2)}</strong>.
              </p>
            </div>
          </FieldGroup>
        </div>
      </PanelCard>

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 transition-opacity duration-300 ${editAiEnabled ? "opacity-100" : "opacity-50 pointer-events-none grayscale"}`}>
         <div className="col-span-1 sm:col-span-2 md:col-span-1 rounded-2xl border border-border/50 bg-card p-5 space-y-3 flex flex-col justify-between hover:border-border transition-colors">
            <div className="flex items-start justify-between gap-2">
               <div>
                  <div className="flex items-center gap-1.5">
                     <ShieldCheck className="h-4 w-4 text-primary" />
                     <p className="text-sm font-bold">Spam Guard</p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-1.5 max-w-[90%]">
                     Detect unsolicited promotions, suspicious URLs, and heavily repeated copy-paste actions natively.
                  </p>
               </div>
               <Toggle enabled={spamGuard} onChange={setSpamGuard} label="Spam guard" />
            </div>
         </div>

         <div className="col-span-1 sm:col-span-2 md:col-span-1 rounded-2xl border border-border/50 bg-card p-5 space-y-3 flex flex-col justify-between hover:border-border transition-colors">
            <div className="flex items-start justify-between gap-2">
               <div>
                  <div className="flex items-center gap-1.5">
                     <MessageSquare className="h-4 w-4 text-primary" />
                     <p className="text-sm font-bold">Context Analyzer</p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-1.5 max-w-[90%]">
                     Uses deeper contextual NLP to keep multi-level replies grounded on topic, reducing troll derails.
                  </p>
               </div>
               <Toggle enabled={contextAnalyzer} onChange={setContextAnalyzer} label="Context Analyzer" />
            </div>
         </div>

         <div className="col-span-1 sm:col-span-2 md:col-span-1 rounded-2xl border border-border/50 bg-card p-5 space-y-3 flex flex-col justify-between hover:border-border transition-colors">
            <div className="flex items-start justify-between gap-2">
               <div>
                  <div className="flex items-center gap-1.5">
                     <Activity className="h-4 w-4 text-primary" />
                     <p className="text-sm font-bold">Sentiment Aggregation</p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-1.5 max-w-[90%]">
                     Analyze comments on ingestion to power overall discussion health dashboards.
                  </p>
               </div>
               <Toggle enabled={sentimentAnalysis} onChange={setSentimentAnalysis} label="Sentiment" />
            </div>
         </div>

         <div className="col-span-1 sm:col-span-2 md:col-span-1 rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-center gap-1.5 mb-2">
               <Zap className="h-4 w-4 text-destructive" />
               <p className="text-sm font-bold text-destructive">Offender Auto-Ban</p>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground mb-4">
               Number of flagged infractions permitted before entirely restricting the user's Komently access in this section.
            </p>

            <div className="flex items-center gap-3">
               <span className="text-[12px] font-semibold text-muted-foreground w-12 text-right">0 (Off)</span>
               <input
                 type="range"
                 min={0}
                 max={10}
                 step={1}
                 value={autoActionStrikes}
                 onChange={(e) => setAutoActionStrikes(Number(e.target.value))}
                 className="flex-1 h-1.5 accent-destructive cursor-pointer"
               />
               <span className="text-[14px] font-mono font-bold text-destructive min-w-[24px] text-left">
                  {autoActionStrikes > 0 ? autoActionStrikes : "-"}
               </span>
            </div>
         </div>
      </div>
    </div>
  );
}

// ── Moderation Tab ────────────────────────────────────────────────────────────

function ModerationTab({ publicId }: { publicId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sections/${publicId}/comments?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {
      console.error("Failed to fetch comments");
    } finally {
      setLoading(false);
    }
  }, [publicId, filter]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleAction = async (commentId: string, status: string) => {
    setActionLoading(commentId);
    try {
      const res = await fetch(`/api/sections/${publicId}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moderation_status: status }),
      });
      if (res.ok) fetchComments();
    } catch {
      console.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSoftDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to permanently delete this comment?")) return;
    setActionLoading(commentId);
    try {
      const res = await fetch(`/api/sections/${publicId}/comments/${commentId}`, { method: "DELETE" });
      if (res.ok) fetchComments();
    } catch {
      console.error("Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Moderation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-border/60 bg-card px-6 py-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground mr-1" />
          <p className="text-sm font-semibold">Queue View:</p>
          <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50 ml-2">
            {[
              { id: "all", label: "All" },
              { id: "pending", label: "Pending" },
              { id: "approved", label: "Approved" },
              { id: "rejected", label: "Rejected" },
              { id: "shadow_hidden", label: "Shadowbanned" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
                  filter === f.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[12px] text-muted-foreground font-medium">
          {loading ? "Loading..." : `${comments.length} comments found`}
        </div>
      </div>

      {/* Comment List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 animate-pulse gap-4 rounded-[1.25rem] border border-border/60 bg-card">
             <ShieldAlert className="h-8 w-8 text-muted-foreground/30" />
             <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Fetching Queue…</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4 rounded-[1.25rem] border border-border/60 bg-card text-center">
             <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mb-2" />
             <p className="text-sm font-bold text-foreground">Moderation queue is empty</p>
             <p className="text-[12px] text-muted-foreground max-w-sm">No comments match the current status filter. You're all caught up!</p>
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-[1.25rem] border border-border/60 bg-card overflow-hidden transition-all hover:border-border shadow-sm">
              <div className="flex flex-col sm:flex-row border-b border-border/40">
                {/* Left Side: Comment Info */}
                <div className="flex-1 p-5 lg:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full font-bold text-[13px] text-white shrink-0 shadow-inner" style={{ backgroundColor: c.commenters?.color || '#8b5cf6' }}>
                        {c.commenters?.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground leading-none">{c.commenters.username}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(c.created_at)}</p>
                      </div>
                    </div>
                    
                    <Badge className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${
                      c.moderation_status === "approved" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                      c.moderation_status === "rejected" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                      c.moderation_status === "shadow_hidden" ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                      "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    }`}>
                      {c.moderation_status}
                    </Badge>
                  </div>

                  <p className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {c.body}
                  </p>
                </div>

                {/* Right Side: AI Meta & Actions */}
                <div className="sm:w-[280px] bg-muted/10 border-t sm:border-t-0 sm:border-l border-border/40 p-5 flex flex-col justify-between shrink-0">
                  <div className="space-y-4">
                    <div>
                      <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                        <Bot className="h-3 w-3" /> AI Analysis
                      </h4>
                      {c.ai_metadata?.reason ? (
                        <p className="text-[12px] text-foreground/80 leading-snug">
                          {c.ai_metadata.reason}
                        </p>
                      ) : (
                        <p className="text-[12px] italic text-muted-foreground/60">No AI reasoning recorded.</p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-[11px] font-mono p-2 rounded-lg bg-background/50 border border-border/50">
                      <span className="text-muted-foreground">Tox/Spam</span>
                      <span className="font-bold">
                        {c.toxicity_score?.toFixed(2) || "0.00"} / {c.is_spam ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-5">
                     <Button
                       variant="outline"
                       size="sm"
                       disabled={actionLoading === c.id}
                       onClick={() => handleAction(c.id, "approved")}
                       className="flex-1 h-8 text-[11px] bg-background hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/30"
                     >
                       <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       disabled={actionLoading === c.id}
                       onClick={() => handleAction(c.id, "rejected")}
                       className="flex-1 h-8 text-[11px] bg-background hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
                     >
                       <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                     </Button>
                     <button
                       disabled={actionLoading === c.id}
                       onClick={() => handleSoftDelete(c.id)}
                       title="Permanently Delete"
                       className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 disabled:opacity-50 transition-colors"
                     >
                       <Trash2 className="h-3.5 w-3.5" />
                     </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AnalyticsTab({ publicId }: { publicId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
       setLoading(true);
       try {
         const res = await fetch(`/api/sections/${publicId}/analytics`);
         if (res.ok) {
           const analyticsStats = await res.json();
           setData({
             total: analyticsStats.total,
             approvalRate: analyticsStats.approvalRate,
             avgResponse: analyticsStats.avgResponse,
             thisWeek: analyticsStats.thisWeek,
             approved: analyticsStats.approved,
             rejected: analyticsStats.rejected,
             pending: analyticsStats.pending
           });
         }
       } catch (err) {
         console.error("Failed to fetch analytics");
       } finally {
         setLoading(false);
       }
    }
    fetchAnalytics();
  }, [publicId]);

  if (loading || !data) {
     return (
        <div className="flex flex-col items-center justify-center p-20 animate-pulse gap-4 rounded-[1.25rem] border border-border/60 bg-card">
           <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
           <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Compiling Telemetry…</p>
        </div>
     );
  }

  const metrics = [
    { icon: MessageSquare, label: "Total Lifetime", value: data.total },
    { icon: TrendingUp, label: "Volume (7d)", value: data.thisWeek },
    { icon: Activity, label: "Safe Approval RT", value: `${data.approvalRate}%` },
    { icon: Clock, label: "Avg Thread Gap", value: data.avgResponse },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-[1rem] border border-border/60 bg-card p-5 group hover:border-border transition-colors">
            <div className="flex items-center gap-3 mb-3">
               <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                 <m.icon className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
               </div>
            </div>
            <p className="font-mono text-2xl font-bold tracking-tight text-foreground">{m.value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[1.25rem] border border-border/60 bg-card overflow-hidden flex flex-col">
        <div className="border-b border-border/40 bg-muted/10 px-6 py-5">
          <h3 className="font-bold tracking-tight">AI Moderation Funnel</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Cumulative breakdown from the last 30 days of ingest operations.</p>
        </div>
        <div className="px-6 py-8 space-y-6 flex-1">
          {[
            { label: "Approved automatically by threshold", val: data.approved, color: "bg-green-500", textCol: "text-green-500" },
            { label: "Rejected via SpamGuard + Toxicity limits", val: data.rejected, color: "bg-destructive", textCol: "text-destructive" },
            { label: "Pending manual moderator override", val: data.pending, color: "bg-orange-400", textCol: "text-orange-400" },
          ].map((row) => (
            <div key={row.label} className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-[12px] font-bold text-foreground">{row.label}</span>
                <span className={`font-mono text-lg font-bold ${row.textCol}`}>
                  {typeof row.val === 'number' ? row.val.toFixed(1) : row.val}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.color}`}
                  style={{ width: `${row.val}%`, transition: "width 1s cubic-bezier(.4,0,.2,1)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────

function ReportsTab({ publicId }: { publicId: string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`/api/sections/${publicId}/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {
      console.error("Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    fetchReports();
    // Poll every 5s if any report is processing
    const interval = setInterval(() => {
      setReports((current) => {
        if (current.some(r => r.status === "processing")) {
          fetchReports();
        }
        return current;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/sections/${publicId}/reports`, { method: "POST" });
      if (res.ok) {
        await fetchReports();
      } else {
        const d = await res.json().catch(()=>({}));
        alert(d.error || "Failed to start generation");
      }
    } catch {
      console.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const isProcessing = reports.some(r => r.status === "processing");

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      line = line.trim();
      if (!line) return <div key={i} className="h-4" />; // spacer
      if (line.startsWith("### ")) return <h4 key={i} className="text-sm font-bold mt-4 mb-2 text-foreground">{line.replace("### ", "")}</h4>;
      if (line.startsWith("## ")) return <h3 key={i} className="text-base font-bold mt-5 mb-3 text-foreground">{line.replace("## ", "")}</h3>;
      if (line.startsWith("# ")) return <h2 key={i} className="text-lg font-bold mt-6 mb-4 text-foreground">{line.replace("# ", "")}</h2>;
      if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="text-[13px] text-foreground/80 ml-4 list-disc marker:text-primary">{line.substring(2)}</li>;
      
      // Bold syntax handling
      const bolded = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
         if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="text-foreground">{part.slice(2, -2)}</strong>;
         }
         return <span key={j}>{part}</span>;
      });
      return <p key={i} className="text-[13px] text-foreground/80 leading-relaxed mb-2">{bolded}</p>;
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-border/60 bg-card px-6 py-5 shadow-sm">
        <div>
           <h3 className="text-base font-bold text-foreground flex items-center gap-2">
             <FileText className="h-4 w-4 text-primary" /> Executive Summaries
           </h3>
           <p className="text-[12px] text-muted-foreground mt-1 max-w-lg">
             Summon the Senior Data Analyst agent to review the last 7 days of SQL volume, read the top comments, and write a human-readable community health report.
           </p>
        </div>
        <Button 
          onClick={handleGenerate} 
          disabled={loading || generating || isProcessing}
          className="rounded-xl h-10 font-bold tracking-wide"
        >
          {isProcessing ? "Analyst is Working…" : "Generate New Report"}
        </Button>
      </div>

      <div className="space-y-5">
        {loading ? (
          <div className="flex justify-center p-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary border-t-transparent shadow-sm" /></div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4 rounded-[1.25rem] border border-dashed border-border/60 bg-background text-center">
             <FileText className="h-10 w-10 text-muted-foreground/30 mb-2" />
             <p className="text-sm font-bold text-foreground">No reports generated yet</p>
             <p className="text-[12px] text-muted-foreground max-w-sm">Click the button above to have the Analyst agent draft your first weekly digest.</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="rounded-[1.25rem] border border-border/60 bg-card overflow-hidden shadow-sm">
              <div className="border-b border-border/40 bg-muted/10 px-6 py-4 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className={`h-2.5 w-2.5 rounded-full ${report.status === 'completed' ? 'bg-green-500' : report.status === 'failed' ? 'bg-red-500' : 'bg-orange-400 animate-pulse'}`} />
                   <p className="text-sm font-bold text-foreground">
                      Report {report.id.split('-')[0].toUpperCase()}
                   </p>
                 </div>
                 <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
                   {new Date(report.created_at).toLocaleDateString()}
                 </p>
              </div>
              <div className="p-6">
                 {report.status === "processing" ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                       <Bot className="h-8 w-8 text-primary animate-bounce mix-blend-screen" />
                       <p className="text-sm font-semibold animate-pulse">Analyst is compiling the SQL data and rendering markdown…</p>
                       <p className="text-[11px] text-muted-foreground font-mono">Do not refresh. The Agent operates asynchronously.</p>
                    </div>
                 ) : report.status === "failed" ? (
                    <p className="text-sm text-destructive font-semibold">The CrewAI task failed to execute or timed out.</p>
                 ) : (
                    <div className="markdown-render-block">
                       {renderMarkdown(report.report_content || "No content generated.")}
                    </div>
                 )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AssistantTab({
  publicId,
  chatMessages,
  chatInput,
  setChatInput,
  chatLoading,
  sendChatMessage,
}: {
  publicId: string;
  chatMessages: { role: string; content: string }[];
  chatInput: string;
  setChatInput: (v: string) => void;
  chatLoading: boolean;
  sendChatMessage: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const suggestions = [
    "Increase my spam sensitivity to strict",
    "Show me the most recent flagged messages",
    "Pause comment ingestion right now",
    "Disable context tracking",
  ];

  return (
    <div
      className="rounded-[1.25rem] border border-border/60 bg-card overflow-hidden flex flex-col h-[600px] shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-center gap-4 border-b border-border/40 bg-muted/10 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
          <Bot className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Moderator Copilot</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Agentic interface managing <span className="font-mono">{publicId}</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Linked</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5 bg-background/30">
        {chatMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 mb-4">
              <Sparkles className="h-6 w-6 text-violet-400" />
            </div>
            <p className="text-sm font-bold mb-2">Awaiting Instructions</p>
            <p className="text-[12px] text-muted-foreground max-w-sm mb-6 leading-relaxed">
              Use natural language to configure constraints, inspect telemetry, or immediately halt activity.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setChatInput(s)}
                  className="rounded-lg border border-border/60 bg-card px-4 py-2.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border transition-colors text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-violet-500/10 border border-violet-500/20">
                  <Bot className="h-4 w-4 text-violet-500" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-[1.25rem] px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                    : "bg-card border border-border/70 rounded-bl-sm text-foreground shadow-sm"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-muted border border-border/60">
                  <User className="h-4 w-4 text-foreground/60" />
                </div>
              )}
            </div>
          ))
        )}
        {chatLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-violet-500/10 border border-violet-500/20">
              <Bot className="h-4 w-4 text-violet-500" />
            </div>
            <div className="rounded-[1.25rem] rounded-bl-sm border border-border/70 bg-card px-5 py-3.5 shadow-sm">
              <div className="flex gap-1.5 items-center justify-center h-full">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 rounded-full bg-violet-500/60 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 bg-card p-4 border-t border-border/40">
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
              }
            }}
            placeholder="Command the AI..."
            className="flex-1 rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:bg-background transition-shadow"
          />
          <button
            onClick={sendChatMessage}
            disabled={chatLoading || !chatInput.trim()}
            className="flex items-center justify-center h-11 w-11 rounded-xl bg-violet-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page Main Container ───────────────────────────────────────────────────────

export default function SectionDashboardPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = use(params);
  const router = useRouter();

  const [section, setSection] = useState<Section | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "paused">("active");
  const [editMaxChars, setEditMaxChars] = useState(5000);
  const [editBlacklist, setEditBlacklist] = useState("");
  const [editAiEnabled, setEditAiEnabled] = useState(true);
  const [editAiThreshold, setEditAiThreshold] = useState(0.8);
  
  // New AI Settings
  const [spamGuard, setSpamGuard] = useState(true);
  const [contextAnalyzer, setContextAnalyzer] = useState(false);
  const [sentimentAnalysis, setSentimentAnalysis] = useState(false);
  const [autoActionStrikes, setAutoActionStrikes] = useState(3);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(`/dashboard/${publicId}`)}`);
      }
    });
  }, [router, publicId]);

  const loadSection = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sections/${publicId}`);
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/dashboard/${publicId}`)}`);
        return;
      }
      if (res.ok) {
        const { section: s } = await res.json();
        setSection(s);
        setEditName(s.name);
        setEditStatus(s.status);
        
        const sets = s.settings || {};
        setEditMaxChars(sets.max_chars ?? 5000);
        setEditBlacklist((sets.blacklist ?? []).join(", "));
        setEditAiEnabled(sets.ai_moderation_enabled ?? true);
        setEditAiThreshold(sets.ai_toxicity_threshold ?? 0.8);
        setSpamGuard(sets.spam_guard_enabled ?? true);
        setContextAnalyzer(sets.context_analyzer_enabled ?? false);
        setSentimentAnalysis(sets.sentiment_analysis_enabled ?? false);
        setAutoActionStrikes(sets.auto_action_strikes ?? 3);
      } else {
        router.push("/dashboard");
      }
    } catch {
      console.error("Failed to load section");
    } finally {
      setLoading(false);
    }
  }, [publicId, router]);

  useEffect(() => { loadSection(); }, [loadSection]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/sections/${publicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          status: editStatus,
          settings: {
            max_chars: editMaxChars,
            blacklist: editBlacklist.split(",").map((s) => s.trim()).filter(Boolean),
            ai_moderation_enabled: editAiEnabled,
            ai_toxicity_threshold: editAiThreshold,
            spam_guard_enabled: spamGuard,
            context_analyzer_enabled: contextAnalyzer,
            sentiment_analysis_enabled: sentimentAnalysis,
            auto_action_strikes: autoActionStrikes
          },
        }),
      });
      if (res.ok) {
        const { section: s } = await res.json();
        setSection(s);
        setSavedAt(new Date());
        setTimeout(() => setSavedAt(null), 3500);
      } else {
         const d = await res.json().catch(()=>({}));
         setSaveError(d.error || "Save Failed");
      }
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }, [publicId, editName, editStatus, editMaxChars, editBlacklist, editAiEnabled, editAiThreshold, spamGuard, contextAnalyzer, sentimentAnalysis, autoActionStrikes]);

  const sendChatMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionPublicId: publicId,
          message: msg,
          history: chatMessages.slice(-10),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        let reply: string = data.reply ?? "Action acknowledged.";
        if (data.actions_taken?.length) {
          reply += "\n\n✅ Automatically updated settings: " + data.actions_taken.join(", ");
        }
        setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "Error communicating with AI service." }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Network Error." }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, publicId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent shadow-sm" />
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest animate-pulse">
            Connecting
          </p>
        </div>
      </div>
    );
  }

  if (!section) return null;

  const nav: { tab: Tab; icon: React.ElementType; label: string; accent?: boolean }[] = [
    { tab: "general", icon: Settings, label: "Configuration" },
    { tab: "rules", icon: Terminal, label: "Hard Limits" },
    { tab: "ai", icon: ShieldCheck, label: "AI & Automations" },
    { tab: "moderation", icon: ShieldAlert, label: "Moderation Queue" },
    { tab: "analytics", icon: BarChart3, label: "Metrics & Logs" },
    { tab: "reports", icon: FileText, label: "AI Intel Reports" },
    { tab: "assistant", icon: Sparkles, label: "Copilot", accent: true },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Dashboard Layout Container ────────────────────────────────────── */}
      <div className="mx-auto flex h-full max-w-[1300px] flex-col lg:flex-row lg:items-stretch lg:gap-8 px-6 lg:px-10 py-8 lg:py-12 selection:bg-primary/20">
         
        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────────── */}
        <aside className="mb-8 lg:mb-0 lg:w-[240px] lg:flex-shrink-0 flex flex-col gap-8 border-b border-border/40 lg:border-b-0 lg:border-r pb-8 lg:pb-0 lg:pr-8">
           <div className="space-y-4">
               <Link href="/dashboard" className="group inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/60 transition-transform group-hover:-translate-x-1 shadow-sm border border-border/40">
                     <ArrowLeft className="h-3 w-3" />
                  </span>
                  Back to Hub
               </Link>

               <div>
                 <h1 className="text-xl font-bold tracking-tight text-foreground line-clamp-2 leading-tight">
                   {section.name}
                 </h1>
                 <p className="mt-1.5 flex items-center gap-2">
                   <Badge className={`px-2 py-0 border text-[9px] uppercase tracking-widest font-bold rounded-lg shadow-sm ${section.status === 'active' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border/60'}`}>
                      {section.status}
                   </Badge>
                   <code className="text-[11px] font-mono text-muted-foreground/80">{section.public_id}</code>
                 </p>
               </div>
           </div>

           {/* Mobile Navigation Row / Desktop Column */}
           <nav className="flex flex-row overflow-x-auto lg:flex-col gap-1.5 hide-scrollbar">
             {nav.map(({ tab, icon, label, accent }) => (
               <div key={tab} className="flex-shrink-0 lg:w-full">
                  <SidebarButton
                    tab={tab}
                    active={activeTab === tab}
                    icon={icon}
                    label={label}
                    onClick={() => setActiveTab(tab)}
                    accent={accent}
                  />
               </div>
             ))}
           </nav>
        </aside>

        {/* ── RIGHT MAIN PANEL ─────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
           
           {/* Saving Toolbar at Top of Main Panel */}
           <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[1rem] bg-card p-3 border border-border/60 shadow-sm animate-in slide-in-from-top-2">
              <div className="px-2 hidden sm:block">
                 <p className="text-[13px] font-medium text-muted-foreground">
                    Modifying <strong className="text-foreground font-semibold">{nav.find(n => n.tab === activeTab)?.label}</strong> preferences.
                 </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  {saveError && <span className="text-[11px] font-bold uppercase tracking-widest text-destructive">{saveError}</span>}
                  {savedAt && !saveError && (
                    <span className="text-[11px] font-bold uppercase tracking-widest text-green-500 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Synced
                    </span>
                  )}
                  <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-[10px] w-full sm:w-auto h-9 font-semibold font-sans tracking-wide">
                     {saving ? "Synchronizing…" : "Save Blueprint"} 
                     {!saving && <Save className="ml-1.5 h-3.5 w-3.5" />}
                  </Button>
              </div>
           </div>

           {/* Tab Content Display */}
           <div className="pb-20">
              {activeTab === "general" && (
                <GeneralTab section={section} editName={editName} setEditName={setEditName} editStatus={editStatus} setEditStatus={setEditStatus} />
              )}
              {activeTab === "rules" && (
                <RulesTab editMaxChars={editMaxChars} setEditMaxChars={setEditMaxChars} editBlacklist={editBlacklist} setEditBlacklist={setEditBlacklist} />
              )}
              {activeTab === "ai" && (
                <AiTab editAiEnabled={editAiEnabled} setEditAiEnabled={setEditAiEnabled} editAiThreshold={editAiThreshold} setEditAiThreshold={setEditAiThreshold} spamGuard={spamGuard} setSpamGuard={setSpamGuard} contextAnalyzer={contextAnalyzer} setContextAnalyzer={setContextAnalyzer} sentimentAnalysis={sentimentAnalysis} setSentimentAnalysis={setSentimentAnalysis} autoActionStrikes={autoActionStrikes} setAutoActionStrikes={setAutoActionStrikes} />
              )}
              {activeTab === "moderation" && (
                <ModerationTab publicId={publicId} />
              )}
              {activeTab === "analytics" && <AnalyticsTab publicId={publicId} />}
              {activeTab === "reports" && <ReportsTab publicId={publicId} />}
              {activeTab === "assistant" && (
                <AssistantTab publicId={publicId} chatMessages={chatMessages} chatInput={chatInput} setChatInput={setChatInput} chatLoading={chatLoading} sendChatMessage={sendChatMessage} />
              )}
           </div>

        </main>
      </div>
    </div>
  );
}
