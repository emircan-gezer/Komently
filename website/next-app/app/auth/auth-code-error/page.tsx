"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
    const [errorMsg, setErrorMsg] = useState(
        "We couldn't verify your authentication request. The link may be invalid or has expired."
    );

    useEffect(() => {
        // Supabase sometimes returns errors in the URL hash instead of search params
        // Example: #error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
        const hash = window.location.hash;
        if (hash) {
            const params = new URLSearchParams(hash.substring(1)); // Remove the '#'
            const errorDescription = params.get("error_description");
            if (errorDescription) {
                // URLSearchParams automatically handles '+' to space decoding 
                // in most browsers, but we replace just to be explicitly safe.
                setErrorMsg(errorDescription.replace(/\+/g, " "));
            }
        } else {
            // Also check standard query parameters as a fallback
            const searchParams = new URLSearchParams(window.location.search);
            const errorDescription = searchParams.get("error_description");
            const errorMessage = searchParams.get("message") || searchParams.get("error");
            if (errorDescription) {
                setErrorMsg(errorDescription.replace(/\+/g, " "));
            } else if (errorMessage) {
                setErrorMsg(errorMessage.replace(/\+/g, " "));
            }
        }
    }, []);

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6 bg-background">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-primary/5 text-center">
                <div className="mb-6 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                        <svg
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-foreground mb-4">
                    Authentication Failed
                </h1>

                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 mb-8">
                    <p className="text-sm text-destructive font-medium">
                        {errorMsg}
                    </p>
                </div>

                <Button asChild className="w-full rounded-2xl">
                    <Link href="/login">Return to Login</Link>
                </Button>
            </div>
        </div>
    );
}
