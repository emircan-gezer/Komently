'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) {
            setError(signInError.message);
            setLoading(false);
        } else {
            const nextUrl = searchParams.get('next');
            router.push(nextUrl ? nextUrl : '/dashboard');
            router.refresh();
        }
    };

    return (
        <div className="w-full max-w-sm space-y-10 reveal">
            <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tightest">Sign In</h1>
                <p className="text-muted-foreground/80 text-sm">
                    Access your dashboard and manage interactions.
                </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-8">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="label-mono">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-muted/30 rounded-xl border-border focus-visible:ring-primary/20 px-4 shadow-none transition-all placeholder:text-muted-foreground/30 h-11"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="label-mono">Password</Label>
                            <Link
                                href={`/forgot-password${searchParams.get('next') ? `?next=${encodeURIComponent(searchParams.get('next')!)}` : ''}`}
                                className="text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                            >
                                Recover?
                            </Link>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-muted/30 rounded-xl border-border focus-visible:ring-primary/20 px-4 shadow-none transition-all h-11"
                        />
                    </div>
                </div>

                {error && (
                    <div className="text-[12px] font-bold text-destructive p-4 border border-destructive/20 bg-destructive/5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
                        {error}
                    </div>
                )}

                <Button
                    type="submit"
                    className="w-full rounded-2xl font-black tracking-widest h-12 text-xs uppercase shadow-lg shadow-primary/10 transition-transform hover:-translate-y-0.5"
                    disabled={loading}
                >
                    {loading ? 'PROCESSING...' : 'AUTHENTICATE'}
                </Button>
            </form>

            <div className="text-center text-sm pt-4 border-t border-border/40">
                <span className="text-muted-foreground">New to Komently? </span>
                <Link href={`/register${searchParams.get('next') ? `?next=${encodeURIComponent(searchParams.get('next')!)}` : ''}`} className="font-bold hover:text-primary transition-colors underline underline-offset-4">
                    Create account
                </Link>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="text-sm text-muted-foreground w-full text-center mt-32">Loading sign-in...</div>}>
            <LoginForm />
        </Suspense>
    );
}
