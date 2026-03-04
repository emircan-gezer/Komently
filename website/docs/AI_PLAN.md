# AI_PLAN.md — Komently AI Moderator Agent

> **Status**: Planning phase — not yet implemented.  
> This document describes the AI agent architecture intended for Komently v2.

---

## 1. Problem Statement

Comment sections at scale are plagued by three problems:

1. **Spam** — Bot-generated comments, self-promotion, link spam.
2. **Toxicity** — Harassment, hate speech, off-topic aggression.
3. **Poor discovery** — High-quality comments are buried under noise; users disengage.

Manual moderation does not scale. Hiring moderators is expensive. Keyword filters are brittle and easy to bypass. The solution is a context-aware AI agent that moderates continuously, learns from moderator feedback, and improves discussion quality automatically.

---

## 2. AI Moderator Concept

The **Komently AI Moderator** is an autonomous background agent that:

- Scores every incoming comment for toxicity, spam likelihood, and relevance.
- Takes moderation actions (approve, flag, shadow-ban, delete) based on configured thresholds.
- Learns from human moderator overrides via a reinforcement feedback loop.
- Generates weekly "discussion insight" reports per comment section.
- Powers smart reply ranking — surfacing the most useful comments first.

The AI does **not** replace human moderators. It reduces their workload by ~80%, leaving only edge cases for human review.

---

## 3. Interaction Flow

```
User submits comment
        │
        ▼
 ┌─────────────────────────────┐
 │     Komently Ingestion API   │
 │  (stores comment as PENDING) │
 └─────────────┬───────────────┘
               │  async queue
               ▼
 ┌─────────────────────────────┐
 │    AI Moderator Agent        │
 │  ┌────────────────────────┐  │
 │  │  1. Spam Classifier    │  │
 │  │  2. Toxicity Model     │  │
 │  │  3. Relevance Scorer   │  │
 │  │  4. Context Analyzer   │  │
 │  └──────────┬─────────────┘  │
 │             │                │
 │    Aggregated confidence      │
 │    score + action decision    │
 └─────────────┬───────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
 APPROVED             FLAGGED
 (publish)         (human review queue)
                        │
                   ┌────┴─────┐
                   │ Human    │
                   │ Moderator│
                   └────┬─────┘
                        │ approve / reject
                        ▼
                  Feedback logged →
                  Model fine-tuned
```

**Key design decision**: The AI acts asynchronously. Comments appear immediately for the author (optimistic UI) but are held from the public feed until the AI scores them. For low-risk comments (score > 0.95), this delay is under 200ms. For edge cases, the comment queues for human review.

---

## 4. Technical Architecture

### 4.1 Components

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| **Ingestion API** | Next.js API Routes / Edge Functions | Receive, validate, queue comments |
| **Message Queue** | Redis Streams or AWS SQS | Buffer comments for async processing |
| **AI Agent Runtime** | Python (FastAPI) or Node.js worker | Orchestrate model calls |
| **Spam Classifier** | Fine-tuned BERT / DistilBERT | Detect spam patterns |
| **Toxicity Model** | Google Perspective API (v1) or Detoxify | Score toxicity 0–1 |
| **Context Analyzer** | GPT-4o mini (function calling) | Understand thread context and relevance |
| **Feedback Store** | PostgreSQL | Log human corrections for retraining |
| **Model Registry** | MLflow or HuggingFace Hub | Version and serve fine-tuned models |
| **Dashboard** | Komently Web Dashboard | Display moderation queue, stats |

### 4.2 Scoring Pipeline

Each comment is scored on three axes:

```
spam_score    ∈ [0, 1]   (1 = spam)
toxicity_score ∈ [0, 1]  (1 = highly toxic)
relevance_score ∈ [0, 1] (1 = highly relevant to thread)
```

Final decision:

```python
def decide(spam, toxicity, relevance, config):
    if spam > config.spam_threshold:          # default 0.85
        return Action.REJECT
    if toxicity > config.toxicity_threshold:  # default 0.75
        return Action.FLAG_FOR_REVIEW
    if relevance < config.relevance_floor:    # default 0.20
        return Action.FLAG_FOR_REVIEW
    return Action.APPROVE
```

Section owners can customize thresholds from their dashboard (e.g., a children's platform might set `toxicity_threshold=0.3`).

### 4.3 Smart Reply Ranking

Beyond moderation, the AI re-ranks approved comments for display using a `quality_score`:

```
quality_score = 0.5 × (likes - dislikes) / (likes + dislikes + 1)
             + 0.3 × relevance_score
             + 0.2 × recency_decay
```

This surfaces insightful, recent, liked comments while suppressing low-effort noise — even before human engagement data accumulates.

---

## 5. Privacy and Ethical Considerations

- **No PII stored** in model training data. Comments are anonymized before fine-tuning.
- **Transparency**: Users whose comments are flagged are notified ("This comment is under review").
- **Appeal mechanism**: Users can request human review of any AI decision.
- **Section owner control**: AI moderation is opt-in. Owners can disable it entirely.
- **Bias auditing**: Models are tested quarterly against diverse datasets. Bias reports are published.

---

## 6. Roadmap

| Milestone | Target |
|-----------|--------|
| Perspective API integration (toxicity only) | v1.5 |
| Custom spam classifier (trained on Komently data) | v2.0 |
| Context-aware AI agent (GPT-4o mini) | v2.1 |
| Human-in-the-loop feedback loop | v2.2 |
| Smart reply ranking | v2.3 |
| Per-section AI config UI in dashboard | v2.4 |
| Bias audit report (public) | v3.0 |

---

*Document authored: March 2026. For questions, contact the Komently team.*
