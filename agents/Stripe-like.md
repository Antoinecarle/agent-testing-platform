---
name: Stripe-like
description: "Production-ready design system for a minimal-modern, developer-focused payments landing & docs experience — Stripe-like layout and menus, but with a green primary accent (#5DC086). Exposes tokens, components, animations, responsive rules and injection code for pixel‑perfect implementation."
model: claude-opus-4-6
---

Identity & Design DNA
A design system for developer-focused marketing and docs that is minimal, content-first, and engineered for clarity and fast developer comprehension. The system prioritizes readable typography, selectable monospace code, generous rhythm and whitespace, Stripe-like top navigation and "stripe bar" motifs, and a calm green accent (#5DC086) used consistently for CTAs and highlights while meeting accessibility contrast requirements.

- Brand accent and motion: primary accent color set to #5DC086; gradients include linear-gradient(90deg,#4DD47A 0%,#00B4FF 100%) and soft radial overlays; use CSS variables for all accent shades: --accent-100: #EAF9F1; --accent-500: #5DC086; --accent-700: #4AA46E.
- Radii and curvature: border-radius: 16px on large elevated cards, 12px on default cards, 8px on interactive buttons, 6px on small chips, 999px on pills and round avatars.
- Shadows and elevation: surface shadow for cards is 0 6px 20px rgba(10,37,64,0.04); elevated card shadow is 0 12px 40px rgba(10,37,64,0.06); inset focus shadow for inputs is 0 0 0 3px rgba(93,192,134,0.12).
- Borders and separators: default border: 1px solid rgba(10,37,64,0.08); strong border: 1px solid rgba(10,37,64,0.12); divider dashed/soft: 1px solid rgba(10,37,64,0.04).
- Spacing tokens as CSS variables: section spacing uses clamp() tokens (e.g., --space-section: clamp(32px,4.5vw,96px)); card padding is 20px; container padding is clamp(16px,3vw,32px).
- Typographic system: Inter for UI and headings with font weights 400/500/600/700; Roboto Mono for code at 13px–14px; display fonts use clamp() scaling between 40–64px; line-height tokens: 1.05 display, 1.15 headings, 1.5 body, 1.3 captions.
- Grid and responsiveness: 12-column grid with --container-max: 1200px, gutter: 24px; breakpoints: 480px (xs), 640px (sm), 768px (md), 1024px (lg), 1280px (xl).
- Interaction sizes: touch targets minimum 44px x 44px; primary button height 44px; secondary small buttons 36px.
- Accessibility-first rules: body text minimum 16px; body text contrast >= 4.5:1; interactive focus outlines are 2px solid rgba(93,192,134,0.5) with 2px offset; animations respect prefers-reduced-motion.
- Code block affordances: code block background uses rgba(10,37,64,0.04) overlay on surface; copy button is 36px circle with 8px padding and 1px solid rgba(10,37,64,0.06); monospace font-size: 13px; selectable text must copy exactly.

Color System
:root {
  /* Backgrounds (5+) */
  --color-bg-base: #FFFFFF;
  --color-bg-surface: #F6F9FC;
  --color-bg-elevated: #FFFFFF;
  --color-bg-muted: #FBFDFF;
  --color-bg-contrast: #F0F6F4;

  /* Accent / Brand (4+) */
  --color-accent-100: #EAF9F1;
  --color-accent-300: #BFF3D3;
  --color-accent-500: #5DC086; /* primary green chosen by product */
  --color-accent-700: #3EA86C;
  --color-accent-secondary: #00B4FF; /* complementary cyan accent */

  /* Text hierarchy (4+) */
  --color-text-primary: rgba(10,37,64,1);
  --color-text-secondary: rgba(10,37,64,0.85);
  --color-text-muted: rgba(10,37,64,0.60);
  --color-text-on-accent: #FFFFFF;

  /* Borders (3+) */
  --color-border: rgba(10,37,64,0.08);
  --color-border-strong: rgba(10,37,64,0.12);
  --color-divider: rgba(10,37,64,0.04);

  /* Shadows (3+) */
  --shadow-card: 0 6px 20px rgba(10,37,64,0.04);
  --shadow-elevated: 0 12px 40px rgba(10,37,64,0.06);
  --shadow-focus: 0 0 0 3px rgba(93,192,134,0.12);

  /* Gradients (2) */
  --gradient-primary: linear-gradient(90deg, #4DD47A 0%, #00B4FF 100%); /* decorative */
  --gradient-subtle: linear-gradient(180deg, rgba(77,212,122,0.08) 0%, rgba(0,180,255,0.04) 100%);

  /* States (success / error / warning) */
  --color-success: #00D084;
  --color-error: #FF4D5A;
  --color-warning: #FFB020;

  /* Support colors */
  --color-info: #00B4FF;
  --color-on-surface: rgba(10,37,64,0.98);

  /* Utility */
  --opacity-disabled: 0.5;
  --glass-overlay: rgba(255,255,255,0.6);
}

/* Color usage rules (8+ precise rules):
1) Primary backgrounds use --color-bg-base; isolated content surfaces use --color-bg-surface or --color-bg-elevated for cards and panels.
2) Primary CTA backgrounds use --color-accent-500 with text color --color-text-on-accent; CTA hover uses --color-accent-700.
3) Secondary CTAs use transparent background with border: 1px solid --color-border or use --color-accent-secondary for strong emphasis.
4) Success actions use --color-success for badges and small CTAs; pair with a check icon always (do not use color alone).
5) Text hierarchy: headings use --color-text-primary; paragraphs use --color-text-secondary; helper text and timestamps use --color-text-muted.
6) Borders/separators use --color-border; stronger emphasis such as card outlines use --color-border-strong.
7) Gradients are decorative: use --gradient-primary at hero backgrounds or large illustrations only; avoid for micro UI unless marked as campaign variant.
8) Maintain minimum contrast: body text must be >= 4.5:1 against the background; large headings must be >= 3:1. Use --color-text-primary with --color-bg-base for critical copy.
9) Trust band and logos use desaturated logos on --color-bg-surface with 50% opacity unless brand requires full color; ensure 24px vertical padding.
10) Do not rely on color alone for state; add icons and explicit labels for error/success/warning states.
*/

Typography
/* Google Fonts import for Inter (UI) + Roboto Mono (code) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap');

:root {
  /* Font families */
  --font-body: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  --font-mono: "Roboto Mono", SFMono-Regular, Menlo, Monaco, "Courier New", monospace;
  --font-display: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;

  /* Type scale (display 48-72px range inclusive) */
  --text-display: clamp(40px, 6.5vw + 12px, 64px); /* display: clamp(40px, 6.5vw + 12px, 64px) */
  --text-h1: clamp(32px, 4.2vw + 10px, 48px);      /* h1: clamp(32px, 4.2vw + 10px, 48px) */
  --text-h2: clamp(24px, 2.6vw + 8px, 32px);       /* h2: clamp(24px, 2.6vw + 8px, 32px) */
  --text-h3: clamp(20px, 1.6vw + 8px, 24px);       /* h3: clamp(20px, 1.6vw + 8px, 24px) */
  --text-body: 16px;                               /* body 16px */
  --text-caption: 13px;                            /* caption 13px */
  --text-micro: 11px;                              /* micro 11px */

  /* Weight rules */
  --weight-display: 700;   /* display / hero */
  --weight-heading: 600;   /* headings */
  --weight-strong: 600;    /* emphasized body */
  --weight-body: 400;      /* body text */
  --weight-mono: 500;      /* monospace emphasis */

  /* Letter spacing rules */
  --ls-display: -0.02em;
  --ls-heading: -0.01em;
  --ls-body: -0.01em;
  --ls-caps: 0.12em;

  /* Line heights */
  --lh-display: 1.05;
  --lh-heading: 1.15;
  --lh-body: 1.5;
  --lh-caption: 1.3;

  /* Code rules */
  --code-font-size: 13px;
  --code-line-height: 1.45;
  --code-padding: 12px 16px;
  --code-bg: rgba(10,37,64,0.04);
  --code-radius: 8px;
}

/* Typography usage (concrete):
- h1: font: 700 var(--text-h1)/var(--lh-heading) var(--font-display); letter-spacing: var(--ls-heading).
- body: font: 400 16px/1.5 var(--font-body); letter-spacing: var(--ls-body).
- code-inline: font: 500 13px/1.45 var(--font-mono); background: var(--code-bg); padding: 4px 6px; border-radius: 6px.
- code-block: font: 500 var(--code-font-size)/var(--code-line-height) var(--font-mono); background: var(--code-bg); padding: var(--code-padding); border-radius: var(--code-radius).
*/

Layout Architecture
ASCII Wireframe (page-level)
┌─────────────────────────────────────────────────────────────────────────────┐
│ Top Navigation (sticky / 1 row): LOGO | primary links | search | CTAs      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Hero (full-width gradient or surface): left column (headline, subhead, CTAs)│
│                                         right column (illustration/code)   │
│                                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Trust Band / Logos (full-width, 72px height)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Features Grid (3-col desktop, 2-col tablet, 1-col mobile)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Pricing / Comparison (grid or table with sticky header on desktop)         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Docs Section (left nav 220px | content column flexible)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Footer (multi-column)                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

CSS spacing system as tokens (complete)
:root {
  /* Container */
  --container-max: 1200px;
  --container-pad: clamp(16px, 3vw, 32px);

  /* Grid */
  --grid-columns: 12;
  --grid-gutter: 24px;

  /* Section spacing */
  --space-block: clamp(16px, 2.6vw, 40px);
  --space-section: clamp(32px, 4.5vw, 96px);
  --space-hero-vertical: clamp(40px, 6vw, 120px);

  /* Card spacing */
  --card-padding: 20px;
  --card-radius-md: 12px;
  --card-radius-lg: 16px;
  --card-gap: 20px;

  /* Component spacing */
  --nav-height: 72px;
  --trustband-height: 72px;
  --button-height: 44px;
  --button-small-height: 36px;
  --avatar-size: 40px;

  /* Gaps */
  --gap-xs: 8px;
  --gap-sm: 12px;
  --gap-md: 20px;
  --gap-lg: 32px;
  --gap-xl: 48px;
}

Core UI Components
(Note: every CSS block references concrete values and variables defined above.)

### ButtonPrimary
Primary action button used for CTAs.
- Description: Prominent CTA used in hero and important CTAs across marketing and docs.
- Base:
  height: 44px;
  padding: 0 24px;
  background: var(--color-accent-500);
  border-radius: 8px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-width: 96px;
- Text:
  font: 600 14px/1 var(--font-body);
  letter-spacing: 0.01em;
  color: var(--color-text-on-accent);
  text-decoration: none;
- Shadow:
  box-shadow: 0 1px 2px rgba(0,0,0,0.1), 0 0 0 1px rgba(93,192,134,0.06);
- Hover:
  background: #4AA46E; /* 5DC086 darkened 12% => #4AA46E */
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
- Active:
  transform: translateY(0px) scale(0.995);
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
- Focus:
  outline: none;
  box-shadow: var(--shadow-focus);
- Disabled:
  opacity: var(--opacity-disabled);
  pointer-events: none;
- Transition:
  transition: background 0.15s cubic-bezier(0.4,0,0.2,1), transform 0.12s cubic-bezier(0.4,0,0.2,1), box-shadow 0.15s cubic-bezier(0.4,0,0.2,1);
- Variants:
  secondary:
    background: transparent;
    color: var(--color-accent-500);
    border: 1px solid var(--color-border);
    box-shadow: none;
  ghost:
    background: transparent;
    color: var(--color-text-primary);
    border: none;
    padding: 0 12px;
  danger:
    background: var(--color-error);
    color: #FFFFFF;
    box-shadow: 0 6px 20px rgba(255,77,90,0.06);

CSS snippet (ButtonPrimary)
/* Usage: .btn-primary */
.btn-primary {
  height: 44px;
  padding: 0 24px;
  background: var(--color-accent-500);
  border-radius: 8px;
  border: none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:96px;
  cursor:pointer;
  font:600 14px/1 var(--font-body);
  color:var(--color-text-on-accent);
  box-shadow:0 1px 2px rgba(0,0,0,0.1),0 0 0 1px rgba(93,192,134,0.06);
  transition: background 0.15s cubic-bezier(0.4,0,0.2,1), transform 0.12s cubic-bezier(0.4,0,0.2,1), box-shadow 0.15s cubic-bezier(0.4,0,0.2,1);
}
.btn-primary:hover{ background:#4AA46E; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.12); }
.btn-primary:active{ transform:translateY(0) scale(0.995); box-shadow:0 2px 6px rgba(0,0,0,0.08); }
.btn-primary:focus{ outline:none; box-shadow: var(--shadow-focus); }
.btn-primary[disabled]{ opacity:var(--opacity-disabled); pointer-events:none; }

/* Variants */
.btn-primary.secondary{ background:transparent; color:var(--color-accent-500); border:1px solid var(--color-border); box-shadow:none; }
.btn-primary.ghost{ background:transparent; color:var(--color-text-primary); border:none; padding:0 12px; }
.btn-primary.danger{ background:var(--color-error); color:#FFFFFF; box-shadow:0 6px 20px rgba(255,77,90,0.06); }

---

### Top Navigation
Primary site navigation with Stripe-like behavior: left logo, center links, right CTAs + search + auth.
- Description: Sticky navigation height 72px, background: transparent over hero or background: var(--color-bg-base) on scroll; supports center/left links, right-aligned actions, collapse to hamburger at <= 768px.
- Base:
  height: 72px;
  padding: 0 var(--container-pad);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: linear-gradient(180deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.98) 100%);
  border-bottom: 1px solid rgba(10,37,64,0.00);
  position: sticky;
  top: 0;
  z-index: 60;
- Logo:
  max-height: 32px;
  margin-right: 12px;
- Links:
  font: 500 15px/1 var(--font-body);
  color: var(--color-text-primary);
  gap between links: 20px;
- CTA:
  right actions container min-width: 160px;
- Hover:
  link hover color: var(--color-accent-700);
  background for active link: rgba(93,192,134,0.06);
- Mobile:
  collapse breakpoint at 768px to .nav-compact: hamburger (44px circle) with sliding drawer width 320px.
- Focus:
  menu items: outline: 2px solid rgba(93,192,134,0.18);

CSS snippet (Top Navigation)
.top-nav{
  height:72px;
  padding:0 var(--container-pad);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:24px;
  position:sticky;
  top:0;
  z-index:60;
  background:var(--color-bg-base);
  border-bottom:1px solid var(--color-border);
}
.top-nav .nav-links{ display:flex; gap:20px; align-items:center; font:500 15px/1 var(--font-body); color:var(--color-text-primary); }
.top-nav .nav-links a{ padding:8px 10px; border-radius:8px; color:var(--color-text-primary); text-decoration:none; }
.top-nav .nav-links a:hover{ color:var(--color-accent-700); background:rgba(93,192,134,0.04); }
.top-nav .nav-actions{ display:flex; gap:12px; align-items:center; min-width:160px; justify-content:flex-end; }

/* Mobile collapse */
@media (max-width:768px){
  .top-nav .nav-links{ display:none; }
  .top-nav .nav-hamburger{ display:inline-flex; width:44px; height:44px; align-items:center; justify-content:center; border-radius:999px; border:1px solid var(--color-border); background:transparent; }
  .drawer{ position:fixed; top:0; left:0; width:320px; height:100vh; background:var(--color-bg-elevated); box-shadow:0 12px 40px rgba(10,37,64,0.08); transform:translateX(-100%); transition:transform 0.28s cubic-bezier(0.2,0,0,1); }
  .drawer.open{ transform:translateX(0%); }
}

Variants:
- full: logo + links + CTA (default)
- compact: logo + hamburger + CTA (mobile)
- docs: logo + search (width 320px) + version selector (36px) + auth actions

---

### Hero
Two-column hero with left content and right illustration or live code.
- Description: headline, subhead, primary + secondary CTAs; supports gradient or surface background; stripe bar overlay under headline (subtle diagonal pattern).
- Base:
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 24px;
  padding: var(--space-hero-vertical) var(--container-pad);
  align-items: center;
  min-height: 520px;
  background: var(--gradient-primary); /* campaign/marketing variant */
  color: var(--color-text-on-accent);
- Left:
  grid-column: 1 / span 7;
  max-width: 680px;
  headline font: 700 var(--text-display)/var(--lh-display) var(--font-display);
  headline color: #FFFFFF;
  subhead font: 500 20px/1.45 var(--font-body);
  CTAs: primary .btn-primary (white text), secondary .btn-primary.secondary (transparent)
- Right:
  grid-column: 8 / span 5;
  an illustration container with background: rgba(255,255,255,0.06), border-radius: 12px, padding: 24px, height: 360px, display:flex, align-items:center, justify-content:center.
- Stripe bar effect:
  an absolutely positioned pseudo-element under the headline:
  background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.00) 8px, rgba(255,255,255,0.00) 16px);
  height: 36px;
  width: 100%;
  transform: translateY(12px);
  opacity: 0.45;
- Responsive:
  at max-width 1024px: grid-column adjustments grid-column-left: 1 / span 12; right flows below content; padding reduced to clamp values.
- Hover micro-interaction:
  code sample in hero uses .card with transform: translateY(-6px) on hover; transition 200ms.

CSS snippet (Hero)
.hero{
  display:grid;
  grid-template-columns: repeat(12,1fr);
  gap:24px;
  padding: var(--space-hero-vertical) var(--container-pad);
  align-items:center;
  min-height:520px;
  background:var(--gradient-primary);
  color:var(--color-text-on-accent);
  position:relative;
}
.hero .left{ grid-column:1 / span 7; max-width:680px; }
.hero .headline{ font:700 var(--text-display)/var(--lh-display) var(--font-display); letter-spacing:var(--ls-display); margin:0 0 12px 0; color:#FFFFFF; }
.hero .stripe-bar{
  position:absolute; left:var(--container-pad); top:calc(var(--space-hero-vertical) + 84px);
  width:calc(100% - (var(--container-pad) * 2)); height:36px;
  background-image:repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.00) 8px, rgba(255,255,255,0.00) 16px);
  opacity:0.45; transform:translateY(12px); pointer-events:none;
}
.hero .right{ grid-column:8 / span 5; background:rgba(255,255,255,0.06); border-radius:12px; padding:24px; height:360px; display:flex; align-items:center; justify-content:center; }

@media (max-width:1024px){
  .hero{ grid-template-columns: repeat(6,1fr); min-height:420px; }
  .hero .left{ grid-column:1 / span 6; }
  .hero .right{ grid-column:1 / span 6; margin-top:16px; height:300px; }
}

Variants:
- marketing: background uses --gradient-primary and white headline text.
- technical: background uses var(--color-bg-surface); right column contains code sample card with editable demo.
- campaign: full-bleed gradient with stronger stripe overlay (opacity 0.7).

---

### Feature Card
Compact card for product features, hover lift and consistent padding.
- Description: Icon or illustration, title, short description, optional CTA.
- Base:
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-height: 120px;
  box-shadow: var(--shadow-card);
- Title:
  font: 600 16px/1.15 var(--font-body);
  color: var(--color-text-primary);
- Body:
  font: 400 14px/1.45 var(--font-body);
  color: var(--color-text-secondary);
- Icon:
  size 36px; background: var(--color-accent-100); border-radius: 8px; display:flex; align-items:center; justify-content:center;
- Hover:
  transform: translateY(-6px);
  box-shadow: 0 12px 30px rgba(10,37,64,0.06);
  border: 1px solid var(--color-border-strong);
- Active:
  transform: translateY(-2px);
- Focus:
  box-shadow: var(--shadow-focus);
- Transition:
  transition: transform 0.2s cubic-bezier(0.2,0,0,1), box-shadow 0.2s cubic-bezier(0.2,0,0,1), border 0.15s linear;
- Variants:
  compact: height 72px; flex-direction: row; icon left with 12px gap.
  highlighted: border-color: rgba(93,192,134,0.18); background: linear-gradient(180deg, rgba(77,212,122,0.04) 0%, rgba(0,180,255,0.02) 100%);
  icon-left: icon width 44px, margin-right: 12px.

CSS snippet (Feature Card)
.feature-card{
  background:var(--color-bg-elevated);
  border:1px solid var(--color-border);
  border-radius:12px;
  padding:20px;
  display:flex;
  flex-direction:column;
  gap:12px;
  min-height:120px;
  box-shadow:var(--shadow-card);
  transition: transform 0.2s cubic-bezier(0.2,0,0,1), box-shadow 0.2s cubic-bezier(0.2,0,0,1), border 0.15s linear;
}
.feature-card:hover{ transform:translateY(-6px); box-shadow:0 12px 30px rgba(10,37,64,0.06); border:1px solid var(--color-border-strong); }
.feature-card:active{ transform:translateY(-2px); }
.feature-card:focus{ box-shadow:var(--shadow-focus); outline:none; }
.feature-card .icon{ width:36px; height:36px; border-radius:8px; background:var(--color-accent-100); display:flex; align-items:center; justify-content:center; }

.feature-card.compact{ flex-direction:row; align-items:center; height:72px; }
.feature-card.highlighted{ border-color:rgba(93,192,134,0.18); background:linear-gradient(180deg, rgba(77,212,122,0.04) 0%, rgba(0,180,255,0.02) 100%); }

---

### PricingCard / Comparison
Responsive pricing card with highlight and accessible table variant.
- Description: Card-driven pricing grid with emphasis on a primary plan and comparable features.
- Base card:
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 24px;
  display:flex;
  flex-direction:column;
  gap:16px;
  width:100%;
  box-shadow: var(--shadow-card);
- Price:
  font: 700 28px/1 var(--font-display);
  color: var(--color-text-primary);
- CTA:
  .btn-primary full width for selected plan; outline for other.
- Highlight:
  emphasized plan uses border: 1px solid rgba(93,192,134,0.18), box-shadow: var(--shadow-elevated);
- Table variant:
  table header sticky at top with background var(--color-bg-surface); header height 56px; border-bottom: 1px solid var(--color-border);
- Accessibility:
  keyboard focus on rows: background: rgba(10,37,64,0.02); aria-selected states announced.
- Responsive:
  grid layout: 3 columns >= 1024px; 2 columns >= 768px; 1 column < 640px.

CSS snippet (Pricing Card)
.pricing-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; }
@media (max-width:1024px){ .pricing-grid{ grid-template-columns: repeat(2, 1fr); } }
@media (max-width:768px){ .pricing-grid{ grid-template-columns: 1fr; } }

.pricing-card{ background:var(--color-bg-elevated); border:1px solid var(--color-border); border-radius:16px; padding:24px; box-shadow:var(--shadow-card); display:flex; flex-direction:column; gap:16px; }
.pricing-card.highlight{ border:1px solid rgba(93,192,134,0.18); box-shadow:var(--shadow-elevated); transform:translateY(-6px); }

.table-pricing{ width:100%; border-collapse:collapse; }
.table-pricing thead th{ position:sticky; top:0; height:56px; background:var(--color-bg-surface); border-bottom:1px solid var(--color-border); font:600 14px/1 var(--font-body); text-align:left; padding:12px 16px; }

---

### CodeSnippet (block)
Selectable monospace code block with language label, copy button, and optional run toggle.
- Description: Multi-line code block with line numbers optional, copy button, language pill, and minimal syntax highlighting.
- Base:
  background: var(--code-bg);
  border-radius: 8px;
  padding: 12px 16px;
  font: 500 13px/1.45 var(--font-mono);
  color: var(--color-text-primary);
  overflow:auto;
  position:relative;
  tab-index:0;
- Language pill:
  position:absolute; top:12px; right:12px; height:28px; padding:0 10px; display:inline-flex; align-items:center; justify-content:center; font:500 12px/1 var(--font-body); background: rgba(10,37,64,0.06); border-radius:6px; color:var(--color-text-muted);
- Copy button:
  position:absolute; top:12px; right:52px; width:36px; height:36px; border-radius:18px; background:#FFFFFF; border:1px solid rgba(10,37,64,0.06); display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 8px rgba(10,37,64,0.04);
- Hover:
  copy button hover background: #F0F6F4; transform:translateY(-1px);
- Focus:
  code block focus outline: none; box-shadow: var(--shadow-focus);
- Transition:
  all interactive controls transition: all 0.12s ease;
- Variants:
  inline: display:inline-block; padding:4px 6px; border-radius:6px;
  interactive: editable content-editable true; run button shown (44px square) with background var(--color-accent-secondary).

CSS snippet (CodeSnippet)
.code-block{
  background:var(--code-bg);
  border-radius:8px;
  padding:12px 16px;
  font:500 13px/1.45 var(--font-mono);
  color:var(--color-text-primary);
  overflow:auto;
  position:relative;
  outline:none;
}
.code-block .lang-pill{ position:absolute; top:12px; right:12px; height:28px; padding:0 10px; display:inline-flex; align-items:center; justify-content:center; background:rgba(10,37,64,0.06); border-radius:6px; font:500 12px/1 var(--font-body); color:var(--color-text-muted); }
.code-block .copy-btn{ position:absolute; top:12px; right:52px; width:36px; height:36px; border-radius:18px; background:#FFFFFF; border:1px solid rgba(10,37,64,0.06); box-shadow:0 2px 8px rgba(10,37,64,0.04); display:flex; align-items:center; justify-content:center; cursor:pointer; transition: all 0.12s ease; }
.code-block .copy-btn:hover{ background:#F0F6F4; transform:translateY(-1px); }

---

### Form / Input
Labeled inputs with clear states and validation.
- Description: Single-line inputs, selects, toggles, grouped fields; auth variants and inline search.
- Base input:
  height: 44px;
  padding: 12px 14px;
  background: #FFFFFF;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  font: 400 16px/1.5 var(--font-body);
  color: var(--color-text-primary);
- Placeholder:
  color: var(--color-text-muted);
  font-style: normal;
- Focus:
  border-color: rgba(93,192,134,0.22);
  box-shadow: var(--shadow-focus);
  outline: none;
- Error:
  border-color: var(--color-error);
  icon + text color: var(--color-error);
  message font: 13px/1.3 var(--font-body); margin-top:6px;
- Success:
  border-color: var(--color-success);
  message color: var(--color-success);
- Disabled:
  background: rgba(10,37,64,0.02);
  pointer-events: none;
  opacity: 0.6;
- Transition:
  transition: border-color 0.15s cubic-bezier(0.4,0,0.2,1), box-shadow 0.15s cubic-bezier(0.4,0,0.2,1);
- Variants:
  search-inline: width: 320px; icon left 40px padding; button integrated to right 44px.
  auth: stacked label + input with hint text 13px.

CSS snippet (Form Input)
.form-field{ display:flex; flex-direction:column; gap:8px; }
.input{ height:44px; padding:12px 14px; background:#FFFFFF; border:1px solid var(--color-border); border-radius:12px; font:400 16px/1.5 var(--font-body); color:var(--color-text-primary); transition: border-color 0.15s cubic-bezier(0.4,0,0.2,1), box-shadow 0.15s cubic-bezier(0.4,0,0.2,1); }
.input::placeholder{ color:var(--color-text-muted); }
.input:focus{ border-color:rgba(93,192,134,0.22); box-shadow:var(--shadow-focus); outline:none; }
.input.error{ border-color:var(--color-error); }
.input.success{ border-color:var(--color-success); }

---

### Footer
Multi-column footer with neutral surface background and legal text.
- Description: Full-width footer with product links, developer resources, legal copy, region selector and compact trust area.
- Base:
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  padding: 40px var(--container-pad);
  display:grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
  border-top: 1px solid var(--color-border);
- Legal:
  font: 400 13px/1.6 var(--font-body);
  color: var(--color-text-muted);
- Compact variant:
  padding: 20px var(--container-pad); grid-template-columns: 1fr;
  align-items:center;
- Links:
  link hover underline: text-decoration: underline 2px solid; color: var(--color-text-primary).

CSS snippet (Footer)
.footer{ background:var(--color-bg-surface); color:var(--color-text-secondary); padding:40px var(--container-pad); display:grid; grid-template-columns:1fr 1fr 1fr; gap:24px; border-top:1px solid var(--color-border); font:400 13px/1.6 var(--font-body); }
.footer a{ color:var(--color-text-secondary); text-decoration:none; }
.footer a:hover{ color:var(--color-text-primary); text-decoration:underline 2px solid var(--color-accent-500); }

---

### Trust Band
Full-width band for partner logos and certificates.
- Description: Horizontal band with evenly spaced logos; each logo desaturated to 50% opacity unless brand requires full color.
- Base:
  height: 72px;
  padding: 16px var(--container-pad);
  background: var(--color-bg-base);
  display:flex;
  align-items:center;
  justify-content:center;
  gap: 32px;
  border-top: 1px solid var(--color-divider);
  border-bottom: 1px solid var(--color-divider);
- Logo:
  max-height: 36px;
  opacity: 0.6;
  filter: grayscale(60%) saturate(60%);
- Hover:
  logo opacity: 1; transform: translateY(-2px);
- Responsive:
  at max-width 640px: logos become horizontally scrollable with gap 16px and padding-left 20px.

CSS snippet (Trust Band)
.trust-band{ height:72px; padding:16px var(--container-pad); background:var(--color-bg-base); display:flex; align-items:center; justify-content:center; gap:32px; border-top:1px solid var(--color-divider); border-bottom:1px solid var(--color-divider); }
.trust-band img{ max-height:36px; opacity:0.6; filter:grayscale(60%) saturate(60%); transition: all 0.12s ease; }
.trust-band img:hover{ opacity:1; transform:translateY(-2px); }

---

### Illustration / Icon System
Two-tone icons that use accent for emphasis and text-primary for strokes.
- Description: Static SVG icons and small animated SVG entrance variants.
- Base icon:
  width: 36px; height: 36px;
  fill: var(--color-accent-500);
  stroke: var(--color-text-primary);
  stroke-width: 1.5;
  border-radius: 6px;
- Animated:
  entrance animation: transform: translateY(8px) → 0; opacity 0 → 1; duration 420ms; ease-out.
- Variants:
  static: no animation.
  animated: uses CSS keyframe fade-up on load or IntersectionObserver-triggered reveal.

CSS snippet (Icons)
.icon{ width:36px; height:36px; display:inline-block; fill:var(--color-accent-500); stroke:var(--color-text-primary); stroke-width:1.5; border-radius:6px; }
.icon.animated{ animation:fadeUp 420ms cubic-bezier(0.22,1,0.36,1) both; }

Animation Patterns
Technology choice: Native CSS for UI micro-interactions + IntersectionObserver for scroll reveals. Optional JS for typing demos. All transitions respect prefers-reduced-motion.

1) fadeUp (entrance)
@keyframes fadeUp {
  0% { transform: translateY(16px); opacity: 0; }
  100% { transform: translateY(0px); opacity: 1; }
}

2) fadeUp-slow (staggerable)
@keyframes fadeUp-slow {
  0% { transform: translateY(12px); opacity: 0; }
  60% { opacity: 0.5; }
  100% { transform: translateY(0px); opacity: 1; }
}

3) cardLift (hover micro-interaction)
@keyframes cardLift {
  0% { transform: translateY(0px); box-shadow: 0 6px 20px rgba(10,37,64,0.04); }
  100% { transform: translateY(-6px); box-shadow: 0 12px 30px rgba(10,37,64,0.06); }
}

4) buttonPress
@keyframes buttonPress {
  0% { transform: scale(1); }
  50% { transform: scale(0.98); }
  100% { transform: scale(1); }
}

5) spinner (loading)
@keyframes spinner {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* CSS for spinner */
.spinner{
  width:28px; height:28px; border-radius:50%; border:3px solid rgba(10,37,64,0.08); border-top-color:var(--color-accent-500); animation: spinner 820ms linear infinite;
}

6) typing demo (JS + CSS caret)
@keyframes blinkCaret {
  0%,100% { opacity: 1; }
  50% { opacity: 0; }
}

.typing-cursor{
  display:inline-block;
  width:2px; height:1em; background:var(--color-text-primary); margin-left:6px; animation: blinkCaret 800ms steps(1) infinite;
}

/* JS: IntersectionObserver for scroll reveal (staggered children) */
const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      const el = entry.target;
      const children = Array.from(el.querySelectorAll('[data-reveal]'));
      children.forEach((child, i) => {
        child.style.animation = `fadeUp-slow 420ms cubic-bezier(0.22,1,0.36,1) both`;
        child.style.animationDelay = `${i * 70}ms`;
      });
      observer.unobserve(el);
    }
  });
}, { root: null, rootMargin: '0px', threshold: 0.12 });

/* Typing effect JS that respects prefers-reduced-motion and allows pause/resume */
function typeText(el, text, speed = 42) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced) { el.textContent = text; return; }
  el.textContent = '';
  let i = 0;
  const t = setInterval(() => {
    el.textContent += text.charAt(i);
    i++;
    if(i >= text.length) { clearInterval(t); }
  }, speed);
}

/* Simple stagger helper for code sample reveal (vanilla JS) */
function staggerReveal(containerSelector, childSelector, delay = 80) {
  const container = document.querySelector(containerSelector);
  if(!container) return;
  const children = container.querySelectorAll(childSelector);
  children.forEach((c, i) => {
    c.style.opacity = '0';
    c.style.transform = 'translateY(12px)';
    setTimeout(() => {
      c.style.transition = `all 420ms cubic-bezier(0.22,1,0.36,1)`;
      c.style.opacity = '1';
      c.style.transform = 'translateY(0px)';
    }, i * delay);
  });
}

Style Injection Pattern
Unique styleId: minimal-modern-styles-v1

const STYLE_ID = 'minimal-modern-styles-v1';

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const sheet = document.createElement('style');
  sheet.id = STYLE_ID;
  sheet.type = 'text/css';
  sheet.textContent = `
    /* Minimal-Modern Design System (inlined critical tokens & base rules) */
    :root{
      --color-bg-base: #FFFFFF;
      --color-bg-surface: #F6F9FC;
      --color-bg-elevated: #FFFFFF;
      --color-bg-muted: #FBFDFF;
      --color-bg-contrast: #F0F6F4;
      --color-accent-100: #EAF9F1;
      --color-accent-300: #BFF3D3;
      --color-accent-500: #5DC086;
      --color-accent-700: #3EA86C;
      --color-accent-secondary: #00B4FF;
      --color-text-primary: rgba(10,37,64,1);
      --color-text-secondary: rgba(10,37,64,0.85);
      --color-text-muted: rgba(10,37,64,0.60);
      --color-text-on-accent: #FFFFFF;
      --color-border: rgba(10,37,64,0.08);
      --color-border-strong: rgba(10,37,64,0.12);
      --color-divider: rgba(10,37,64,0.04);
      --shadow-card: 0 6px 20px rgba(10,37,64,0.04);
      --shadow-elevated: 0 12px 40px rgba(10,37,64,0.06);
      --shadow-focus: 0 0 0 3px rgba(93,192,134,0.12);
      --gradient-primary: linear-gradient(90deg, #4DD47A 0%, #00B4FF 100%);
      --gradient-subtle: linear-gradient(180deg, rgba(77,212,122,0.08) 0%, rgba(0,180,255,0.04) 100%);
      --color-success: #00D084;
      --color-error: #FF4D5A;
      --color-warning: #FFB020;
      --container-max: 1200px;
      --container-pad: clamp(16px,3vw,32px);
      --space-block: clamp(16px,2.6vw,40px);
      --space-section: clamp(32px,4.5vw,96px);
      --space-hero-vertical: clamp(40px,6vw,120px);
      --card-padding: 20px;
      --card-radius-md: 12px;
      --card-radius-lg: 16px;
      --nav-height: 72px;
      --button-height: 44px;
      --button-small-height: 36px;
      --gap-md: 20px;
    }
    /* Basic reset */
    html,body{ margin:0; padding:0; background:var(--color-bg-base); color:var(--color-text-primary); font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; font-size:16px; line-height:1.5; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
    a{ color:var(--color-accent-500); text-decoration:none; }
    a:hover{ text-decoration:underline; }
    .container{ max-width:var(--container-max); margin:0 auto; padding:0 var(--container-pad); box-sizing:border-box; }
  `;
  document.head.appendChild(sheet);
}

Section Templates
Provide at least 5 section wireframes with spacing and responsive notes.

### 1) Hero (marketing) — wireframe
┌─────────────────────────────────────────────────────────────────────────────┐
│ Top Navigation (height: 72px, padding: 0 var(--container-pad))               │
├─────────────────────────────────────────────────────────────────────────────┤
│ HERO (padding: var(--space-hero-vertical) var(--container-pad))             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ LEFT (grid-col 1-7)                                                     │ │
│ │  - Headline (font: 700 var(--text-display))                             │ │
│ │  - Subhead (font: 500 20px)                                             │ │
│ │  - CTA Row (gap: 12px) [Primary(.btn-primary) + Secondary]              │ │
│ │  - Stripe bar (absolute, height:36px, repeating-linear-gradient)        │ │
│ │ RIGHT (grid-col 8-12)                                                   │ │
│ │  - Illustration or code card (padding:24px; border-radius:12px)         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
Internal spacing values:
- hero padding vertical: var(--space-hero-vertical)
- between columns: 24px
Responsive behavior:
- <= 1024px: single column stacking; right column flows below left with margin-top:16px
- <= 768px: headline size clamps to smaller value; CTAs stack vertically with gap:12px

### 2) Trust Band (logos)
┌─────────────────────────────────────────────────────────────────────────────┐
│ TRUST BAND (height: 72px; padding: 16px var(--container-pad))              │
│  [logo 1]  [logo 2]  [logo 3]  [logo 4]  [logo 5]  (gap: 32px)             │
└─────────────────────────────────────────────────────────────────────────────┘
Internal spacing:
- vertical padding: 16px
- logo max-height: 36px
Responsive:
- <= 640px: horizontal scrollable list with padding-left: 20px; gap:16px; each logo padding: 8px

### 3) Features Grid
┌─────────────────────────────────────────────────────────────────────────────┐
│ FEATURES (padding: var(--space-section) var(--container-pad))             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Grid container: gap: var(--gap-md)                                  │  │
│  │ Desktop: 3 columns (repeat(3,1fr)); Tablet: 2 columns; Mobile: 1col │  │
│  │ Card: .feature-card (padding:20px; border-radius:12px)              │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
Internal spacing:
- grid gap: 20px
Responsive:
- >= 1024px: 3 columns
- 768px–1023px: 2 columns
- <= 767px: 1 column, full-width cards

### 4) Pricing / Comparison
┌─────────────────────────────────────────────────────────────────────────────┐
│ PRICING (padding: var(--space-section) var(--container-pad))              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Grid of pricing cards (3-up desktop) or table with sticky header   │  │
│  │ Highlighted primary plan: border: rgba(93,192,134,0.18)            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
Internal spacing:
- card padding: 24px
Responsive:
- >= 1024px: grid-template-columns: repeat(3,1fr)
- 768–1023px: repeat(2,1fr)
- <= 767px: stack 1 per row; CTA full-width

### 5) Docs Layout (Stripe-like left nav)
┌─────────────────────────────────────────────────────────────────────────────┐
│ DOCS HEADER (search + version selector + auth actions) (height:72px)       │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌───────────────────────────────────────────────────────┐  │
│ │ Left Nav     │ │ Content Area                                           │  │
│ │ width: 240px │ │ max-width: 880px; padding: var(--container-pad)       │  │
│ │ (sticky)     │ │ - h1, body, code blocks, inline snippets             │  │
│ └──────────────┘ └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
Internal spacing:
- left nav padding: 20px; width: 240px; sticky top: var(--nav-height)
Responsive:
- <= 1024px: left nav collapses to top accordion; content full width
- <= 640px: search becomes icon-only in top nav; code blocks full-width with horizontal scroll

Responsive Strategy & Quality Checklist
Breakpoints (concrete):
- xs: 480px — base mobile adjustments (font-size scaling, container padding reduced)
- sm: 640px — small phones / large phones (trust band scroll mode)
- md: 768px — tablets; nav collapses to hamburger; 2-column grids become single-column for content
- lg: 1024px — desktop small; hero switches to two-column if viewport >= 1024px
- xl: 1280px — wide screens; container max-width remains 1200px; hero has max-width constraint

Specific changes per breakpoint:
- <= 480px:
  * font-size: root font-size remains 16px but heading clamps reduce (h1 uses lower bound of clamp)
  * container padding: 12px
  * nav height: 64px
  * CTAs stack vertically: gap 12px
- 481–640px:
  * trust band becomes horizontally scrollable
  * feature grid: 1 column
- 641–767px:
  * feature grid: 2 columns
  * left nav in docs collapses to top accordion (width: 100%)
- 768–1023px:
  * nav: show compact menu; hamburger visible
  * hero: right illustration scales to height 300px
- >= 1024px:
  * 3-column features grid
  * hero: two-column layout (left 7/12, right 5/12)
  * pricing grid: 3 columns

Mobile-specific overrides (explicit CSS tokens):
:root {
  --container-pad-mobile: 12px;
  --nav-height-mobile: 64px;
  --button-height-mobile: 44px;
  --hero-min-height-mobile: 420px;
}
@media (max-width:480px){
  .container{ padding:0 var(--container-pad-mobile); }
  .top-nav{ height:var(--nav-height-mobile); padding:0 12px; }
  .hero{ min-height:var(--hero-min-height-mobile); padding:28px 12px; }
  .btn-primary{ height:44px; padding:0 16px; }
  .feature-card{ padding:16px; }
}

Reduced motion rules:
- Query: @media (prefers-reduced-motion: reduce)
- Effects:
  * All animations: animation-duration set to 0.001ms; transition-duration set to 0ms.
  * JS typing demos: instantly render final text.
  * IntersectionObserver reveals: disable animation and set elements to opacity:1; transform:none.
Concrete CSS:
@media (prefers-reduced-motion: reduce){
  * { animation-duration: 0.001ms !important; animation-delay: 0ms !important; transition-duration: 0ms !important; scroll-behavior: auto !important; }
}

Quality Checklist (12+ items)
- [ ] All body text uses font-size >= 16px (body = 16px).
- [ ] Headings use clamp() scaling to remain legible across viewports.
- [ ] Primary CTAs use --color-accent-500 (#5DC086) with white text.
- [ ] Secondary CTAs have 1px border (var(--color-border)) and accessible contrast.
- [ ] All interactive elements have visible focus states (box-shadow: var(--shadow-focus) or 2px outline).
- [ ] Minimum touch target size is 44x44px for tappable items.
- [ ] Code blocks use monospace at 13px and include copy affordance button (36px).
- [ ] Stripe bar effect implemented as repeaing-linear-gradient overlay with opacity <= 0.5.
- [ ] Trust band logos are desaturated to 60% opacity by default; full color on hover only.
- [ ] Card hover lift limited to translateY(-6px) and shadow <= 0 12px 40px rgba(10,37,64,0.06).
- [ ] No drop shadows exceeding 0 20px 80px anywhere.
- [ ] All text meets WCAG AA contrast ratio: body >= 4.5:1 (var(--color-text-primary) on --color-bg-base).
- [ ] State colors always paired with icon or label (no color-only states).
- [ ] Animations respect prefers-reduced-motion and are minimal by default.
- [ ] Nav behavior replicates Stripe-like collapse: center links on desktop, hamburger at <= 768px, sticky nav with subtle background change on scroll.
- [ ] Grid system is 12-column with gutters of 24px and container max-width 1200px.
- [ ] Pricing table headers sticky: height 56px and visible keyboard focus for rows.
- [ ] Copy-to-clipboard interaction announces via aria-live region when copy successful.

Additional Implementation Notes
- All pixel values, shadows, radii, borders, type sizes and spacing are concrete CSS tokens — use these tokens directly in component styles for consistency.
- Use IntersectionObserver pattern above for scroll-triggered reveals. Ensure a fallback where JS is unavailable by setting reveal elements to opacity:1 and transform:none in CSS.
- Maintain consistent border radii: 12px default card radius, 16px for large cards, 8px for buttons, 6px for small chips or inline code.
- For gradient breakdowns when darkening/brightening color-accent-500, use explicit hex values (#4AA46E for hover; #3EA86C for active). Do not compute color via HSL in CSS during runtime.
- Export tokens as JSON when integrating with design tooling: colors, spacing, radii, type scale variables.

End of file.