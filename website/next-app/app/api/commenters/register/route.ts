// app/api/commenters/register/route.ts
// POST /api/commenters/register — create a new commenter identity and return a JWT
//
// Body (JSON):
//   { username: string, color?: string }
//
// Returns:
//   { commenterId, token }

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { signCommenterToken } from "@/lib/commenter-auth";

const AVATAR_COLORS = [
    "#7c3aed", "#0891b2", "#059669", "#dc2626",
    "#d97706", "#be185d", "#0284c7", "#7c3aed",
];

function randomColor() {
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export async function POST(request: NextRequest) {
    let username: string, color: string;
    try {
        const json = await request.json();
        username = (json.username ?? "").toString().trim();
        color = json.color ?? randomColor();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!username || username.length < 2 || username.length > 32) {
        return NextResponse.json(
            { error: "username must be between 2 and 32 characters" },
            { status: 422 }
        );
    }

    // Check username uniqueness
    const { data: existing } = await supabase
        .from("commenters")
        .select("id")
        .eq("username", username)
        .maybeSingle();

    if (existing) {
        return NextResponse.json(
            { error: "Username already taken" },
            { status: 409 }
        );
    }

    const { data: commenter, error } = await supabase
        .from("commenters")
        .insert({ username, color })
        .select("id")
        .single();

    if (error || !commenter) {
        return NextResponse.json({ error: "Failed to create commenter" }, { status: 500 });
    }

    const token = await signCommenterToken(commenter.id);

    return NextResponse.json({ commenterId: commenter.id, token }, { status: 201 });
}