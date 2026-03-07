import Link from "next/link";
import { Button } from "@/components/ui/button";
import Comments from "@/components/main-page-comments";
import Image from "next/image";
import { cn } from "@/lib/utils";

const features = [
    {
        title: "Universal Integration",
        desc: "A single snippet for any stack. We handle the storage so you can focus on building your community.",
    },
    {
        title: "Modern Threading",
        desc: "Deeply nested, performance-first reply system designed for high-engagement discussions.",
    },
    {
        title: "Agentic Moderation",
        desc: "Autonomous AI agents that understand context and nuance, not just banned keywords.",
    },
    {
        title: "Real-time Reactivity",
        desc: "Optimized for speed. Every upvote and reply feels instantaneous across the globe.",
    },
    {
        title: "Privacy First",
        desc: "We don't track your users. Minimalist data collection for a cleaner, safer web ecosystem.",
    },
    {
        title: "Unified Command Center",
        desc: "One place to moderate all your properties with cross-site insights.",
    },
];

const stats = [
    { value: "0ms", label: "Latency" },
    { value: "99.9%", label: "Uptime" },
    { value: "Cloud Native", label: "Infrastructure" },
    { value: "SLA Guaranteed", label: "Reliability" },
];

export default function HomePage() {
    return (
        <div className="bg-background text-foreground selection:bg-primary/20">
            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="mx-auto max-w-[1200px] px-6 pb-24 pt-32 lg:pb-40 lg:pt-56">
                <div className="flex flex-col items-center">
                    <div className="mb-12 text-center">
                        <span className="mb-8 block text-[11px] font-bold uppercase tracking-[0.3em] text-primary">
                            The Future of Discussions
                        </span>

                        <h1 className="mb-12 max-w-5xl text-7xl font-bold tracking-[-0.05em] sm:text-9xl lg:text-[11rem] leading-[0.8] transition-all">
                            Comments <br />
                            <span className="opacity-10">Simplified.</span>
                        </h1>

                        <p className="mb-16 mx-auto max-w-xl text-xl leading-relaxed text-muted-foreground/90 font-light">
                            Stop building boring backend infrastructure. <br className="hidden sm:block" />
                            Komently is the high-performance comment engine <br className="hidden sm:block" />
                            built for modern digital platforms.
                        </p>

                        <div className="flex flex-wrap justify-center gap-6">
                            <Button asChild size="lg" className="rounded-2xl px-12 h-16 text-lg shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-transform">
                                <Link href="/dashboard" id="hero-cta-primary">Launch Project</Link>
                            </Button>
                            <Button asChild size="lg" variant="outline" className="rounded-2xl px-12 h-16 text-lg border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all">
                                <Link href="/docs" id="hero-cta-secondary">Documentation</Link>
                            </Button>
                        </div>
                    </div>

                    <div className="mt-40 w-full max-w-5xl border-y border-white/5 py-14">
                        <div className="grid grid-cols-2 gap-12 md:grid-cols-4">
                            {stats.map((s) => (
                                <div key={s.label} className="text-center group overflow-hidden">
                                    <div className="text-3xl font-bold tracking-tighter text-foreground mb-1 group-hover:scale-110 transition-transform duration-500">{s.value}</div>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40 font-bold">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── INTERFACE PREVIEW ─────────────────────────────── */}
            <section className="py-24 border-t border-white/5 bg-neutral-900/10">
                <div className="mx-auto max-w-[1240px] px-6">
                    <div className="mb-20">
                        <span className="mb-4 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">
                            SDK Experience
                        </span>
                        <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Live Sandbox</h2>
                    </div>

                    <div className="overflow-hidden rounded-[3rem] border border-white/5 bg-neutral-900/40 shadow-2xl">
                        <div className="p-8 md:p-20">
                            <div className="mb-16 grid gap-12 lg:grid-cols-[1fr,1.5fr]">
                                <div>
                                    <h3 className="text-2xl font-bold tracking-tight mb-4 text-foreground">Interactive Components</h3>
                                    <p className="text-muted-foreground text-lg leading-relaxed font-light">
                                        Experience the core component of our SDK.
                                        A highly optimized, performant discussion
                                        engine ready for any scale.
                                    </p>
                                </div>
                                <Comments />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FEATURES ──────────────────────────────────────── */}
            <section className="py-48 border-t border-white/5">
                <div className="mx-auto max-w-[1200px] px-6">
                    <div className="mb-32">
                        <span className="mb-4 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">
                            Core Pillars
                        </span>
                        <h2 className="text-6xl font-bold tracking-tighter text-foreground sm:text-8xl leading-[0.9]">
                            Designed for <br />
                            <span className="opacity-20">Unmatched Quality.</span>
                        </h2>
                    </div>

                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {features.map((f) => (
                            <div
                                key={f.title}
                                className="group flex flex-col items-start rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-12 transition-all hover:bg-neutral-900/40 hover:border-white/10"
                            >
                                <h3 className="mb-6 text-2xl font-bold text-foreground tracking-tight">{f.title}</h3>
                                <p className="text-base leading-relaxed text-muted-foreground/60 font-light">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ───────────────────────────────────────────── */}
            <section className="py-48 border-t border-white/5 bg-primary/5">
                <div className="mx-auto max-w-4xl px-6 text-center">
                    <h2 className="mb-12 text-7xl font-bold tracking-tighter sm:text-[9rem] leading-[0.8] transition-all">
                        Start the <br />
                        <span className="text-primary italic opacity-90 transition-all hover:opacity-100">Evolution.</span>
                    </h2>
                    <p className="mx-auto mb-16 max-w-lg text-xl leading-relaxed text-muted-foreground/80 font-light">
                        Ship your next platform with the confidence of a managed comment infrastructure.
                    </p>
                    <div className="flex flex-wrap justify-center gap-6">
                        <Button asChild size="lg" className="rounded-2xl px-14 h-16 text-lg shadow-xl shadow-primary/10">
                            <Link href="/dashboard" id="bottom-cta">Deploy Now</Link>
                        </Button>
                        <Button asChild size="lg" variant="ghost" className="rounded-2xl px-14 h-16 text-lg hover:bg-white/5">
                            <Link href="/login">Dashboard Login</Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ────────────────────────────────────────── */}
            <footer className="py-24 border-t border-white/5 bg-neutral-900/30">
                <div className="mx-auto max-w-[1240px] px-6">
                    <div className="flex flex-col items-center justify-between gap-16 md:flex-row">
                        <Link href="/" className="flex items-center gap-4 opacity-50 hover:opacity-100 transition-all active:scale-95">
                            <Image
                                src="/KomentlyLogo.svg"
                                alt="Komently logo"
                                width={28}
                                height={28}
                                className="invert"
                            />
                            <span className="text-xl font-bold tracking-tighter">Komently</span>
                        </Link>

                        <div className="flex flex-wrap justify-center gap-12">
                            {["API", "App", "Docs", "Status"].map((link) => (
                                <Link key={link} href="#" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-primary transition-colors">{link}</Link>
                            ))}
                        </div>

                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/20">
                            © 2026 Komently
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}