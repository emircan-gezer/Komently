"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
    { href: "/", label: "Home" },
    { href: "/docs", label: "Documentation" },
];

export function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();

        // Initial state
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for changes (login, logout, etc)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setUser(session?.user ?? null);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
        setOpen(false);
    };

    return (
        <nav className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border bg-background">
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6">

                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
                    <Image
                        src="/KomentlyLogo.svg"
                        alt="Komently logo"
                        width={28}
                        height={28}
                        className="invert"
                    />
                    <span className="text-lg font-bold tracking-tighter text-foreground">
                        Komently
                    </span>
                </Link>

                {/* Desktop links */}
                <div className="hidden items-center gap-1 md:flex">
                    {navLinks.map((link) => {
                        // Don't show Dashboard link in the main nav if logged out (handled by button later)
                        if (link.href === '/dashboard' && !user && !loading) return null;
                        if (link.href === '/dashboard' && loading) return <div key="skeleton" className="w-20 h-8 rounded-xl bg-muted/20 animate-pulse" />;

                        const active = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
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
                <div className="flex items-center gap-3">
                    {loading ? (
                        <div className="hidden md:flex gap-2">
                            <div className="w-14 h-8 rounded-xl bg-muted/20 animate-pulse" />
                            <div className="w-20 h-8 rounded-xl bg-muted/20 animate-pulse" />
                        </div>
                    ) : user ? (
                        <div className="hidden md:flex items-center gap-3">
                            <Button asChild size="sm" variant="ghost" className="rounded-xl text-muted-foreground hover:text-foreground">
                                <Link href="/dashboard">Dashboard</Link>
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleLogout} className="rounded-xl">
                                Logout
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Button asChild size="sm" variant="ghost" className="hidden md:inline-flex rounded-xl text-muted-foreground hover:text-foreground">
                                <Link href="/login">Login</Link>
                            </Button>
                            <Button asChild size="sm" className="hidden md:inline-flex rounded-xl">
                                <Link href="/register">Register</Link>
                            </Button>
                        </>
                    )}
                    <button
                        onClick={() => setOpen((v) => !v)}
                        className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
                        aria-label="Toggle menu"
                    >
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                            {open ? (
                                <path d="M2 2l12 12M2 14L14 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                            ) : (
                                <>
                                    <rect y="3" width="16" height="1.5" rx="0.75" />
                                    <rect y="7.25" width="16" height="1.5" rx="0.75" />
                                    <rect y="11.5" width="16" height="1.5" rx="0.75" />
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
                                    "rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                                    pathname === link.href
                                        ? "bg-muted text-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <div className="mt-2 flex flex-col gap-2">
                            {user ? (
                                <>
                                    <Button asChild size="sm" variant="ghost" className="w-full rounded-full justify-start px-3 text-muted-foreground hover:text-foreground">
                                        <Link href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleLogout} className="w-full rounded-full justify-start px-3">
                                        Logout
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button asChild size="sm" variant="ghost" className="w-full rounded-full text-muted-foreground justify-start px-3">
                                        <Link href="/login" onClick={() => setOpen(false)}>Login</Link>
                                    </Button>
                                    <Button asChild size="sm" className="w-full rounded-full justify-start px-3">
                                        <Link href="/register" onClick={() => setOpen(false)}>Register</Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
