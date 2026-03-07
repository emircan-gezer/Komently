"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DocsPage() {
    return (
        <div className="mx-auto max-w-3xl px-6 pb-24 pt-12">

            {/* Header */}
            <div className="mb-14">
                <p className="label-mono mb-3">Documentation</p>
                <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                    Komently Docs
                </h1>
                <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                    Everything you need to integrate a powerful comment system into your website in minutes.
                </p>
            </div>

            {/* TOC */}
            <nav className="mb-12 rounded-xl border border-border bg-muted/30 px-5 py-4">
                <p className="label-mono mb-3 text-primary">On this page</p>
                {["Overview", "Quick Integration", "Commenter Profiles", "API Reference"].map((item, i) => (
                    <a
                        key={item}
                        href={`#section-${i + 1}`}
                        className="block py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <span className="font-mono text-primary/60">{String(i + 1).padStart(2, "0")}</span>
                        {" — "}{item}
                    </a>
                ))}
            </nav>

            <div className="flex flex-col gap-16">

                {/* ── 01 Overview ── */}
                <section id="section-1">
                    <SectionHeading index="01" title="Overview" />
                    <div className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            <strong className="font-semibold text-foreground">Komently</strong> is a modern,
                            embeddable comment engine built with <strong className="text-foreground">Functional Minimalism</strong> and
                            a <strong className="text-foreground">Premium Minimalist</strong> aesthetic.
                            Each section is identified by a unique <InlineCode>publicId</InlineCode>.
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            It handles real-time threading, voting, and commenter identity out of the box, allowing you to focus on your core product.
                        </p>
                    </div>
                </section>

                <hr className="border-border/40" />

                {/* ── 02 Integration ── */}
                <section id="section-2">
                    <SectionHeading index="02" title="Quick Integration" />

                    <p className="mb-4 mt-5 text-sm leading-relaxed text-muted-foreground">
                        Drop the Komently script into your page:
                    </p>
                    <CodeBlock filename="index.html" lang="HTML">
                        {`<!-- Coming Soon: CDN SDK -->
<script src="${process.env.NEXT_PUBLIC_KOMENTLY_BASE_URL}/sdk/komently.js" defer></script>

<div id="komently-container" data-public-id="your-unique-id"></div>`}
                    </CodeBlock>

                    <p className="mb-4 mt-8 text-sm leading-relaxed text-muted-foreground">
                        Or use the native React component:
                    </p>
                    <CodeBlock filename="CommentArea.tsx" lang="tsx">
                        {`import { CommentSection } from "@/components/comment-section";

export default function Page() {
  return (
    <CommentSection 
      publicId="blog-post-42" 
      apiKey="your-api-key"
      baseUrl="${process.env.NEXT_PUBLIC_KOMENTLY_BASE_URL}"
      pageSize={10} 
    />
  );
}`}
                    </CodeBlock>
                </section>

                <hr className="border-border/40" />

                {/* ── 03 Commenters ── */}
                <section id="section-3">
                    <SectionHeading index="03" title="Commenter Profiles" />
                    <p className="mb-4 mt-5 text-sm leading-relaxed text-muted-foreground">
                        Komently provides a built-in authentication flow for commenters. Users can sign in to participate in threaded discussions, upvote high-quality content, and manage their identities.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-border p-4 bg-muted/10">
                            <h4 className="text-sm font-bold mb-1">Persistent Identity</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">Commenters maintain their username and activity across your entire platform.</p>
                        </div>
                        <div className="rounded-xl border border-border p-4 bg-muted/10">
                            <h4 className="text-sm font-bold mb-1">Authenticated Voting</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">Votes are tied to commenter accounts, preventing spam and ensuring data integrity.</p>
                        </div>
                    </div>
                </section>

                <hr className="border-border/40" />

                {/* ── 04 API Reference ── */}
                <section id="section-4">
                    <SectionHeading index="04" title="API Reference" />

                    <div className="mt-5 overflow-hidden rounded-2xl border border-border">
                        <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
                            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary uppercase">
                                GET
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                                /api/comments/<span className="text-muted-foreground/40">{"{publicId}"}</span>
                            </span>
                        </div>
                        <CodeBlock filename="fetch-comments" lang="bash">
                            {`curl ${process.env.NEXT_PUBLIC_KOMENTLY_BASE_URL}/api/comments/demo \\
  -H "x-commenter-token: <your_jwt>"`}
                        </CodeBlock>
                    </div>

                    <p className="mb-4 mt-8 text-sm text-muted-foreground">Response format:</p>
                    <CodeBlock filename="response.json" lang="JSON">
                        {`{
  "comments": [...],
  "totalPages": 5,
  "totalCount": 42,
  "page": 1
}`}
                    </CodeBlock>

                    <div className="mt-8 overflow-hidden rounded-2xl border border-border shadow-sm">
                        <div className="border-b border-border bg-muted/30 px-5 py-3">
                            <span className="label-mono text-primary">Query Parameters</span>
                        </div>
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/10">
                                    {["Param", "Default", "Description"].map((h) => (
                                        <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { param: "pageSize", def: "5", desc: "Comments per page" },
                                    { param: "sorting", def: "top", desc: "Sort: top | new | old" },
                                    { param: "page", def: "1", desc: "Pagination start index" },
                                ].map((row, i, arr) => (
                                    <tr
                                        key={row.param}
                                        className={cn("bg-card", i < arr.length - 1 && "border-b border-border/30")}
                                    >
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <code className="font-mono text-xs text-primary font-bold">{row.param}</code>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.def}</td>
                                        <td className="px-5 py-3 text-xs text-muted-foreground leading-relaxed">{row.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* CTA card */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center sm:text-left">
                    <h3 className="mb-2 text-lg font-bold text-foreground tracking-tight">Ready to deploy?</h3>
                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground max-w-md">
                        Your first property is free forever. Start building your next great community today.
                    </p>
                    <Button asChild className="rounded-2xl px-8 shadow-lg shadow-primary/10">
                        <Link href="/dashboard">Access Dashboard</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}

/* ── Sub-components ─────────────────────────────────────────── */

function SectionHeading({ index, title }: { index: string; title: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-primary">{index}</span>
            <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        </div>
    );
}

function InlineCode({ children }: { children: React.ReactNode }) {
    return (
        <code className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
            {children}
        </code>
    );
}

function CodeBlock({ filename, lang, children }: { filename: string; lang: string; children: string }) {
    return (
        <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2">
                <span className="font-mono text-xs text-muted-foreground">{filename}</span>
                <span className="label-mono">{lang}</span>
            </div>
            <pre className="overflow-x-auto bg-card p-5">
                <code className="font-mono text-sm leading-relaxed text-muted-foreground">{children}</code>
            </pre>
        </div>
    );
}
