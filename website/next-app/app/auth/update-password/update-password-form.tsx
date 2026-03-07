"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UpdatePasswordForm() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push("/dashboard");
        }
    };

    return (
        <form onSubmit={handleUpdatePassword} className="space-y-8">
            {error && (
                <div className="text-[12px] font-bold text-destructive p-4 border border-destructive/20 bg-destructive/5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="password" className="label-mono">New Password</Label>
                <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-muted/30 rounded-xl border-border focus-visible:ring-primary/20 px-4 shadow-none transition-all h-11"
                />
            </div>

            <Button
                type="submit"
                className="w-full rounded-2xl font-black tracking-widest h-12 text-xs uppercase shadow-lg shadow-primary/10 transition-transform hover:-translate-y-0.5"
                disabled={loading}
            >
                {loading ? "UPDATING..." : "UPDATE PASSWORD"}
            </Button>
        </form>
    );
}
