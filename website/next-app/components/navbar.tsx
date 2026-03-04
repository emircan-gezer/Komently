"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/docs", label: "Docs" },
];

export function Navbar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    return (
        <nav className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border bg-background">
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6">

                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5">
                    <Image
                        src="/KomentlyLogo.svg"
                        alt="Komently logo"
                        width={28}
                        height={28}
                        className="invert"
                    />
                    <span className="text-base font-semibold tracking-tight text-foreground">
                        Komently
                    </span>
                </Link>

                {/* Desktop links */}
                <div className="hidden items-center gap-0.5 md:flex">
                    {navLinks.map((link) => {
                        const active = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                                    active
                                        ? "bg-muted text-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </div>

                {/* CTA + mobile toggle */}
                <div className="flex items-center gap-2">
                    <Button asChild size="sm" className="hidden md:inline-flex">
                        <Link href="/dashboard">Get Started</Link>
                    </Button>
                    <button
                        onClick={() => setOpen((v) => !v)}
                        className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
                        aria-label="Toggle menu"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            {open ? (
                                <path d="M2 2l12 12M2 14L14 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                            ) : (
                                <>
                                    <rect y="2" width="16" height="1.5" rx="0.75" />
                                    <rect y="7.25" width="16" height="1.5" rx="0.75" />
                                    <rect y="12.5" width="16" height="1.5" rx="0.75" />
                                </>
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile menu */}
            {open && (
                <div className="border-t border-border bg-background px-6 py-3 md:hidden">
                    <div className="flex flex-col gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setOpen(false)}
                                className={cn(
                                    "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                                    pathname === link.href
                                        ? "bg-muted text-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Button asChild size="sm" className="mt-2">
                            <Link href="/dashboard" onClick={() => setOpen(false)}>Get Started</Link>
                        </Button>
                    </div>
                </div>
            )}
        </nav>
    );
}
