// lib/ai/moderator.ts
import { supabase } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});
export interface ModerationResult {
    status: 'approved' | 'flagged';
    toxicityScore: number;
    isSpam: boolean;
    metadata: any;
}

/**
 * Simulates an AI moderation process using provided settings.
 */
async function ModerateWithAI(body: string, settings: any): Promise<ModerationResult> {
    const threshold = settings?.ai_toxicity_threshold ?? 0.8;
    const aiEnabled = settings?.ai_moderation_enabled ?? true;

    if (!aiEnabled) {
        return {
            status: "approved",
            toxicityScore: 0,
            isSpam: false,
            metadata: { skipped: true }
        };
    }

    try {
        const response = await openai.moderations.create({
            model: "omni-moderation-latest",
            input: body
        });

        const result = response.results[0];

        // Convert categories into a simple toxicity score
        const scores = result.category_scores;

        const toxicityScore = Math.max(
            scores.harassment || 0,
            scores.hate || 0,
            scores.violence || 0,
            scores.sexual || 0
        );

        const isSpam =
            body.toLowerCase().includes("buy now") ||
            body.toLowerCase().includes("win a prize") ||
            body.includes("http");

        const status =
            toxicityScore > threshold || result.flagged || isSpam
                ? "flagged"
                : "approved";

        return {
            status,
            toxicityScore,
            isSpam,
            metadata: {
                model: "omni-moderation-latest",
                categories: result.categories,
                scores,
                flagged: result.flagged,
                thresholdUsed: threshold,
                processedAt: new Date().toISOString()
            }
        };
    } catch (err) {
        console.error("OpenAI moderation error:", err);

        // Fail-safe: approve but log error
        return {
            status: "approved",
            toxicityScore: 0,
            isSpam: false,
            metadata: { error: "moderation_failed" }
        };
    }
}

/**
 * Background-friendly function to process moderation for a comment.
 * Updates the database with the result.
 */
export async function processCommentModeration(commentId: string, body: string) {
    console.log(`[AI Moderator] Starting moderation for comment ${commentId}...`);

    try {
        const { createServerClient } = await import('@supabase/ssr');
        const adminClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                cookies: {
                    getAll() { return [] },
                    setAll() { },
                },
            }
        );

        // 1. Fetch section settings for this comment
        const { data: commentData, error: cErr } = await adminClient
            .from("comments")
            .select("section_id, comment_sections(settings)")
            .eq("id", commentId)
            .single();

        if (cErr || !commentData) {
            console.error(`[AI Moderator] Could not find comment/settings for ${commentId}:`, cErr);
            return;
        }

        const settings = (commentData as any).comment_sections?.settings;

        // 2. Process AI moderation with settings
        const result = await ModerateWithAI(body, settings);

        // 3. Update the comment
        const { error: uErr } = await adminClient
            .from("comments")
            .update({
                moderation_status: result.status,
                toxicity_score: result.toxicityScore,
                is_spam: result.isSpam,
                ai_metadata: result.metadata,
                updated_at: new Date().toISOString()
            })
            .eq("id", commentId);

        if (uErr) {
            console.error(`[AI Moderator] Error updating comment ${commentId}:`, uErr);
        } else {
            console.log(`[AI Moderator] Comment ${commentId} moderated: ${result.status}`);
        }
    } catch (err) {
        console.error(`[AI Moderator] Fatal error processing comment ${commentId}:`, err);
    }
}
