// lib/ai/moderator.ts
// Calls the Python CrewAI microservice for multi-agent moderation.

export interface ModerationResult {
    status: 'approved' | 'flagged' | 'rejected' | 'shadow_hidden';
    action: 'approved' | 'flagged' | 'rejected' | 'shadow_hidden';
    toxicityScore: number;
    isSpam: boolean;
    metadata: any;
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Background-friendly function to process moderation for a comment.
 * Sends the comment to the Python CrewAI service and updates the database.
 */
export async function processCommentModeration(commentId: string, body: string, parentId?: string | null) {
    console.log(`[AI Moderator] Starting crew moderation for comment ${commentId}...`);

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

        // 1. Get the section_id for this comment
        const { data: commentData, error: cErr } = await adminClient
            .from("comments")
            .select("section_id")
            .eq("id", commentId)
            .single();

        if (cErr || !commentData) {
            console.error(`[AI Moderator] Could not find comment ${commentId}:`, cErr);
            return;
        }

        // 2. Call the Python CrewAI microservice
        const response = await fetch(`${AI_SERVICE_URL}/moderate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                comment_id: commentId,
                section_id: commentData.section_id,
                body: body,
                parent_id: parentId || undefined,
            }),
        });

        if (!response.ok) {
            throw new Error(`AI service returned ${response.status}: ${await response.text()}`);
        }

        const verdict = await response.json();

        // Map AI action/status to DB status
        let dbStatus = 'pending';
        const aiStatus = verdict.status || 'flagged';
        const aiAction = verdict.action;

        // Since we synchronized AI service output with DB status names, we can use them directly
        if (['approved', 'flagged', 'rejected', 'shadow_hidden'].includes(aiStatus)) {
            dbStatus = aiStatus;
        } else if (['approved', 'flagged', 'rejected', 'shadow_hidden'].includes(aiAction)) {
            dbStatus = aiAction;
        } else {
            dbStatus = 'flagged'; // default for unknown
        }

        // 3. Update the comment with the crew's verdict
        const { error: uErr } = await adminClient
            .from("comments")
            .update({
                moderation_status: dbStatus,
                toxicity_score: verdict.toxicityScore ?? verdict.toxicity_score,
                is_spam: verdict.isSpam ?? verdict.is_spam,
                ai_metadata: {
                    ...verdict.metadata,
                    reason: verdict.reason,
                    original_status: aiStatus,
                    original_action: aiAction,
                    processedAt: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
            })
            .eq("id", commentId);

        if (uErr) {
            console.error(`[AI Moderator] Error updating comment ${commentId}:`, uErr);
        } else {
            console.log(`[AI Moderator] Comment ${commentId} moderated by crew: ${verdict.status}`);
        }
    } catch (err) {
        console.error(`[AI Moderator] Fatal error processing comment ${commentId}:`, err);
    }
}
