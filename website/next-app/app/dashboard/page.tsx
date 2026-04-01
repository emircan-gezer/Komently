"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase/client";
import {
  MessageSquare,
  Zap,
  Heart,
  TrendingUp,
  Plus,
  CheckCircle2,
  XCircle,
  LogOut,
  Settings,
  ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  public_id: string;
  name: string;
  status: "active" | "paused";
  created_at: string;
  commentCount: number;
  reactionCount: number;
  lastActive: string | null;
}

interface Stats {
  totalComments: number;
  activeSections: number;
  totalReactions: number;
  newThisWeek: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

// ── CreateSectionModal ────────────────────────────────────────────────────────

function CreateSectionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [publicId, setPublicId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPublicId(
      name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
    );
  }, [name]);

  async function handleCreate() {
    const trimName = name.trim();
    const trimId = publicId.trim();
    if (!trimName || !trimId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimName, publicId: trimId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to create section");
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-[1.5rem] border border-border/60 bg-card p-7 shadow-2xl">
        <h2 className="mb-1 text-lg font-bold tracking-tight">New Comment Section</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Create a new managed discussion thread for your project.
        </p>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Display Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Product Blog"
              autoFocus
              className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Public ID
            </label>
            <input
              value={publicId}
              onChange={(e) =>
                setPublicId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="product-blog"
              className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground/60">
              Used in the embed snippet — lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="mt-7 flex justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={loading || !name.trim() || !publicId.trim()}
            className="rounded-xl px-5"
          >
            {loading ? "Creating…" : "Create Section"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/60 bg-card p-5 transition-colors hover:bg-card/80">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `color-mix(in srgb, ${accent ?? "var(--color-primary)"} 12%, transparent)` }}
      >
        <Icon
          className="h-4.5 w-4.5"
          style={{ color: accent ?? "var(--color-primary)" }}
        />
      </div>
      <div>
        <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
          {value}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// ── DashboardPage ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent("/dashboard")}`);
        return;
      }
      setUserEmail(user.email ?? null);
      setAuthChecked(true);
    });
  }, [router]);

  // ── Data loading ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sections");
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent("/dashboard")}`);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSections(data.sections ?? []);
        setStats(data.stats ?? null);
      }
    } catch (e) {
      console.error("Failed to load dashboard", e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, load]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const displayStats = stats
    ? [
        { icon: MessageSquare, label: "Total Comments", value: stats.totalComments.toLocaleString() },
        { icon: Zap, label: "Active Sections", value: stats.activeSections.toLocaleString() },
        { icon: Heart, label: "Total Reactions", value: stats.totalReactions.toLocaleString() },
        { icon: TrendingUp, label: "New This Week", value: stats.newThisWeek.toLocaleString() },
      ]
    : null;

  const filteredSections =
    filter === "all" ? sections : sections.filter((s) => s.status === filter);

  return (
    <>
      {showModal && (
        <CreateSectionModal onClose={() => setShowModal(false)} onCreated={load} />
      )}

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            {userEmail && (
              <p className="mt-0.5 text-sm text-muted-foreground">{userEmail}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              className="rounded-xl gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> New Section
            </Button>
          </div>
        </div>

        {/* ── Stats grid ──────────────────────────────────────────────────── */}
        {stats ? (
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {displayStats!.map((s) => (
              <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} />
            ))}
          </div>
        ) : (
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array(4).fill(null).map((_, i) => (
              <div key={i} className="rounded-[1.25rem] border border-border/60 bg-card p-5 space-y-3">
                <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-6 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Sections table ───────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-[1.25rem] border border-border/60 bg-card">
          {/* Table sub-header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-5 py-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Comment Sections
            </span>
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
              {(["all", "active", "paused"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    filter === f
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Column headings */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-border/40 bg-muted/10 px-5 py-2.5">
            {["Section", "Comments", "Reactions", "Status", "Last Active"].map((col) => (
              <span
                key={col}
                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70"
              >
                {col}
              </span>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            Array(3).fill(null).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border/40 px-5 py-3.5 last:border-0"
              >
                <div className="space-y-1.5">
                  <div className="h-4 w-36 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-4 w-10 rounded bg-muted animate-pulse" />
                <div className="h-4 w-10 rounded bg-muted animate-pulse" />
                <div className="h-5 w-14 rounded bg-muted animate-pulse" />
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              </div>
            ))
          ) : filteredSections.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {filter === "all" ? (
                  <>
                    No sections yet.{" "}
                    <button
                      onClick={() => setShowModal(true)}
                      className="font-semibold text-primary underline underline-offset-2"
                    >
                      Create your first one →
                    </button>
                  </>
                ) : (
                  `No ${filter} sections.`
                )}
              </p>
            </div>
          ) : (
            filteredSections.map((section) => (
              <div
                key={section.id}
                className="group grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border/40 px-5 py-3 last:border-0 transition-colors hover:bg-muted/10"
              >
                {/* Name */}
                <Link href={`/dashboard/${section.public_id}`} className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                    {section.name}
                  </span>
                  <span className="mt-0.5 font-mono text-xs text-muted-foreground/60">
                    {section.public_id}
                  </span>
                </Link>

                {/* Comment count */}
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {section.commentCount.toLocaleString()}
                </span>

                {/* Reaction count */}
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {section.reactionCount.toLocaleString()}
                </span>

                {/* Status */}
                <Badge
                  variant={section.status === "active" ? "default" : "secondary"}
                  className={
                    section.status === "active"
                      ? "rounded-full bg-primary/10 border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider"
                      : "rounded-full text-[10px] font-bold uppercase tracking-wider"
                  }
                >
                  {section.status === "active" ? (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  ) : (
                    <XCircle className="mr-1 h-3 w-3" />
                  )}
                  {section.status}
                </Badge>

                {/* Last active + actions */}
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {timeAgo(section.lastActive)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/dashboard/${section.public_id}`}
                      className="flex items-center gap-1 rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      <Settings className="h-3 w-3" /> Manage
                    </Link>
                    <a
                      href={`/api/comments/${section.public_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center rounded-lg border border-border/60 bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Footer hint ──────────────────────────────────────────────────── */}
        {sections.length > 0 && (
          <p className="mt-4 text-center text-[11px] text-muted-foreground/50">
            {sections.length} section{sections.length > 1 ? "s" : ""} total •{" "}
            {sections.filter((s) => s.status === "active").length} active
          </p>
        )}
      </div>
    </>
  );
}