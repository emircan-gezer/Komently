// app/api/sections/[publicId]/reports/route.ts
// Handles fetching historical Analyst reports and creating new ones.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabase } from "@/lib/supabase/server";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function getOwner(request: NextRequest) {
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: async () => (await cookies()).getAll(), setAll: () => {} } }
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
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  // 1. Get Section
  const { data: section } = await adminClient
    .from("comment_sections")
    .select("id")
    .eq("public_id", publicId)
    .eq("owner_id", owner.id)
    .single();

  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  // 2. Fetch all reports, newest first
  const { data: reports, error } = await adminClient
    .from("section_reports")
    .select("*")
    .eq("section_id", section.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  return NextResponse.json({ reports });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;
  const owner = await getOwner(request);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  const { data: section } = await adminClient
    .from("comment_sections")
    .select("id")
    .eq("public_id", publicId)
    .eq("owner_id", owner.id)
    .single();

  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  // Check if there's already a processing report
  const { data: active } = await adminClient
    .from("section_reports")
    .select("id")
    .eq("section_id", section.id)
    .eq("status", "processing")
    .maybeSingle();

  if (active) {
     return NextResponse.json({ error: "A report is already being generated." }, { status: 400 });
  }

  // Insert a new processing row
  const { data: report, error: insErr } = await adminClient
    .from("section_reports")
    .insert({ section_id: section.id, status: "processing" })
    .select()
    .single();

  if (insErr) {
    return NextResponse.json({ error: "Database insert failed" }, { status: 500 });
  }

  // Non-blocking fetch to Python AI service which handles background generation
  fetch(`${AI_SERVICE_URL}/generate-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section_id: section.id, report_id: report.id })
  }).catch(e => console.error("Failed to kick off remote report", e));

  return NextResponse.json({ success: true, report });
}
