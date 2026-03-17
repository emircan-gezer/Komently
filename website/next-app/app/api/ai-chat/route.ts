// app/api/ai-chat/route.ts
// Proxy endpoint: forwards dashboard chat messages to the Python CrewAI service.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
    // 1 — Authenticate the dashboard user (must be logged-in owner)
    const cookieStore = await cookies();
    const adminClient = await supabase(cookieStore);

    const {
        data: { user },
    } = await adminClient.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2 — Parse the chat request
    let sectionPublicId: string;
    let message: string;
    let history: { role: string; content: string }[];

    try {
        const json = await request.json();
        sectionPublicId = json.sectionPublicId;
        message = json.message;
        history = json.history ?? [];
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!sectionPublicId || !message) {
        return NextResponse.json(
            { error: "sectionPublicId and message are required" },
            { status: 422 }
        );
    }

    // 3 — Resolve section and verify ownership
    const { data: section, error: sErr } = await adminClient
        .from("comment_sections")
        .select("id, owner_id")
        .eq("public_id", sectionPublicId)
        .single();

    if (sErr || !section) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    if (section.owner_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4 — Forward to Python CrewAI chat endpoint
    try {
        const aiResponse = await fetch(`${AI_SERVICE_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                section_id: section.id,
                message,
                history,
            }),
        });

        if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error("[AI Chat] Service error:", errorText);
            return NextResponse.json(
                { error: "AI service error" },
                { status: 502 }
            );
        }

        const data = await aiResponse.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error("[AI Chat] Failed to reach AI service:", err);
        return NextResponse.json(
            { error: "AI service unreachable" },
            { status: 503 }
        );
    }
}
