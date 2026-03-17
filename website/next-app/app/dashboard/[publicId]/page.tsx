"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@supabase/supabase-js";
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
    LayoutDashboard,
    Sparkles,
    Send,
    Bot,
    User,
} from "lucide-react";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

interface SectionSettings {
    max_chars: number;
    blacklist: string[];
    ai_moderation_enabled: boolean;
    ai_toxicity_threshold: number;
}

interface Section {
    id: string;
    public_id: string;
    name: string;
    status: "active" | "paused";
    settings: SectionSettings;
    created_at: string;
}

export default function SectionDashboardPage({ params }: { params: Promise<{ publicId: string }> }) {
    const { publicId } = use(params);
    const router = useRouter();
    const [section, setSection] = useState<Section | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"general" | "rules" | "ai" | "analytics" | "assistant">("general");

    // AI chat state
    const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);

    // Editable state
    const [editName, setEditName] = useState("");
    const [editStatus, setEditStatus] = useState<"active" | "paused">("active");
    const [editMaxChars, setEditMaxChars] = useState(5000);
    const [editBlacklist, setEditBlacklist] = useState("");
    const [editAiEnabled, setEditAiEnabled] = useState(true);
    const [editAiThreshold, setEditAiThreshold] = useState(0.8);

    const loadSection = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sections/${publicId}`);
            if (res.ok) {
                const data = await res.json();
                const s = data.section;
                setSection(s);
                setEditName(s.name);
                setEditStatus(s.status);
                setEditMaxChars(s.settings?.max_chars ?? 5000);
                setEditBlacklist((s.settings?.blacklist ?? []).join(", "));
                setEditAiEnabled(s.settings?.ai_moderation_enabled ?? true);
                setEditAiThreshold(s.settings?.ai_toxicity_threshold ?? 0.8);
            } else {
                router.push("/dashboard");
            }
        } catch (e) {
            console.error("Failed to load section", e);
        } finally {
            setLoading(false);
        }
    }, [publicId, router]);

    useEffect(() => { loadSection(); }, [loadSection]);

    const sendChatMessage = useCallback(async () => {
        if (!chatInput.trim() || chatLoading) return;
        const userMsg = chatInput.trim();
        setChatInput("");
        setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setChatLoading(true);
        try {
            const res = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sectionPublicId: publicId,
                    message: userMsg,
                    history: chatMessages.slice(-10),
                }),
            });
            if (res.ok) {
                const data = await res.json();
                let reply = data.reply || "No response from agent.";
                if (data.actions_taken?.length > 0) {
                    reply += "\n\n✅ Actions: " + data.actions_taken.join(", ");
                }
                setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);
            } else {
                setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
            }
        } catch {
            setChatMessages(prev => [...prev, { role: "assistant", content: "Could not reach the AI service. Is it running?" }]);
        } finally {
            setChatLoading(false);
        }
    }, [chatInput, chatLoading, chatMessages, publicId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/sections/${publicId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName,
                    status: editStatus,
                    settings: {
                        max_chars: editMaxChars,
                        blacklist: editBlacklist.split(",").map(s => s.trim()).filter(Boolean),
                        ai_moderation_enabled: editAiEnabled,
                        ai_toxicity_threshold: editAiThreshold
                    }
                })
            });
            if (res.ok) {
                const data = await res.json();
                setSection(data.section);
                // Success feedback? maybe a toast if available
            }
        } catch (e) {
            console.error("Save failed", e);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="label-mono text-sm opacity-50">Initializing Dashboard...</p>
                </div>
            </div>
        );
    }

    if (!section) return null;

    return (
        <div className="mx-auto max-w-[1200px] px-6 py-12 selection:bg-primary/20">
            {/* Header */}
            <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                    <Link href="/dashboard" className="group mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Back to Overview
                    </Link>
                    <div className="flex items-center gap-4">
                        <h1 className="text-4xl font-bold tracking-tight">{section.name}</h1>
                        <Badge variant={section.status === "active" ? "default" : "secondary"} className="rounded-full px-3 py-1">
                            {section.status}
                        </Badge>
                    </div>
                    <p className="mt-2 text-muted-foreground flex items-center gap-2">
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border border-border/50">{section.public_id}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <span className="text-xs">Created {new Date(section.created_at).toLocaleDateString()}</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" size="lg" className="rounded-2xl gap-2" asChild>
                        <Link href={`/api/comments/${section.public_id}`} target="_blank">
                            <ExternalLink className="h-4 w-4" /> View API
                        </Link>
                    </Button>
                    <Button size="lg" className="rounded-2xl gap-2 px-8" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : <><Save className="h-4 w-4" /> Save Changes</>}
                    </Button>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[240px,1fr]">
                {/* Sidebar Navigation */}
                <aside className="flex flex-col gap-2">
                    <button
                        onClick={() => setActiveTab("general")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "general" ? "bg-primary/10 text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:bg-muted/50"}`}
                    >
                        <Settings className="h-4 w-4" /> General Settings
                    </button>
                    <button
                        onClick={() => setActiveTab("rules")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "rules" ? "bg-primary/10 text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:bg-muted/50"}`}
                    >
                        <Terminal className="h-4 w-4" /> Logic & Rules
                    </button>
                    <button
                        onClick={() => setActiveTab("ai")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "ai" ? "bg-primary/10 text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:bg-muted/50"}`}
                    >
                        <ShieldCheck className="h-4 w-4" /> AI Moderation
                    </button>
                    <button
                        onClick={() => setActiveTab("analytics")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "analytics" ? "bg-primary/10 text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:bg-muted/50"}`}
                    >
                        <BarChart3 className="h-4 w-4" /> Analytics
                    </button>
                    <div className="my-2 border-t border-border/30" />
                    <button
                        onClick={() => setActiveTab("assistant")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "assistant" ? "bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 text-violet-500 shadow-sm border border-violet-500/20" : "text-muted-foreground hover:bg-muted/50"}`}
                    >
                        <Sparkles className="h-4 w-4" /> AI Assistant
                    </button>
                </aside>

                {/* Main Content Area */}
                <main className="space-y-6">
                    {/* General Settings */}
                    {activeTab === "general" && (
                        <div className="space-y-6">
                            <Card className="rounded-[2rem] border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden border">
                                <CardHeader className="p-8">
                                    <CardTitle>Basic Configuration</CardTitle>
                                    <CardDescription>Update your comment section identity and operational status.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 pt-0 space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Display Name</Label>
                                        <Input
                                            id="name"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="rounded-xl bg-background/50 h-12"
                                        />
                                        <p className="text-xs text-muted-foreground">This is for your internal tracking in the dashboard.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Operational Status</Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => setEditStatus("active")}
                                                className={`flex flex-col items-start gap-1 p-4 rounded-2xl border transition-all text-left ${editStatus === "active" ? "bg-primary/5 border-primary/50 ring-1 ring-primary/20" : "bg-background/20 border-border/50 hover:bg-muted/30"}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className={`h-4 w-4 ${editStatus === "active" ? "text-primary" : "text-muted-foreground"}`} />
                                                    <span className="font-bold text-sm">Active</span>
                                                </div>
                                                <span className="text-[11px] text-muted-foreground">Comments are open and being moderated.</span>
                                            </button>
                                            <button
                                                onClick={() => setEditStatus("paused")}
                                                className={`flex flex-col items-start gap-1 p-4 rounded-2xl border transition-all text-left ${editStatus === "paused" ? "bg-destructive/5 border-destructive/50 ring-1 ring-destructive/20" : "bg-background/20 border-border/50 hover:bg-muted/30"}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <XCircle className={`h-4 w-4 ${editStatus === "paused" ? "text-destructive" : "text-muted-foreground"}`} />
                                                    <span className="font-bold text-sm">Paused</span>
                                                </div>
                                                <span className="text-[11px] text-muted-foreground">New comments are disabled across your site.</span>
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Rules & Logic */}
                    {activeTab === "rules" && (
                        <div className="space-y-6">
                            <Card className="rounded-[2rem] border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden border">
                                <CardHeader className="p-8">
                                    <CardTitle>Content Restrictions</CardTitle>
                                    <CardDescription>Define the boundaries for user-generated content in this section.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 pt-0 space-y-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="maxChars" className="text-base">Character Limit</Label>
                                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-primary">{editMaxChars} chars</span>
                                        </div>
                                        <Input
                                            id="maxChars"
                                            type="number"
                                            value={editMaxChars}
                                            onChange={(e) => setEditMaxChars(parseInt(e.target.value))}
                                            className="rounded-xl bg-background/50 h-12 font-mono"
                                        />
                                        <p className="text-[11px] text-muted-foreground italic flex items-center gap-2">
                                            <Info className="h-3 w-3" /> Minimum 1, Maximum 10,000 recommended.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <Label htmlFor="blacklist" className="text-base">Keyword Blacklist</Label>
                                        <Textarea
                                            id="blacklist"
                                            value={editBlacklist}
                                            onChange={(e) => setEditBlacklist(e.target.value)}
                                            placeholder="Enter keywords separated by commas..."
                                            className="rounded-xl bg-background/50 min-h-[140px] resize-none p-4"
                                        />
                                        <p className="text-xs text-muted-foreground">Any comment containing these words will be rejected immediately before AI analysis.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* AI Moderation */}
                    {activeTab === "ai" && (
                        <div className="space-y-6">
                            <Card className="rounded-[2rem] border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden border">
                                <CardHeader className="p-8">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>AI Moderation Engine</CardTitle>
                                            <CardDescription>Control how the AI Moderator agents treat your community discourse.</CardDescription>
                                        </div>
                                        <button
                                            onClick={() => setEditAiEnabled(!editAiEnabled)}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${editAiEnabled ? "bg-primary" : "bg-muted"}`}
                                        >
                                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${editAiEnabled ? "translate-x-7" : "translate-x-1"}`} />
                                        </button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-8 pt-0 space-y-10">
                                    <div className={`space-y-8 transition-opacity ${editAiEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-base">Toxicity Sensitivity</Label>
                                                <span className="font-mono text-sm font-bold text-primary">{(editAiThreshold * 100).toFixed(0)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.1"
                                                max="0.9"
                                                step="0.05"
                                                value={editAiThreshold}
                                                onChange={(e) => setEditAiThreshold(parseFloat(e.target.value))}
                                                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                                            />
                                            <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                                                <span>Lenient</span>
                                                <span>Standard (0.8)</span>
                                                <span>Strict</span>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex gap-4">
                                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                    <ShieldCheck className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold mb-1">Impact Analysis</p>
                                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                        With a threshold of <strong>{editAiThreshold}</strong>, the AI will likely flag comments that
                                                        {editAiThreshold < 0.3 ? " exhibit any mild negativity." :
                                                            editAiThreshold < 0.7 ? " are clearly hostile or toxic." :
                                                                " contain severe hate speech or harassment only."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="p-5 rounded-2xl border border-border/50 bg-background/20 space-y-2">
                                                <p className="text-xs font-bold">Spam Guard</p>
                                                <p className="text-[11px] text-muted-foreground">Automatically identifies and flags commercial solicitation and bot patterns.</p>
                                                <Badge variant="outline" className="text-[10px] uppercase font-mono bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
                                            </div>
                                            <div className="p-5 rounded-2xl border border-border/50 bg-background/20 space-y-2">
                                                <p className="text-xs font-bold">Context Analyzer</p>
                                                <p className="text-[11px] text-muted-foreground">Uses GPT-4o mini to ensure replies remain relevant to the parent thread.</p>
                                                <Badge variant="outline" className="text-[10px] uppercase font-mono text-muted-foreground">Coming Soon</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Analytics Placeholder */}
                    {activeTab === "analytics" && (
                        <div className="space-y-6">
                            <Card className="rounded-[2rem] border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden border min-h-[400px] flex items-center justify-center">
                                <div className="text-center p-8">
                                    <div className="mx-auto size-16 rounded-[1.5rem] bg-muted/50 flex items-center justify-center mb-6">
                                        <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Advanced Insights</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                        Visual analytics for engagement and moderation trends for this specific section are under construction.
                                    </p>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* AI Assistant Chat */}
                    {activeTab === "assistant" && (
                        <div className="">
                            <Card className="rounded-[2rem] border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden border flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
                                {/* Chat Header */}
                                <div className="px-8 py-5 border-b border-border/40 bg-background/50">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-xl bg-primary flex items-center justify-center">
                                            <Bot className="h-5 w-5 text-primary-foreground" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold">AI Assistant</h3>
                                            <p className="text-[11px] text-muted-foreground">Manage your comment section with natural language</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                                    {chatMessages.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                                            <div className="size-16 rounded-[1.5rem] bg-muted flex items-center justify-center">
                                                <Sparkles className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold mb-1">Start a conversation</h4>
                                                <p className="text-xs text-muted-foreground max-w-sm">
                                                    Ask me to manage comments, change settings, or analyze your section. Try:
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 justify-center max-w-md">
                                                {[
                                                    "What are my current settings?",
                                                    "Flag all comments with links",
                                                    "Set toxicity threshold to 0.5",
                                                    "Show me recent flagged comments",
                                                ].map((suggestion) => (
                                                    <button
                                                        key={suggestion}
                                                        onClick={() => {
                                                            setChatInput(suggestion);
                                                        }}
                                                        className="text-[11px] px-3 py-1.5 rounded-full border border-border bg-background text-foreground hover:bg-muted transition-colors"
                                                    >
                                                        {suggestion}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {chatMessages.map((msg, i) => (
                                        <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                            {msg.role === "assistant" && (
                                                <div className="size-7 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-0.5">
                                                    <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                                                </div>
                                            )}
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                                                    msg.role === "user"
                                                        ? "bg-primary text-primary-foreground rounded-br-md"
                                                        : "bg-muted/50 border border-border/50 rounded-bl-md"
                                                }`}
                                            >
                                                {msg.content}
                                            </div>
                                            {msg.role === "user" && (
                                                <div className="size-7 rounded-lg bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                                                    <User className="h-3.5 w-3.5 text-foreground/60" />
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {chatLoading && (
                                        <div className="flex gap-3">
                                            <div className="size-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                                                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                                            </div>
                                            <div className="bg-muted/50 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                                                <div className="flex gap-1">
                                                    <span className="size-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                                                    <span className="size-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                                                    <span className="size-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Chat Input */}
                                <div className="px-6 py-4 border-t border-border/40 bg-background/50">
                                    <div className="flex gap-3">
                                        <input
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                                            placeholder="Ask your AI assistant..."
                                            className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                                        />
                                        <Button
                                            onClick={sendChatMessage}
                                            disabled={chatLoading || !chatInput.trim()}
                                            className="rounded-xl px-4 bg-primary text-primary-foreground"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
