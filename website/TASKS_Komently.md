# Komently --- Implementation Task List

This document outlines the step-by-step plan to build the Komently draft
website using Next.js and Cursor.

------------------------------------------------------------------------

# Phase 1 --- Project Setup

## Task 1.1 --- Initialize Next.js Project

-   Create new Next.js app (App Router, TypeScript)
-   Configure ESLint and Prettier
-   Initialize Git repository
-   Push initial commit to GitHub

Acceptance criteria:

-   Project runs locally
-   Repo exists on GitHub

------------------------------------------------------------------------

## Task 1.2 --- Configure Development Environment

-   Install Tailwind (optional but recommended)
-   Configure path aliases
-   Set up basic folder structure:

src/app\
src/components\
src/lib\
src/mock

Acceptance criteria:

-   Clean project structure
-   No TypeScript errors

------------------------------------------------------------------------

# Phase 2 --- Core Website Pages

## Task 2.1 --- Build Navbar

Create global navigation with:

-   Home
-   Dashboard
-   Docs

Acceptance criteria:

-   Navigation works between pages
-   Responsive layout

------------------------------------------------------------------------

## Task 2.2 --- Home Page

Requirements:

-   Hero section
-   Features section
-   Komently demo comment section
-   Call-to-action buttons

Dynamic element:

-   Load mock comments via API route

Acceptance criteria:

-   Page renders correctly
-   Demo comments visible

------------------------------------------------------------------------

## Task 2.3 --- Dashboard Page (Mock)

Features:

-   List of comment sections
-   Basic stats display
-   "Create Section" button (mock)

Use mock data.

Acceptance criteria:

-   Sections list renders
-   Navigation works

------------------------------------------------------------------------

## Task 2.4 --- Documentation Page

Include:

-   Overview of Komently
-   Integration example
-   API usage sample

Acceptance criteria:

-   Page accessible from navbar
-   Content clearly formatted

------------------------------------------------------------------------

# Phase 3 --- Demo Comment System

## Task 3.1 --- Mock Comments API

Create:

/api/comments/\[publicId\]

Support:

-   pageSize
-   replyDepth
-   sorting

Acceptance criteria:

-   Endpoint returns structured mock data
-   Works with query params

------------------------------------------------------------------------

## Task 3.2 --- Basic SDK Renderer

-   Build Reddit-style comment UI
-   Collapsible replies
-   Like/dislike buttons
-   Pagination controls

Acceptance criteria:

-   Comments render correctly
-   Nested replies expandable

------------------------------------------------------------------------

# Phase 4 --- AI Planning

## Task 4.1 --- Write AI_PLAN.md

Include:

-   AI moderator concept
-   Problem statement
-   Interaction flow
-   High-level architecture diagram

Acceptance criteria:

-   2--4 pages of content
-   Clear and realistic design

------------------------------------------------------------------------

# Phase 5 --- Deployment

## Task 5.1 --- Deploy Website

-   Deploy to Vercel (recommended)
-   Verify production build
-   Add live link to README

Acceptance criteria:

-   Site publicly accessible
-   No build errors

------------------------------------------------------------------------

# Phase 6 --- Final Checks

-   Clean README
-   Working navigation
-   Mock data functional
-   Repo organized
-   Planning document included

Project is ready for submission when all criteria are satisfied.
