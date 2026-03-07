# Komently – Advanced Web Programming Assignment 1

## 1. Project Overview

### 1.1 Website Topic and Purpose

Komently is a comment system that works on all websites. It's perfect for sites that want to add modern discussion features without having to build a complicated backend. The platform lets website owners add a comment system with a simple script, and the backend takes care of authentication, storing comments, and starting discussion threads.

The goal of this project is to create a comment system that can grow and show how it works on a draft website. The system is built to work with AI in the future, so automated moderation and discussion analysis can be added later.

### 1.2 Target Users

The platform is meant for a number of different types of users:

- Website owners and indie developers who need an easy comment system
- Bloggers and content platforms that require community interaction
- Moderators who manage discussions
- Website visitors who participate in comment threads

### 1.3 Core Features

The draft website has these features:

- Home page introducing Komently with a working demo
- Login and sign up pages
- A dashboard page
- A simple documentation page
- A basic AI moderator

---

## 2. Technologies Used

The current draft implementation uses a modern web stack:

| Layer | Technology |
|---|---|
| Frontend Framework | Next.js |
| Hosting Platform | Vercel |
| Backend APIs | Next.js API Routes hosted on Vercel |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Version Control | Git and GitHub |

---

## 3. AI Agent Concept

### 3.1 Problem the AI Agent Will Solve

As websites get bigger, it gets harder to manually moderate comments. A lot of messages can have spam, bad language, or conversations that don't matter.

The planned Komently AI Moderator Agent will automatically look at comments and help moderators find content that is problematic. This will make moderators' jobs easier and keep discussions going.

### 3.2 Type of AI Agent

The AI system will act as a moderator and a helper. It will use natural language processing to look at user comments and sort them into groups based on how toxic, spammy, or relevant they are to the discussion.

### 3.3 User Interaction with the AI Agent

Most of the time, AI processing will happen on its own in the background. The system will send the comment to the AI moderation service when a user submits it.

- If the comment is **safe**, it will be posted right away.
- If it **looks suspicious**, it will be marked for moderator review.

Moderators will be able to talk to the AI through a moderation dashboard, where they can approve or reject comments that have been flagged.

---

## 4. System Architecture

The Komently platform has a simple structure. The Next.js app handles both the front and back ends, and Supabase handles authentication and database services.

### System Flow

1. A user opens the website and uses the comment system through their browser.
2. The Next.js frontend makes requests to API routes that are running on Vercel.
3. The API routes talk to Supabase to store data and verify users.
4. The AI moderator checks the comment and determines its status.

---

## Links

- **GitHub:** https://github.com/emircan-gezer/Komently
- **Live Site:** https://komently.vercel.app/
