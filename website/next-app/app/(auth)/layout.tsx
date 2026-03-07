import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Authentication — Komently',
    description: 'Sign in to your Komently account or create a new one.',
};

export default function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
            <Link href="/" className="mb-12 flex flex-col items-center gap-4 group">
                <Image
                    src="/KomentlyLogo.svg"
                    alt="Komently logo"
                    width={40}
                    height={40}
                    className="invert transition-transform duration-500 group-hover:rotate-12"
                />
                <span className="text-xl font-bold tracking-tighter">Komently</span>
            </Link>
            {children}
        </div>
    );
}
