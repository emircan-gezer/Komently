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
            <nav className="mb-12 rounded-xl border border-border bg-muted px-5 py-4">
                <p className="label-mono mb-3">On this page</p>
                {["Overview", "Quick Integration", "API Reference"].map((item, i) => (
                    <a
                        key={item}
                        href={`#section-${i + 1}`}
                        className="block py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <span className="font-mono text-primary">{String(i + 1).padStart(2, "0")}</span>
                        {" — "}{item}
                    </a>
                ))}
            </nav>

            <div className="flex flex-col gap-16">

                {/* ── 01 Overview ── */}
                <section id="section-1">
                    <SectionHeading index="01" title="Overview" />
                    <div className="mt-5 rounded-xl border border-border bg-card p-6">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            <strong className="font-semibold text-foreground">Komently</strong> is a universal,
                            embeddable comment system. Each comment section is identified by a{" "}
                            <InlineCode>publicId</InlineCode> you create in your dashboard. All data is stored
                            and served by the Komently API — no database setup required.
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            Supports threaded replies, upvotes/downvotes, pagination, sorting, guest commenting,
                            and optional AI moderation out of the box.
                        </p>
                    </div>
                </section>

                <hr className="border-border" />

                {/* ── 02 Integration ── */}
                <section id="section-2">
                    <SectionHeading index="02" title="Quick Integration" />

                    <p className="mb-4 mt-5 text-sm leading-relaxed text-muted-foreground">
                        Drop the Komently script into your HTML:
                    </p>
                    <CodeBlock filename="index.html" lang="HTML">
                        {`<!DOCTYPE html>
<html>
  <head>
    <script
      src="https://cdn.komently.io/sdk/v1/komently.min.js"
      defer
    ></script>
  </head>
  <body>
    <h1>My Blog Post</h1>

    <!-- Comment section renders here -->
    <div
      id="komently-section"
      data-komently-id="my-blog-post-123"
    ></div>
  </body>
</html>`}
                    </CodeBlock>

                    <p className="mb-4 mt-8 text-sm leading-relaxed text-muted-foreground">
                        Or use the React component:
                    </p>
                    <CodeBlock filename="page.tsx" lang="TypeScript">
                        {`import { KomentlySection } from "@komently/react";

export default function BlogPost() {
  return (
    <article>
      <h1>My Post</h1>
      <KomentlySection
        publicId="my-blog-post-123"
        theme="dark"
        pageSize={10}
        sorting="top"
      />
    </article>
  );
}`}
                    </CodeBlock>
                </section>

                <hr className="border-border" />

                {/* ── 03 API Reference ── */}
                <section id="section-3">
                    <SectionHeading index="03" title="API Reference" />

                    {/* Endpoint badge */}
                    <div className="mt-5 overflow-hidden rounded-xl border border-border">
                        <div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-2.5">
                            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                                GET
                            </span>
                            <span className="font-mono text-sm text-muted-foreground">
                                /api/v1/comments/<span className="text-muted-foreground/40">{"{publicId}"}</span>
                            </span>
                        </div>
                        <CodeBlock filename="request" lang="REST">
                            {`GET https://api.komently.io/v1/comments/my-blog-post-123
  ?pageSize=10
  &replyDepth=2
  &sorting=top
  &page=1
Authorization: Bearer YOUR_API_KEY`}
                        </CodeBlock>
                    </div>

                    <p className="mb-4 mt-8 text-sm text-muted-foreground">Example response:</p>
                    <CodeBlock filename="response.json" lang="JSON">
                        {`{
  "publicId": "my-blog-post-123",
  "sorting": "top",
  "page": 1,
  "totalCount": 42,
  "totalPages": 5,
  "comments": [
    {
      "id": "c_a1b2c3",
      "author": { "username": "alex_dev" },
      "body": "This is so easy to integrate!",
      "likes": 47,
      "dislikes": 1,
      "createdAt": "2025-10-12T09:14:00Z",
      "replies": [
        {
          "id": "c_d4e5f6",
          "author": { "username": "sarah_m" },
          "body": "Totally agree!",
          "likes": 12,
          "dislikes": 0,
          "createdAt": "2025-10-12T11:30:00Z"
        }
      ]
    }
  ]
}`}
                    </CodeBlock>

                    {/* Params table */}
                    <div className="mt-8 overflow-hidden rounded-xl border border-border">
                        <div className="border-b border-border bg-muted px-5 py-3">
                            <span className="label-mono">Query Parameters</span>
                        </div>
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-border/50">
                                    {["Param", "Type", "Default", "Description"].map((h) => (
                                        <th key={h} className="bg-card px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { param: "pageSize", type: "number", def: "10", desc: "Comments per page (max 20)" },
                                    { param: "replyDepth", type: "number", def: "2", desc: "Nested reply depth (max 3)" },
                                    { param: "sorting", type: "string", def: "top", desc: "Sort: top | new | old" },
                                    { param: "page", type: "number", def: "1", desc: "Page number for pagination" },
                                ].map((row, i, arr) => (
                                    <tr
                                        key={row.param}
                                        className={cn("bg-card", i < arr.length - 1 && "border-b border-border/30")}
                                    >
                                        <td className="px-5 py-3">
                                            <code className="font-mono text-xs text-primary">{row.param}</code>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.type}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.def}</td>
                                        <td className="px-5 py-3 text-xs text-muted-foreground">{row.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* CTA card */}
                <div className="rounded-xl border border-primary/20 bg-card p-7">
                    <h3 className="mb-1.5 text-base font-semibold text-foreground">Ready to get started?</h3>
                    <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                        Create a free account and get your first API key in under a minute.
                    </p>
                    <Button asChild>
                        <Link href="/dashboard">Open Dashboard →</Link>
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
