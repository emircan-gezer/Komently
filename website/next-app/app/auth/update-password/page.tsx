import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "./update-password-form";
export default async function UpdatePasswordPage() {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirect("/login");
    }

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6 bg-background">
            <div className="w-full max-w-sm space-y-10 reveal">
                <div className="space-y-3">
                    <h1 className="text-4xl font-black tracking-tightest">
                        New Password
                    </h1>
                    <p className="text-sm text-muted-foreground/80">
                        Secure your account with a fresh credential.
                    </p>
                </div>

                <UpdatePasswordForm />
            </div>
        </div>
    );
}
