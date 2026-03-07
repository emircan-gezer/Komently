"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@supabase/supabase-js";

// ── Supabase browser client (anon key — only reads authed owner's data) ───────
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

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

    // Auto-slug the name
    useEffect(() => {
        setPublicId(
            name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
        );
    }, [name]);

    async function handleCreate() {
        if (!name.trim() || !publicId.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/sections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), publicId: publicId.trim() }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? "Failed to create section");
            }
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                <h2 className="mb-5 text-base font-bold tracking-tight">New Comment Section</h2>

                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Name
                        </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Product Blog"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Public ID
                        </label>
                        <input
                            value={publicId}
                            onChange={(e) => setPublicId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                            placeholder="product-blog"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground/50">
                            Used in the embed URL — lowercase, hyphens only.
                        </p>
                    </div>

                    {error && <p className="text-[12px] text-destructive">{error}</p>}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleCreate}
                        disabled={loading || !name.trim() || !publicId.trim()}
                    >
                        {loading ? "Creating…" : "Create Section"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── DashboardPage ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [sections, setSections] = useState<Section[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/sections");
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
    }, []);

    useEffect(() => { load(); }, [load]);

    const displayStats = stats
        ? [
            { label: "Total Comments", value: stats.totalComments.toLocaleString() },
            { label: "Active Sections", value: stats.activeSections.toLocaleString() },
            { label: "Total Reactions", value: stats.totalReactions.toLocaleString() },
            { label: "New This Week", value: stats.newThisWeek.toLocaleString() },
        ]
        : Array(4).fill(null);

    return (
        <>
            {showModal && (
                <CreateSectionModal
                    onClose={() => setShowModal(false)}
                    onCreated={load}
                />
            )}

            <div className="mx-auto max-w-6xl px-6 py-12">
                {/* Header */}
                <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Manage your comment sections and monitor engagement
                        </p>
                    </div>
                    <Button size="sm" onClick={() => setShowModal(true)}>
                        + Create Section
                    </Button>
                </div>

                {/* Stats grid */}
                <div
                    className="mb-8 overflow-hidden rounded-xl border border-border"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: "1px",
                        background: "var(--border)",
                    }}
                >
                    {displayStats.map((stat, i) => (
                        <div key={i} className="bg-card px-5 py-6">
                            {stat ? (
                                <>
                                    <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
                                        {stat.value}
                                    </div>
                                    <div className="mt-1.5 text-xs text-muted-foreground">{stat.label}</div>
                                </>
                            ) : (
                                <>
                                    <div className="h-7 w-20 rounded bg-muted animate-pulse mb-2" />
                                    <div className="h-3 w-28 rounded bg-muted animate-pulse" />
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* Sections table */}
                <div className="overflow-hidden rounded-xl border border-border">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border bg-muted px-5 py-3">
                        {["Section", "Comments", "Status", "Last Active"].map((col) => (
                            <span key={col} className="label-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                {col}
                            </span>
                        ))}
                    </div>

                    {loading ? (
                        Array(3).fill(null).map((_, i) => (
                            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border/50 bg-card px-5 py-4 last:border-0">
                                <div className="space-y-1.5">
                                    <div className="h-4 w-36 rounded bg-muted animate-pulse" />
                                    <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                                </div>
                                <div className="h-4 w-10 rounded bg-muted animate-pulse" />
                                <div className="h-5 w-14 rounded bg-muted animate-pulse" />
                                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                            </div>
                        ))
                    ) : sections.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                            No sections yet.{" "}
                            <button
                                onClick={() => setShowModal(true)}
                                className="font-medium text-primary underline underline-offset-2"
                            >
                                Create your first one →
                            </button>
                        </div>
                    ) : (
                        sections.map((section) => (
                            <div
                                key={section.id}
                                className="group grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border/50 bg-card px-5 py-4 last:border-0 transition-colors hover:bg-muted/30"
                            >
                                {/* Name */}
                                <Link
                                    href={`/dashboard/${section.public_id}`}
                                    className="flex flex-col items-start"
                                >
                                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                        {section.name}
                                    </div>
                                    <div className="mt-0.5 font-mono text-xs text-muted-foreground/60">
                                        {section.public_id}
                                    </div>
                                </Link>

                                {/* Count */}
                                <div className="font-mono text-sm text-muted-foreground">
                                    {section.commentCount.toLocaleString()}
                                </div>

                                {/* Status */}
                                <div>
                                    <Badge
                                        variant={section.status === "active" ? "default" : "secondary"}
                                        className={
                                            section.status === "active"
                                                ? "bg-primary/10 text-primary border-primary/30"
                                                : ""
                                        }
                                    >
                                        {section.status}
                                    </Badge>
                                </div>

                                {/* Last active + Manage link */}
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-xs text-muted-foreground mr-4">
                                        {timeAgo(section.lastActive)}
                                    </span>
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="sm"
                                        className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Link href={`/dashboard/${section.public_id}`}>
                                            Manage
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}