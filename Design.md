# Design System Documentation

## 1. Design Philosophy
The design language varies from standard SaaS aesthetics, focusing on a **Premium, Minimalist, and Solid** look. 

- **Minimalism:** Clean layouts, generous whitespace, and focus on content.
- **No Gradients:** The UI relies on solid colors, subtle borders, and varying opacities rather than gradients for depth.
- **Dark Mode First:** The interface is built primarily for dark mode, utilizing deep greys and blacks.
- **Performance:** Animations are CSS-optimized (`will-change`, `transform`) to ensure 60fps performance.

## 2. Color Palette
The color system matches the "No Gradient" solid aesthetic.

## 3. Typography
The typography system uses a modern sans-serif for display and UI text, and a monospace font for technical details.

### Font Families
- **Display / Sans:** `DM Sans` (`--font-display`)
  - Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- **Monospace:** `Geist Mono` (`--font-geist-mono`)

### Usage Hierarchy
- **H1 (Hero):** 4xl - 7xl, Font Medium/Bold, Tracking Tight (`-0.02em`).
- **H2 (Section):** xl - 2xl, Font SemiBold, Tracking Tight.
- **Body:** text-base (16px) or text-lg, Leading Relaxed (`1.75`), Max Width `70ch` for readability.
- **Labels/UI:** Text XS/SM, usually Uppercase with wide tracking for small labels.

## 4. Layout & Spacing
- **Container:** `max-w-7xl` centered for main content.
- **Section Padding:** `py-12 sm:py-16 lg:py-20` (Generous vertical spacing).
- **Horizontal Padding:** `px-4 sm:px-6 md:px-12 lg:px-32` (Responsive gutters).
- **Grid System:** Flexible grids (`grid-cols-1 lg:grid-cols-2`) for feature showcases.

## 5. Components & UI Primitives

### Buttons
Buttons use the `rounded-2xl` shape (approximating squircles) and solid fills.

- **Primary (Hero):** Solid Blue (`#507ABF`), Shadow effects for depth (`shadow-[0_0_20px_var(--mra-shadow-primary-hover)]`).
- **Secondary:** Dark Grey (`#1c1c1c`), Border (`white/10`), Hover lighten (`white/5`).
- **Icon Buttons:** Square `h-10 w-10` or `h-11 w-11`, often used for social/platform links.

### Lists & Groups
- items often grouped in `bg-muted` containers with dividers (`border-b border-border`).
- List items have hover states (`hover:bg-muted/20`).

## 6. Icons
- **Library:** `hugeicons-react` (e.g., `CameraMicrophone01Icon`, `MusicNote01Icon`).
- **Style:** Stroke-based, often sized `w-4 h-4` to `w-6 h-6`.
- **Streaming Icons:** Custom SVG components for Spotify, YouTube, etc.
