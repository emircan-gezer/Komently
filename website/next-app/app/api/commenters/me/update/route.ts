import { NextRequest, NextResponse } from "next/server";
import { verifyCommenterToken, signCommenterToken } from "@/lib/commenter-auth";
import { supabase } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, avatar_initial, color } = body;

        const commenter = await verifyCommenterToken(request);
        if (!commenter) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const cookieStore = await cookies();
        const adminClient = await supabase(cookieStore);

        // Update the commenter's profile
        const { error: updateError } = await adminClient
            .from("commenters")
            .update({
                username: username
            })
            .eq("id", commenter.commenterId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Technically the token only contains commenterId, so we don't strictly *need* to re-issue,
        // but it's good practice or if we ever cache username in the token payload.
        const token = await signCommenterToken(commenter.commenterId);

        return NextResponse.json({
            success: true,
            commenter: {
                id: commenter.commenterId,
                username,
            },
            token
        });

    } catch (e: any) {
        return NextResponse.json({ error: "Failed to parse request" }, { status: 400 });
    }
}
