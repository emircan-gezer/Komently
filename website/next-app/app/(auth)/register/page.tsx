'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function RegisterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        const { data: { session }, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${process.env.NEXT_PUBLIC_KOMENTLY_BASE_URL}/auth/callback`,
            },
        });

        if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
        } else {
            if (session) {
                const nextUrl = searchParams.get('next');
                router.push(nextUrl ? nextUrl : '/dashboard');
                router.refresh();
            } else {
                setMessage('Check your email for the confirmation link.');
                setLoading(false);
            }
        }
    };

    return (
        <div className="w-full max-w-sm space-y-10 reveal">
            <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tightest">Create Account</h1>
                <p className="text-muted-foreground/80 text-sm">
                    Join Komently and start managing your discussions.
                </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-8">
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
                        <Label htmlFor="password" className="label-mono">Choose Password</Label>
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
                {message && (
                    <div className="text-[12px] font-bold text-primary p-4 border border-primary/20 bg-primary/5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
                        {message}
                    </div>
                )}

                <Button
                    type="submit"
                    className="w-full rounded-2xl font-black tracking-widest h-12 text-xs uppercase shadow-lg shadow-primary/10 transition-transform hover:-translate-y-0.5"
                    disabled={loading}
                >
                    {loading ? 'CREATING...' : 'CREATE ACCOUNT'}
                </Button>
            </form>

            <div className="text-center text-sm pt-4 border-t border-border/40">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link href={`/login${searchParams.get('next') ? `?next=${encodeURIComponent(searchParams.get('next')!)}` : ''}`} className="font-bold hover:text-primary transition-colors underline underline-offset-4">
                    Sign in
                </Link>
            </div>
        </div>
    );
}
import { Suspense } from 'react';

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="text-sm text-muted-foreground w-full text-center mt-32">Loading registration...</div>}>
            <RegisterForm />
        </Suspense>
    );
}
