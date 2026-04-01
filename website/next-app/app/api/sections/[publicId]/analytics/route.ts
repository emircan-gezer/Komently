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
        setAll: () => {},
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

  // 1. Verify owner holds this section and get its internal ID
  const { data: section, error: secErr } = await adminClient
    .from("comment_sections")
    .select("id")
    .eq("public_id", publicId)
    .eq("owner_id", owner.id)
    .single();

  if (secErr || !section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  // 2. Fetch from the analytics summary view we created in 06_analytics_views.sql
  const { data: stats, error: statErr } = await adminClient
    .from("section_analytics_summary")
    .select("*")
    .eq("section_id", section.id)
    .maybeSingle();

  if (statErr) {
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }

  // 3. Transform for the frontend
  if (!stats) {
     return NextResponse.json({
        total: 0,
        approvalRate: "0.0",
        avgResponse: "—",
        thisWeek: 0,
        approved: 0,
        rejected: 0,
        pending: 0
     });
  }

  const total = stats.total_comments || 0;
  const approved = stats.approved_comments || 0;
  const rejected = stats.rejected_comments || 0;
  const pending = stats.pending_comments || 0;

  return NextResponse.json({
     total,
     approvalRate: stats.approval_rate ? Number(stats.approval_rate).toFixed(1) : "0.0",
     avgResponse: "—", // placeholder until thread times are tracked
     thisWeek: stats.comments_this_week || 0,
     approved: total > 0 ? (approved / total) * 100 : 0,
     rejected: total > 0 ? (rejected / total) * 100 : 0,
     pending: total > 0 ? (pending / total) * 100 : 0
  });
}
