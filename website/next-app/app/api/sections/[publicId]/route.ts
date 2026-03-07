// app/api/sections/[publicId]/route.ts
// GET   /api/sections/:publicId — get detail for a specific section
// PATCH /api/sections/:publicId — update settings/metadata
//
// Authentication: Supabase Auth session (site owner)

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabase } from "@/lib/supabase/server";

async function getOwner(request: NextRequest) {
    const client = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: async () => {
                    const cookieStore = await cookies();
                    return cookieStore.getAll();
                },
                setAll: () => { },
            },
        }
    );
    const { data: { user } } = await client.auth.getUser();
    return user;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ publicId: string }> }
) {
    const { publicId } = await params;
    const owner = await getOwner(request);
    if (!owner) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const adminClient = await supabase(cookieStore);

    const { data: section, error } = await adminClient
        .from("comment_sections")
        .select("*")
        .eq("public_id", publicId)
        .eq("owner_id", owner.id)
        .single();

    if (error || !section) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json({ section });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ publicId: string }> }
) {
    const { publicId } = await params;
    const owner = await getOwner(request);
    if (!owner) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const adminClient = await supabase(cookieStore);

    // 1. Verify ownership first
    const { data: existing, error: vErr } = await adminClient
        .from("comment_sections")
        .select("id, settings")
        .eq("public_id", publicId)
        .eq("owner_id", owner.id)
        .single();

    if (vErr || !existing) {
        return NextResponse.json({ error: "Section not found or unauthorized" }, { status: 404 });
    }

    // 2. Prepare update payload
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.status !== undefined) updates.status = body.status;

    // Deep merge or overwrite settings? 
    // JSONB allows partial updates in SQL, but for simplicity we can just replace the whole settings object
    // if it's provided, or merge it in the handler.
    if (body.settings !== undefined) {
        updates.settings = {
            ...(existing.settings as any || {}),
            ...body.settings
        };
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: updated, error: uErr } = await adminClient
        .from("comment_sections")
        .update(updates)
        .eq("id", existing.id)
        .select("*")
        .single();

    if (uErr) {
        console.error("Update section error:", uErr);
        return NextResponse.json({ error: "Failed to update section" }, { status: 500 });
    }

    return NextResponse.json({ section: updated });
}
