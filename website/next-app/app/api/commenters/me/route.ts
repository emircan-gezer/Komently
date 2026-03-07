import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { signCommenterToken } from "@/lib/commenter-auth";

const AVATAR_COLORS = [
    "#7c3aed", "#0891b2", "#059669", "#dc2626",
    "#d97706", "#be185d", "#0284c7"
];

function randomColor() {
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
        return NextResponse.json({ loggedIn: false }, { status: 401 });
    }

    // Re-use the verified user to link or create a commenter
    let commenterId = user.user_metadata?.commenter_id;
    const baseUsername = user.user_metadata?.username ?? user.email?.split("@")[0] ?? "user";

    if (!commenterId) {
        // Ensure username is unique for the commenter
        let finalUsername = baseUsername;
        let counter = 1;

        while (true) {
            const { data: existing } = await supabase.from("commenters").select("id").eq("username", finalUsername).maybeSingle();
            if (!existing) break;
            finalUsername = `${baseUsername}${counter}`;
            counter++;
        }

        const color = randomColor();
        const { data: newCommenter, error: insertErr } = await supabase
            .from("commenters")
            .insert({ username: finalUsername, color })
            .select("id")
            .single();

        if (insertErr || !newCommenter) {
            return NextResponse.json({ loggedIn: false, error: "Failed to provision commenter" }, { status: 500 });
        }

        commenterId = newCommenter.id;

        // Save association in user_metadata
        await supabase.auth.updateUser({
            data: { commenter_id: commenterId, username: finalUsername }
        });
    }

    // Retrieve the actual commenter record
    const { data: commenterProfile } = await supabase
        .from("commenters")
        .select("id, username, color, avatar_initial")
        .eq("id", commenterId)
        .single();

    if (!commenterProfile) {
        return NextResponse.json({ loggedIn: false }, { status: 500 });
    }

    const token = await signCommenterToken(commenterId);

    return NextResponse.json({
        loggedIn: true,
        token,
        commenter: commenterProfile
    });
}
