import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommentSection } from "komently-sdk";
import Comments from "@/components/main-page-comments";
// import "komently-sdk/dist/styles/komently.css";

const features = [
    {
        icon: "◈",
        title: "Universal Integration",
        desc: "A single snippet for any stack. We handle the storage so you can focus on building your community. (Planned)",
    },
    {
        icon: "⌥",
        title: "Modern Threading",
        desc: "Deeply nested, performance-first reply system designed for high-engagement discussions and clarity.",
    },
    {
        icon: "⬡",
        title: "Agentic Moderation",
        desc: "Autonomous AI agents that understand context and nuance, not just banned keywords. (In Development)",
    },
    {
        icon: "⟳",
        title: "Real-time Reactivity",
        desc: "Optimized for speed. Every upvote and reply feels instantaneous across the globe. (Planned)",
    },
    {
        icon: "◻",
        title: "Privacy First",
        desc: "We don't track your users. Minimalist data collection for a cleaner, safer web ecosystem.",
    },
    {
        icon: "⊞",
        title: "Unified Command Center",
        desc: "One place to moderate all your properties with cross-site insights and advanced tools. (Planned)",
    },
];

const stats = [
    { value: "0ms", label: "Cold start (Target)" },
    { value: "99.9%", label: "Desired Uptime" },
    { value: "∞", label: "Scalable Core" },
];

export default function HomePage() {
    return (
        <div className="overflow-hidden">
            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="relative mx-auto max-w-6xl px-6 pb-32 pt-32 lg:pt-48">

                <div className="grid items-center gap-16 lg:grid-cols-2">
                    <div className="text-left">
                        <Badge variant="outline" className="reveal mb-6 border-primary/20 bg-primary/5 text-primary px-3 py-1">
                            Building the next generation of web discussions
                        </Badge>

                        <h1 className="reveal reveal-delay-1 mb-6 text-5xl font-bold tracking-tighter sm:text-7xl">
                            Comments, <br />
                            <span className="text-primary italic font-serif">Reimagined.</span>
                        </h1>

                        <p className="reveal reveal-delay-2 mb-10 text-lg leading-relaxed text-muted-foreground max-w-lg">
                            Stop building boring backend infrastructure. Komently provides a scalable,
                            AI-ready comment engine designed for modern builders and high-speed platforms.
                        </p>

                        <div className="reveal reveal-delay-3 flex flex-wrap gap-4">
                            <Button asChild size="lg" className="rounded-2xl px-8 shadow-[0_0_20px_var(--mra-shadow-primary-hover)] transition-all hover:-translate-y-1 hover:shadow-[0_0_30px_var(--mra-shadow-primary-hover)]">
                                <Link href="/dashboard" id="hero-cta-primary">Launch Dashboard</Link>
                            </Button>
                            <Button asChild size="lg" variant="outline" className="rounded-2xl px-8 bg-black/40 border-white/10 hover:bg-white/5 transition-transform hover:-translate-y-1">
                                <Link href="/docs" id="hero-cta-secondary">Documentation</Link>
                            </Button>
                        </div>
                    </div>

                    {/* Unique Hero Fold: Interactive-looking preview stack */}
                    <div className="reveal reveal-delay-4 relative hidden lg:block">
                        <div className="relative z-10 scale-100 rounded-[2rem] border border-border bg-card p-8 shadow-sm">
                            <div className="mb-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-primary animate-pulse" />
                                    <div className="h-2 w-32 rounded-full bg-muted/80" />
                                </div>
                                <div className="size-6 rounded-full bg-muted/80" />
                            </div>
                            <div className="space-y-4">
                                <div className="h-3 w-full rounded-md bg-muted/60" />
                                <div className="h-3 w-[85%] rounded-md bg-muted/60" />
                                <div className="pt-4 flex gap-3">
                                    <div className="h-6 w-16 rounded-full bg-primary/10 border border-primary/20" />
                                    <div className="h-6 w-16 rounded-full bg-muted" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hero Bottom Stats */}
                <div className="reveal reveal-delay-4 mt-24 flex flex-wrap justify-between gap-8 border-t border-border pt-12">
                    {stats.map((s) => (
                        <div key={s.label}>
                            <div className="font-mono text-3xl font-bold tracking-tighter text-foreground">
                                {s.value}
                            </div>
                            <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FEATURES ──────────────────────────────────────── */}
            <section className="pb-24 pt-24">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="mb-24 text-center lg:text-left">
                        <p className="label-mono mb-4 text-primary">The Vision</p>
                        <h2 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
                            Scalable. Secure. Autonomous.
                        </h2>
                    </div>

                    <div className="grid gap-x-12 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
                        {features.map((f) => (
                            <div
                                key={f.title}
                                className="group flex flex-col items-start text-left"
                            >
                                <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-xl text-primary">
                                    {f.icon}
                                </div>
                                <h3 className="mb-2 text-lg font-bold text-foreground tracking-tight">{f.title}</h3>
                                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <hr className="border-border" />

            {/* ── DEMO ──────────────────────────────────────────── */}
            <section className="mx-auto max-w-4xl px-6 py-24">
                <div className="mb-12 text-center lg:text-left flex flex-col justify-start">
                    <p className="label-mono text-primary mb-4">Sandbox Preview</p>
                    <h2 className="mb-6 text-4xl font-bold tracking-tight">
                        Interface Experience
                    </h2>
                    <p className="text-[15px] text-muted-foreground max-w-xl leading-relaxed">
                        A functional preview of the Komently interface components. This simulation runs on local mock data.
                    </p>
                </div>
                <div className="py-2">
                    <Comments

                    />
                </div>
            </section>

            {/* ── CTA ───────────────────────────────────────────── */}
            <section className="bg-muted py-32 text-center">
                <div className="mx-auto max-w-2xl px-6">
                    <h2 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
                        Join the evolution.
                    </h2>
                    <p className="mb-12 text-lg leading-relaxed text-muted-foreground">
                        Sign up for the dashboard to manage your upcoming properties and stay updated on our AI roadmap.
                    </p>
                    <Button asChild size="lg" className="rounded-2xl px-12 h-14 text-lg transition-transform hover:-translate-y-1">
                        <Link href="/dashboard" id="bottom-cta">Get Started Free</Link>
                    </Button>
                </div>
            </section>
        </div>
    );
}