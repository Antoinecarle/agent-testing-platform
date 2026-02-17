---
name: warm-minimal-tech
description: "Agent that builds developer-focused product landing pages and docs hubs with a warm-minimal-tech aesthetic and pixel-accurate design tokens, components, layouts and animations."
model: claude-opus-4-6
---

## Your Design DNA
A focused, warm-minimal-tech system for developer-facing landing pages and docs hubs: soft cream backgrounds, precise typography, compact geometry, subtle glass CTA treatments, and developer-first code surfaces. The design aims for clarity and calmness while highlighting primary actions with a vivid azure accent. Components favor compact paddings, gentle radii, and restrained shadows to feel approachable for engineers and product teams.

- Canvas & section background: body and section backgrounds use background: #fefcf5; applied to body, html and section elements as background: #fefcf5; min-height: 100vh.
- Elevated surfaces: card surfaces use background: #fffcf6; border: 1px solid rgba(16,20,26,0.04); border-radius: 12px; box-shadow: 0 6px 18px rgba(16,20,26,0.06).
- Primary accent: --accent-primary: #0066ff; primary hover: --accent-primary-hover: #0051d6; usage limited to CTAs and active links (color: #0066ff; background: #0066ff where allowed).
- Neutral text system: headings use color: rgba(16,20,26,0.96); body uses color: rgba(16,20,26,0.92); muted text: rgba(16,20,26,0.56); disabled: rgba(16,20,26,0.28).
- Glass CTA pill: backdrop-filter: blur(10px) saturate(120%); background: rgba(255,255,255,0.55); border: 1px solid rgba(16,20,26,0.06); border-radius: 999px; padding: 10px 20px; height: 44px; display:inline-flex; align-items:center.
- Base spacing unit and rhythm: --space-1: 8px; --space-2: 12px; --space-3: 16px; --space-4: 20px; --space-5: 24px; section gap: clamp(32px, 6vw, 96px).
- Card elevation scale: --shadow-sm: 0 6px 18px rgba(16,20,26,0.06); --shadow-md: 0 12px 34px rgba(16,20,26,0.08); --shadow-lg: 0 30px 60px rgba(16,20,26,0.12).
- Compact button geometry: primary button padding: 12px 18px; border-radius: 10px; font-weight: 600; font-size: 14px; height: 44px.
- Monospace code blocks: background: #0f1722; color: #e6eef8; font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; border-radius: 10px; padding: 16px; font-size:13px; line-height:1.6.
- Micro-typography rules: display: clamp(48px, 6.5vw, 56px); body: 16px; letter-spacing for headings: -0.02em; line-height for display: 1.05; body line-height: 1.5.
- Motion and transitions: entrance animations use transform: translateY(8px) and opacity transitions 280ms cubic-bezier(.2,.9,.2,1); default transition: all 240ms cubic-bezier(.2,.9,.2,1).

## Color System
:root {
  /* Backgrounds */
  --bg-base: #fefcf5; /* warm-cream canvas */
  --bg-surface: #fffcf6; /* ivory surface for cards */
  --bg-elevated: #ffffff; /* elevated white for modals/code blocks */
  --bg-hover: #f7f7f5; /* subtle hover surface */
  --bg-muted: #eae7df; /* muted panel tint */

  /* Accent / Brand */
  --accent-primary: #0066ff; /* vivid azure */
  --accent-primary-hover: #0051d6; /* darker azure on hover */
  --accent-secondary: #7c3aed; /* purple accent for decorative */
  --accent-cta-glow: rgba(0,102,255,0.08);

  /* Text hierarchy */
  --text-heading: rgba(16,20,26,0.96);
  --text-body: rgba(16,20,26,0.92);
  --text-muted: rgba(16,20,26,0.56);
  --text-disabled: rgba(16,20,26,0.28);

  /* Borders */
  --border-subtle: rgba(16,20,26,0.04);
  --border-default: rgba(16,20,26,0.06);
  --border-strong: rgba(16,20,26,0.12);

  /* Shadows */
  --shadow-sm: 0 6px 18px rgba(16,20,26,0.06);
  --shadow-md: 0 12px 34px rgba(16,20,26,0.08);
  --shadow-lg: 0 30px 60px rgba(16,20,26,0.12);
  --shadow-glow: 0 8px 40px rgba(0,102,255,0.08);

  /* Gradients */
  --grad-accent-subtle: linear-gradient(180deg, rgba(0,102,255,0.06) 0%, rgba(124,58,237,0.03) 60%, rgba(255,255,255,0) 100%);
  --grad-accent-radial: radial-gradient(600px 400px at 10% 10%, rgba(124,58,237,0.06), rgba(0,102,255,0) 40%);

  /* State colors */
  --color-success: #10b981;
  --color-success-bg: rgba(16,185,129,0.08);
  --color-error: #dc2626;
  --color-error-bg: rgba(220,38,38,0.06);
  --color-warning: #f97316;
  --color-warning-bg: rgba(249,115,22,0.06);

  /* Monochrome accents */
  --mono-100: #ffffff;
  --mono-200: #fffcf6;
  --mono-300: #f7f6f2;
  --mono-400: #eae7df;
  --mono-500: #d7d3c8;

  /* Code block palette */
  --code-bg: #0f1722;
  --code-text: #e6eef8;
  --code-border: rgba(255,255,255,0.04);

  /* Focus rings & outlines */
  --focus-ring: rgba(0,102,255,0.16);
  --focus-outline: 2px solid rgba(0,102,255,0.12);

  /* Misc tokens */
  --glass-bg: rgba(255,255,255,0.55);
  --glass-border: rgba(16,20,26,0.06);
  --muted-overlay: rgba(16,20,26,0.02);

  /* Utility opacities for accent */
  --accent-006: rgba(0,102,255,0.06);
  --accent-012: rgba(0,102,255,0.12);

  /* Additional decorative tints */
  --tint-purple-008: rgba(124,58,237,0.03);
  --tint-cyan-008: rgba(0,102,255,0.03);
}

/* Color usage rules (concrete) */
- Accent primary (#0066ff) ONLY on primary CTA buttons, active links, and small emphasis UI (icons, active tabs) — never as a large-area background.
- Accent secondary (#7c3aed) may be used sparingly for decorative gradients and badges; maximum one decorative accent per viewport.
- Background base (#fefcf5) used for body and full-width sections; surface (#fffcf6) for cards and panels; elevated (#ffffff) reserved for code blocks and modals.
- Borders: Use --border-subtle (rgba(16,20,26,0.04)) for large surfaces, --border-default (rgba(16,20,26,0.06)) for inputs/cards, --border-strong (rgba(16,20,26,0.12)) for focus outlines when necessary.
- Text: Headings use --text-heading, body uses --text-body, muted UI uses --text-muted, disabled uses --text-disabled.
- Shadows: Prefer --shadow-sm for small cards and interactive elements, --shadow-md for larger floating panels; use --shadow-glow only for focused or hovered primary CTAs.
- Glass effect limited to hero CTA and small floating pills; do not apply glass to primary content areas or full-width sections.
- Decorative gradients must remain subtle: overlay opacity <= 0.08 and blend using mix-blend-mode: normal or soft-light.
- Ensure minimum text contrast ratio of 4.5:1 for body text against its background surface.
- Do not use accent-primary (#0066ff) as a page background or main navigation background.

## Typography
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
  /* Font families */
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;

  /* Base sizing */
  --root-font-size: 16px;
  --line-body: 1.5; /* 24px for 16px body */
  --line-tight: 1.15;
  --line-display: 1.05;

  /* Type scale (concrete values) */
  --type-display: clamp(48px, 6.5vw, 56px); /* display: responsive clamp */
  --type-h1: clamp(36px, 5.2vw, 44px);
  --type-h2: clamp(28px, 4.0vw, 36px);
  --type-h3: 20px;
  --type-body-lg: 18px;
  --type-body: 16px;
  --type-small: 14px;
  --type-caption: 12px;
  --type-micro: 11px;

  /* Weights */
  --weight-headline: 700;
  --weight-subheading: 600;
  --weight-body: 400;
  --weight-label: 500;
  --weight-button: 600;

  /* Letter spacing */
  --ls-headline: -0.02em;
  --ls-body: 0em;
  --ls-label: 0.02em;
  --ls-overline: 0.10em;

  /* Specific element rules (concrete font shorthand examples) */
  --font-display-rule: 700 var(--type-display)/var(--line-display) var(--font-sans);
  --font-h1-rule: 700 var(--type-h1)/1.1 var(--font-sans);
  --font-h2-rule: 700 var(--type-h2)/1.15 var(--font-sans);
  --font-h3-rule: 600 20px/1.25 var(--font-sans);
  --font-body-rule: 400 16px/1.5 var(--font-sans);
  --font-body-lg-rule: 400 18px/1.5 var(--font-sans);
  --font-button-rule: 600 14px/1 var(--font-sans);
  --font-mono-rule: 400 13px/1.6 var(--font-mono);

  /* Headline specifics */
  --h1-letter-spacing: -0.02em;
  --h2-letter-spacing: -0.02em;
  --h1-line-height: 1.05;
  --h2-line-height: 1.15;

  /* Utility */
  --max-measure: 70ch;
}

/* Typography usage rules (concrete) */
- Root font-size: 16px; body uses font: var(--font-body-rule); color: var(--text-body).
- Display / hero uses font: var(--font-display-rule); letter-spacing: var(--ls-headline); line-height: var(--h1-line-height).
- H1/H2 use font-weight: 700; letter-spacing: -0.02em; H1 line-height: 1.05; H2 line-height: 1.15.
- Buttons use font: var(--font-button-rule); letter-spacing: 0.02em; font-weight: var(--weight-button); text-transform: none.
- Monospace code blocks use font: var(--font-mono-rule); background: var(--code-bg); color: var(--code-text); padding: 16px; border-radius: 10px.
- Overlines and micro labels: font-size: 12px; letter-spacing: 0.10em; text-transform: uppercase; color: var(--text-muted).
- Body text maximum measure: max-width: var(--max-measure) or 70ch.
- Do not use more than two font weights per card; prefer combinations: 400 + 600 or 400 + 700.

## Layout Architecture
ASCII wireframe (desktop):
┌──────────────────────────────────────────────────────────────────────────────┐
│ HTML (background: #fefcf5)                                                    │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Top Navigation (height: 64px; padding: 0 24px)                            │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Hero (centered column)                                                    │ │
│ │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│ │  │ Headline (clamp)                                                   │  │ │
│ │  │ Subhead (16/18px)                                                  │  │ │
│ │  │ Glass CTA Pill [GET STARTED]                                      │  │ │
│ │  └────────────────────────────────────────────────────────────────────┘  │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Feature Grid (container max-width: 1200px; gap: 24px)                   │ │
│ │  ┌─────────┐  ┌─────────┐  ┌─────────┐                                   │ │
│ │  │ Card    │  │ Card    │  │ Card    │                                   │ │
│ │  └─────────┘  └─────────┘  └─────────┘                                   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Docs CTA Banner                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Footer (padding: clamp(24px, 6vw, 48px))                                 │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘

:root {
  /* Spacing system (concrete tokens) */
  --space-0: 4px;
  --space-1: 8px;
  --space-2: 12px;
  --space-3: 16px;
  --space-4: 20px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 40px;
  --space-8: 48px;
  --space-9: 64px;
  --space-10: 96px;

  /* Section & container settings */
  --section-gap: clamp(32px, 6vw, 96px);
  --container-max-width: 1200px;
  --container-padding: clamp(16px, 3vw, 32px);
  --card-padding: 20px;
  --card-gap: 16px;
  --inline-gap: 12px;
  --stack-gap: 8px;

  /* Radius scale */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-pill: 999px;

  /* Layout primitives */
  --nav-height: 64px;
  --nav-height-compact: 56px;
  --hero-padding-vertical: clamp(48px, 10vw, 120px);
  --hero-padding-compact: clamp(28px, 6vw, 48px);
  --max-content-width: 1200px;
}

/* Container class (concrete CSS) */
.container {
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--container-padding);
  padding-right: var(--container-padding);
}

/* Section spacing example */
.section {
  padding-top: var(--section-gap);
  padding-bottom: var(--section-gap);
  background: transparent; /* base canvas handled at body level */
}

/* Card default */
.card {
  background: #fffcf6;
  border: 1px solid rgba(16,20,26,0.06);
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(16,20,26,0.06);
  padding: 20px;
  display: block;
}

## Core UI Components

### Top Navigation
Fixed-height horizontal nav with logo, primary links, and CTA.
- Base:
  - display: flex;
  - align-items: center;
  - justify-content: space-between;
  - height: 64px;
  - padding: 0 clamp(16px, 2vw, 24px);
  - background: transparent;
  - backdrop-filter: none;
  - font: 500 14px/1 var(--font-sans);
  - color: rgba(16,20,26,0.92);
- Links:
  - gap: 20px;
  - link color: rgba(16,20,26,0.88);
  - link padding: 8px 12px;
  - link border-radius: 8px;
- Shadow: none by default.
- Hover:
  - link color: var(--accent-primary);
  - text-decoration: none;
  - underline: 2px solid rgba(0,102,255,0.10) (applied via :after on hover).
- Active:
  - transform: translateY(0);
  - color: var(--accent-primary);
- Focus:
  - outline: none;
  - box-shadow: 0 0 0 6px rgba(0,102,255,0.06);
  - border-radius: 8px;
- Transition:
  - color 160ms cubic-bezier(.2,.9,.2,1), transform 180ms cubic-bezier(.2,.9,.2,1)
- Variants:
  - compact: height: 56px; padding: 0 clamp(12px, 2vw, 16px);
  - solid: background: linear-gradient(180deg, rgba(255,255,255,0.90), rgba(255,255,255,0.95)); box-shadow: var(--shadow-sm); border-bottom: 1px solid rgba(16,20,26,0.02).

CSS snippet:
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 clamp(16px, 2vw, 24px);
  background: transparent;
  color: rgba(16,20,26,0.92);
  font: 500 14px/1 var(--font-sans);
}
.top-nav a {
  color: rgba(16,20,26,0.88);
  padding: 8px 12px;
  border-radius: 8px;
  transition: color 160ms cubic-bezier(.2,.9,.2,1), transform 180ms cubic-bezier(.2,.9,.2,1);
}
.top-nav a:hover { color: var(--accent-primary); }
.top-nav.solid { background: linear-gradient(180deg, rgba(255,255,255,0.90), rgba(255,255,255,0.95)); box-shadow: var(--shadow-sm); }

### Hero
Centered headline, subhead, primary glass CTA pill and illustrative code card.
- Base:
  - display: flex;
  - flex-direction: column;
  - align-items: center;
  - text-align: center;
  - padding: clamp(48px, 10vw, 120px) 0;
  - gap: 20px;
  - background: var(--grad-accent-subtle);
  - color: var(--text-heading);
- Headline:
  - font: 700 clamp(48px, 6.5vw, 56px)/1.05 var(--font-sans);
  - letter-spacing: -0.02em;
  - margin: 0;
  - max-width: 900px;
- Subhead:
  - font: 400 16px/1.5 var(--font-sans);
  - color: var(--text-body);
  - max-width: 780px;
- Glass CTA (primary):
  - display: inline-flex;
  - align-items: center;
  - gap: 10px;
  - padding: 10px 20px;
  - height: 44px;
  - background: rgba(255,255,255,0.55);
  - backdrop-filter: blur(10px) saturate(120%);
  - border: 1px solid rgba(16,20,26,0.06);
  - border-radius: 999px;
  - color: var(--text-heading);
  - font: 600 14px/1 var(--font-sans);
- Illustrative code card:
  - width: min(680px, 92%);
  - background: var(--code-bg);
  - color: var(--code-text);
  - border-radius: 10px;
  - padding: 16px;
  - border: 1px solid rgba(255,255,255,0.04);
  - box-shadow: var(--shadow-md);
- Hover:
  - primary CTA hover: transform: translateY(-2px); box-shadow: var(--shadow-glow);
  - code card hover: transform: translateY(-6px); box-shadow: var(--shadow-md);
- Active:
  - CTA active: transform: translateY(0);
- Focus:
  - CTA focus: box-shadow: 0 0 0 6px rgba(0,102,255,0.06);
- Transition:
  - transform 220ms cubic-bezier(.2,.9,.2,1), box-shadow 220ms cubic-bezier(.2,.9,.2,1), opacity 220ms
- Variants:
  - compact: padding: clamp(28px, 6vw, 48px);
  - split: flex-direction: row; gap: 32px; align-items: center; text-align: left;

CSS snippet:
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: clamp(48px, 10vw, 120px) 0;
  gap: 20px;
  background: var(--grad-accent-subtle);
  color: var(--text-heading);
}
.hero .cta-glass {
  display:inline-flex;
  align-items:center;
  gap:10px;
  padding:10px 20px;
  height:44px;
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(10px) saturate(120%);
  border: 1px solid rgba(16,20,26,0.06);
  border-radius: 999px;
  font: 600 14px/1 var(--font-sans);
  transition: transform 220ms cubic-bezier(.2,.9,.2,1), box-shadow 220ms cubic-bezier(.2,.9,.2,1);
}
.hero .cta-glass:hover { transform: translateY(-2px); box-shadow: var(--shadow-glow); }

### Primary Button (ButtonPrimary)
Primary action button used for CTAs.
- Base:
  - height: 44px;
  - padding: 12px 18px;
  - background: var(--accent-primary);
  - border-radius: 10px;
  - border: none;
  - display: inline-flex;
  - align-items: center;
  - gap: 10px;
  - min-width: 96px;
- Text:
  - font: 600 14px/1 var(--font-sans);
  - letter-spacing: 0.01em;
  - color: #FFFFFF;
- Shadow:
  - box-shadow: 0 1px 2px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,102,255,0.10);
- Hover:
  - background: #005fe6; /* lighten 8% approximated as #005fe6 */
  - transform: translateY(-1px);
  - box-shadow: 0 4px 12px rgba(0,102,255,0.30);
- Active:
  - transform: translateY(0px);
  - box-shadow: 0 2px 6px rgba(0,0,0,0.06);
- Focus:
  - box-shadow: 0 0 0 6px rgba(0,102,255,0.12);
  - outline: none;
- Disabled:
  - opacity: 0.5;
  - pointer-events: none;
- Transition:
  - all 0.15s ease;
- Variants:
  - secondary: outline style — background: transparent; color: var(--accent-primary); border: 1px solid rgba(0,102,255,0.12); box-shadow: none;
  - ghost: no background — background: transparent; color: var(--accent-primary); border: none; box-shadow: none;
  - danger: background: #dc2626; hover background: #b91c1c; box-shadow: 0 6px 18px rgba(220,38,38,0.08);

CSS snippet:
.button-primary {
  height: 44px;
  padding: 12px 18px;
  background: var(--accent-primary);
  border-radius: 10px;
  border: none;
  display:inline-flex;
  align-items:center;
  gap:10px;
  min-width:96px;
  color:#ffffff;
  font:600 14px/1 var(--font-sans);
  letter-spacing:0.01em;
  box-shadow: 0 1px 2px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,102,255,0.10);
  transition: all 0.15s ease;
}
.button-primary:hover { background: #005fe6; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,102,255,0.30); }
.button-primary:active { transform: translateY(0px); box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
.button-primary:focus { box-shadow: 0 0 0 6px rgba(0,102,255,0.12); outline: none; }
.button-primary[disabled] { opacity: 0.5; pointer-events: none; }

.button-primary.secondary { background: transparent; color: var(--accent-primary); border: 1px solid rgba(0,102,255,0.12); box-shadow: none; }
.button-primary.ghost { background: transparent; color: var(--accent-primary); border: none; box-shadow: none; }
.button-primary.danger { background: #dc2626; color: #ffffff; box-shadow: 0 6px 18px rgba(220,38,38,0.08); }
.button-primary.danger:hover { background: #b91c1c; }

### Secondary Button
Low-emphasis action button.
- Base:
  - padding: 10px 14px;
  - background: transparent;
  - color: rgba(16,20,26,0.88);
  - border-radius: 8px;
  - border: 1px solid rgba(16,20,26,0.04);
  - font: 500 14px/1 var(--font-sans);
- Hover:
  - background: rgba(16,20,26,0.02);
  - border-color: rgba(16,20,26,0.06);
- Active:
  - transform: translateY(0);
- Focus:
  - box-shadow: 0 0 0 4px rgba(16,20,26,0.04);
- Transition:
  - background 160ms ease, border-color 160ms ease;
- Variants:
  - link: background: transparent; border: none; color: var(--accent-primary); padding: 0; font-weight: 500;

CSS snippet:
.button-secondary {
  padding:10px 14px;
  background: transparent;
  color: rgba(16,20,26,0.88);
  border-radius:8px;
  border:1px solid rgba(16,20,26,0.04);
  font:500 14px/1 var(--font-sans);
  transition: background 160ms ease, border-color 160ms ease;
}
.button-secondary:hover { background: rgba(16,20,26,0.02); border-color: rgba(16,20,26,0.06); }
.button-secondary.link { background: transparent; border: none; color: var(--accent-primary); padding: 0; }

### Feature Card
Small explanatory card used in feature grids.
- Base:
  - background: #fffcf6;
  - border: 1px solid rgba(16,20,26,0.04);
  - border-radius: 12px;
  - padding: 20px;
  - box-shadow: 0 6px 18px rgba(16,20,26,0.06);
  - display: flex;
  - flex-direction: column;
  - gap: 12px;
- Title:
  - font: 600 16px/1.25 var(--font-sans);
  - color: var(--text-heading);
- Body:
  - font: 400 14px/1.5 var(--font-sans);
  - color: var(--text-body);
- Hover:
  - transform: translateY(-6px);
  - box-shadow: 0 12px 34px rgba(16,20,26,0.08);
  - border-color: rgba(16,20,26,0.08);
- Active:
  - transform: translateY(0);
- Focus:
  - outline: none; box-shadow: 0 0 0 6px rgba(0,0,0,0.02);
- Transition:
  - transform 240ms cubic-bezier(.2,.9,.2,1), box-shadow 240ms, border-color 240ms;
- Variants:
  - accent: add left-border: 4px solid var(--accent-primary); padding-left: 16px;
  - compact: padding: 12px; border-radius: 10px;

CSS snippet:
.feature-card {
  background: #fffcf6;
  border:1px solid rgba(16,20,26,0.04);
  border-radius:12px;
  padding:20px;
  box-shadow: 0 6px 18px rgba(16,20,26,0.06);
  display:flex;
  flex-direction:column;
  gap:12px;
  transition: transform 240ms cubic-bezier(.2,.9,.2,1), box-shadow 240ms, border-color 240ms;
}
.feature-card:hover { transform: translateY(-6px); box-shadow: 0 12px 34px rgba(16,20,26,0.08); border-color: rgba(16,20,26,0.08); }
.feature-card.accent { border-left: 4px solid var(--accent-primary); padding-left: 16px; }
.feature-card.compact { padding: 12px; border-radius: 10px; }

### Code Block
Monospaced code snippet with copy button.
- Base:
  - background: #0f1722;
  - color: #e6eef8;
  - padding: 16px;
  - border-radius: 10px;
  - font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  - font-size: 13px;
  - line-height: 1.6;
  - overflow: auto;
  - border: 1px solid rgba(255,255,255,0.04);
- Copy button (positioned top-right):
  - position: absolute; top: 12px; right: 12px;
  - padding: 6px 10px;
  - background: rgba(255,255,255,0.04);
  - color: #e6eef8;
  - border-radius: 8px;
  - font: 500 12px/1 var(--font-sans);
  - opacity: 0.85;
- Hover:
  - copy button: opacity: 1; transform: translateY(-2px);
- Active:
  - copy pressed: transform: scale(0.98);
- Focus:
  - copy button: box-shadow: 0 0 0 4px rgba(0,102,255,0.06);
- Transition:
  - opacity 160ms ease, transform 160ms ease;
- Variants:
  - inline: display: inline-block; padding: 6px 8px; border-radius: 6px; font-size: 13px;

CSS snippet:
.code-block {
  position: relative;
  background: #0f1722;
  color: #e6eef8;
  padding: 16px;
  border-radius: 10px;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 13px;
  line-height:1.6;
  overflow:auto;
  border:1px solid rgba(255,255,255,0.04);
}
.code-block .copy-btn {
  position:absolute;
  top:12px;
  right:12px;
  padding:6px 10px;
  background: rgba(255,255,255,0.04);
  color:#e6eef8;
  border-radius:8px;
  font:500 12px/1 var(--font-sans);
  opacity:0.85;
  transition: opacity 160ms ease, transform 160ms ease;
}
.code-block .copy-btn:hover { opacity:1; transform: translateY(-2px); }
.code-block.inline { display:inline-block; padding:6px 8px; border-radius:6px; font-size:13px; }

### Docs CTA Banner
Full-width subtle banner driving to docs or API keys.
- Base:
  - width: 100%;
  - display: flex;
  - align-items: center;
  - justify-content: space-between;
  - gap: 12px;
  - padding: 16px clamp(16px, 3vw, 32px);
  - background: linear-gradient(90deg, rgba(124,58,237,0.04), rgba(0,102,255,0.03));
  - border-radius: 12px;
  - border: 1px solid rgba(16,20,26,0.04);
  - color: rgba(16,20,26,0.92);
- Left:
  - text: font: 600 14px/1.25 var(--font-sans);
- Right:
  - action: .button-primary.small variant allowed.
- Hover:
  - transform: translateY(-2px);
  - box-shadow: var(--shadow-sm);
- Active:
  - transform: translateY(0);
- Transition:
  - transform 180ms cubic-bezier(.2,.9,.2,1), box-shadow 180ms;
- Variants:
  - compact: padding: 12px; border-radius: 8px;

CSS snippet:
.docs-cta {
  width:100%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:16px clamp(16px,3vw,32px);
  background: linear-gradient(90deg, rgba(124,58,237,0.04), rgba(0,102,255,0.03));
  border-radius:12px;
  border:1px solid rgba(16,20,26,0.04);
  transition: transform 180ms cubic-bezier(.2,.9,.2,1), box-shadow 180ms;
}
.docs-cta:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }

### Footer
Legal links, social icons, small print.
- Base:
  - padding: clamp(24px, 6vw, 48px);
  - background: transparent;
  - color: rgba(16,20,26,0.64);
  - display: flex;
  - flex-direction: column;
  - gap: 12px;
  - font: 400 14px/1.4 var(--font-sans);
- Links hover:
  - color: var(--accent-primary);
- Compact:
  - padding: 16px; font-size: 13px;
- Transition:
  - color 140ms ease;

CSS snippet:
.footer {
  padding: clamp(24px, 6vw, 48px);
  background: transparent;
  color: rgba(16,20,26,0.64);
  display:flex;
  flex-direction:column;
  gap:12px;
  font:400 14px/1.4 var(--font-sans);
}
.footer a:hover { color: var(--accent-primary); transition: color 140ms ease; }

### Input / Select
Form control used on signups and API key forms.
- Base:
  - background: #ffffff;
  - border: 1px solid rgba(16,20,26,0.06);
  - border-radius: 8px;
  - padding: 10px 12px;
  - font: 400 14px/1.5 var(--font-sans);
  - color: var(--text-body);
  - min-height: 40px;
- Hover:
  - border-color: rgba(0,102,255,0.14);
  - box-shadow: 0 6px 18px rgba(0,102,255,0.04);
- Focus:
  - border-color: var(--accent-primary-hover);
  - box-shadow: 0 0 0 6px rgba(0,102,255,0.06);
  - outline: none;
- Disabled:
  - background: rgba(16,20,26,0.02);
  - color: var(--text-disabled);
- Transition:
  - border-color 160ms ease, box-shadow 160ms ease;
- Variants:
  - error: border-color: rgba(220,38,38,0.90); box-shadow: 0 6px 18px rgba(220,38,38,0.06);

CSS snippet:
.input {
  background:#ffffff;
  border:1px solid rgba(16,20,26,0.06);
  border-radius:8px;
  padding:10px 12px;
  font:400 14px/1.5 var(--font-sans);
  color:var(--text-body);
  min-height:40px;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.input:hover { border-color: rgba(0,102,255,0.14); box-shadow: 0 6px 18px rgba(0,102,255,0.04); }
.input:focus { border-color: var(--accent-primary-hover); box-shadow: 0 0 0 6px rgba(0,102,255,0.06); outline:none; }
.input.error { border-color: rgba(220,38,38,0.90); box-shadow: 0 6px 18px rgba(220,38,38,0.06); }

### Badge
Small status/label badge.
- Base:
  - display: inline-flex;
  - align-items: center;
  - gap: 6px;
  - padding: 6px 8px;
  - font-size: 12px;
  - border-radius: 999px;
  - background: rgba(16,20,26,0.04);
  - color: rgba(16,20,26,0.72);
  - font: 500 12px/1 var(--font-sans);
- Hover:
  - background: rgba(16,20,26,0.06);
- Transition:
  - background 140ms ease;
- Variants:
  - success: background: rgba(16,185,129,0.08); color: #059669;
  - warning: background: rgba(249,115,22,0.06); color: #b45309;

CSS snippet:
.badge {
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:6px 8px;
  font:500 12px/1 var(--font-sans);
  border-radius:999px;
  background: rgba(16,20,26,0.04);
  color: rgba(16,20,26,0.72);
  transition: background 140ms ease;
}
.badge:hover { background: rgba(16,20,26,0.06); }
.badge.success { background: rgba(16,185,129,0.08); color: #059669; }
.badge.warning { background: rgba(249,115,22,0.06); color: #b45309; }

## Animation Patterns
Technology: CSS + IntersectionObserver (prefer CSS keyframes for micro animations and IntersectionObserver for scroll reveals). Default transition: all 240ms cubic-bezier(.2,.9,.2,1).

/* Entrance animation (CSS @keyframes) */
@keyframes enter-up {
  0% {
    transform: translateY(8px) scale(0.995);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* Slow fade for large elements */
@keyframes fade-in {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Button hover micro-bounce (keyframe used sparingly) */
@keyframes hover-bounce {
  0% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
  100% { transform: translateY(0); }
}

/* Loading pulse for placeholders */
@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.995); }
  100% { opacity: 1; transform: scale(1); }
}

/* Glow shimmer for CTA edge-on hover */
@keyframes cta-glow {
  0% { box-shadow: 0 8px 40px rgba(0,102,255,0.06); }
  50% { box-shadow: 0 12px 48px rgba(0,102,255,0.12); }
  100% { box-shadow: 0 8px 40px rgba(0,102,255,0.06); }
}

/* Micro cursor blink for code examples */
@keyframes blink-cursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Concrete CSS classes referencing keyframes */
.entrance {
  opacity: 0;
  transform: translateY(8px) scale(0.995);
}
.entrance.is-visible {
  animation: enter-up 280ms cubic-bezier(.2,.9,.2,1) both;
}

.fade-in {
  opacity: 0;
}
.fade-in.is-visible {
  animation: fade-in 320ms cubic-bezier(.2,.9,.2,1) both;
}

.pulse {
  animation: pulse 1200ms ease-in-out infinite;
}

/* Hover micro interaction applied to primary buttons */
.button-primary:hover { animation: hover-bounce 220ms cubic-bezier(.2,.9,.2,1) both; }
.button-primary:hover .glow { animation: cta-glow 800ms linear infinite; }

/* IntersectionObserver snippet (JS) */
const _observerOptions = { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.10 };
function _initScrollReveal(selector = '.entrance') {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, _observerOptions);
  document.querySelectorAll(selector).forEach(el => io.observe(el));
}

/* Button click animation (JS) */
function _attachButtonClick(el) {
  el.addEventListener('pointerdown', () => { el.style.transform = 'scale(0.97)'; }, {passive:true});
  el.addEventListener('pointerup', () => { el.style.transform = ''; }, {passive:true});
  el.addEventListener('pointerleave', () => { el.style.transform = ''; }, {passive:true});
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .entrance, .fade-in, .button-primary { animation: none !important; transition: none !important; }
}

/* Scroll reveal helper export */
export const scrollReveal = { init: _initScrollReveal, observerOptions: _observerOptions };

## Style Injection Pattern
Unique styleId: warm-minimal-tech-styles

const styleId = 'warm-minimal-tech-styles';
const cssText = `
/* Global base */
:root{
  --bg-base:#fefcf5;
  --bg-surface:#fffcf6;
  --bg-elevated:#ffffff;
  --accent-primary:#0066ff;
  --accent-primary-hover:#0051d6;
  --accent-secondary:#7c3aed;
  --text-heading:rgba(16,20,26,0.96);
  --text-body:rgba(16,20,26,0.92);
  --text-muted:rgba(16,20,26,0.56);
  --border-default:rgba(16,20,26,0.06);
  --shadow-sm:0 6px 18px rgba(16,20,26,0.06);
  --shadow-md:0 12px 34px rgba(16,20,26,0.08);
  --shadow-glow:0 8px 40px rgba(0,102,255,0.08);
  --code-bg:#0f1722;
  --code-text:#e6eef8;
  --glass-bg:rgba(255,255,255,0.55);
  --glass-border:rgba(16,20,26,0.06);
}
/* Body */
html,body{height:100%;margin:0;padding:0;background:#fefcf5;color:rgba(16,20,26,0.92);font:400 16px/1.5 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;}
/* Utility classes */
.container{max-width:1200px;margin-left:auto;margin-right:auto;padding-left:clamp(16px,3vw,32px);padding-right:clamp(16px,3vw,32px);}
.card{background:#fffcf6;border:1px solid rgba(16,20,26,0.06);border-radius:12px;padding:20px;box-shadow:0 6px 18px rgba(16,20,26,0.06);}
.cta-glass{display:inline-flex;align-items:center;padding:10px 20px;height:44px;background:rgba(255,255,255,0.55);backdrop-filter:blur(10px) saturate(120%);border:1px solid rgba(16,20,26,0.06);border-radius:999px;font:600 14px/1 'Inter';}
.button-primary{height:44px;padding:12px 18px;background:var(--accent-primary);border-radius:10px;border:none;color:#fff;font:600 14px/1 'Inter';box-shadow:0 1px 2px rgba(0,0,0,0.10),0 0 0 1px rgba(0,102,255,0.10);transition:all 0.15s ease;}
.button-primary:hover{background:#005fe6;transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,102,255,0.30);}
.code-block{position:relative;background:#0f1722;color:#e6eef8;padding:16px;border-radius:10px;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;border:1px solid rgba(255,255,255,0.04);overflow:auto;}
`;
function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(styleId)) return;
  const s = document.createElement('style');
  s.id = styleId;
  s.type = 'text/css';
  s.appendChild(document.createTextNode(cssText));
  document.head.appendChild(s);
  /* Initialize scroll reveal for elements added after injection */
  if (window && window.requestAnimationFrame) {
    requestAnimationFrame(() => {
      if (typeof _initScrollReveal === 'function') _initScrollReveal('.entrance');
    });
  }
}
export { ensureStyles, styleId };

## Section Templates
Below are at least five concrete section wireframes with spacing, component placement, and responsive notes.

1) Centered Hero (default)
┌──────────────────────────────────────────────────────────────┐
│ Section (padding-top: clamp(48px,10vw,120px); padding-bottom: clamp(48px,10vw,120px); background: var(--grad-accent-subtle)) │
│   .container (max-width:1200px; padding-left/right: clamp(16px,3vw,32px))                                                │
│     Hero (display:flex; flex-direction:column; align-items:center; gap:20px)                                              │
│       H1 (font:700 clamp(48px,6.5vw,56px)/1.05)                                                                          │
│       P (font:400 16px/1.5; max-width:780px)                                                                             │
│       CTA (glass pill .cta-glass)                                                                                        │
│       Code Card (width:min(680px,92%))                                                                                   │
└──────────────────────────────────────────────────────────────┘
Responsive notes:
- <=1024px: Hero padding reduces to --hero-padding-compact (clamp(28px,6vw,48px)).
- <=640px: H1 scales via clamp to min 48px; text-align: center; code card width 100%, margin: 0.

2) Split Hero (text + code)
┌─────────────────────────────────────────────────────────────────────────┐
│ Section (padding-top: clamp(48px,8vw,96px); padding-bottom: clamp(48px,8vw,96px)) │
│  .container (display:flex; gap:32px; align-items:center; justify-content:space-between) │
│    Left Column (flex:1)                                                            │
│      H1, P, CTA                                                                    │
│    Right Column (flex:1; max-width:640px)                                         │
│      Code Card                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
Responsive notes:
- <=900px: stack columns vertically; gap: 24px; text-align: center.

3) Feature Grid
┌────────────────────────────────────────────────────────────┐
│ Section (padding: var(--section-gap))                      │
│  .container (max-width:1200px)                             │
│   Grid (display:grid; grid-template-columns: repeat(3, 1fr); gap:24px) │
│     Feature Card x3                                          │
└────────────────────────────────────────────────────────────┘
Responsive notes:
- 1200px >= width > 900px: grid-template-columns: repeat(2, 1fr)
- <=640px: grid-template-columns: 1fr; gap:16px; padding-left/right: clamp(12px,4vw,20px)

4) Docs CTA Banner (wide)
┌──────────────────────────────────────────────────────────────────────┐
│ Section (padding: 0)                                                │
│  .container (padding-top: var(--space-4); padding-bottom: var(--space-4)) │
│    Docs CTA (width:100%; display:flex; align-items:center; justify-content:space-between) │
│      Left: Text (font:600 14px)                                      │
│      Right: Action: .button-primary.small or .button-secondary.link   │
└──────────────────────────────────────────────────────────────────────┘
Responsive notes:
- <=640px: stack: Text above actions; gap: 12px; text-align: left.

5) Docs/Articles Layout (two-column)
┌──────────────────────────────────────────────────────────────┐
│ .container (display:grid; grid-template-columns: 320px 1fr; gap:32px) │
│   Left: SideNav (position: sticky; top: 96px; width:320px)            │
│   Right: Article (max-width: 70ch; padding: 20px)                     │
└──────────────────────────────────────────────────────────────┘
Responsive notes:
- <=900px: SideNav collapses into top horizontal tab bar; grid becomes one column.

6) Footer + Legal (compact)
┌────────────────────────────────────────────┐
│ Footer (padding: clamp(24px,6vw,48px))     │
│  .container                                 │
│    Top Row: Links (display:flex; gap:20px) │
│    Bottom Row: Small print (font-size:13px)│
└────────────────────────────────────────────┘
Responsive notes:
- <=480px: Links collapse to vertical stack; font-size reduced to 13px.

7) Sign-up / Form Panel (card)
┌───────────────────────────────────────────────┐
│ Card (background:#fffcf6; border:1px solid rgba(16,20,26,0.06); padding:20px) │
│  Title (font:600 18px)                                                         │
│  Input (class: .input)                                                          │
│  Row: Input + Primary Button                                                     │
└───────────────────────────────────────────────┘
Responsive notes:
- <=640px: Inputs stack vertically; button full-width.

## Responsive & Quality
Breakpoints (concrete):
- Mobile small: 360px
- Mobile: 480px
- Tablet: 768px
- Desktop small: 900px
- Desktop: 1200px
- Wide: 1600px

Responsive change rules (concrete):
- <=1200px: container max-width becomes 100%; grid columns collapse per section rules.
- <=900px: Hero split -> stack; Feature Grid columns reduce to 2.
- <=768px: Nav switches to hamburger; nav height uses --nav-height-compact (56px).
- <=480px: Text sizes clamp to minimum values; H1 min 48px; body remains 16px; card padding reduces to 12px.
- >=1600px: container padding increases to clamp(24px,4vw,48px); hero max-width caps at 1200px.

Mobile-specific overrides (concrete):
- .top-nav { padding: 0 clamp(12px, 4vw, 16px); height: 56px; }
- .hero { padding: clamp(28px, 6vw, 48px) 0; }
- .feature-card { padding: 12px; }
- .code-block { font-size: 12px; padding: 12px; border-radius: 8px; }

Reduced motion rules:
- Use prefers-reduced-motion: reduce to disable animations:
  - animation: none !important;
  - transition: none !important;
  - transform: none !important;

Quality checklist (concrete items — checkboxes to enforce during implementation):
- [ ] Body and section background set to #fefcf5 (CSS: body { background: #fefcf5; }).
- [ ] All elevated cards use background: #fffcf6 with border: 1px solid rgba(16,20,26,0.04) and border-radius: 12px.
- [ ] Primary accent used only as: button backgrounds, active link color, small icon tints (verify no full-area backgrounds in UI).
- [ ] Glass CTA uses backdrop-filter: blur(10px) saturate(120%); background: rgba(255,255,255,0.55); border: 1px solid rgba(16,20,26,0.06); border-radius: 999px.
- [ ] Typographic scale implemented with font sizes: display clamp(48px,6.5vw,56px), h1 clamp(36px,5.2vw,44px), h2 clamp(28px,4.0vw,36px), body 16px, mono 13px.
- [ ] All fonts loaded via URL: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap
- [ ] Code blocks use background: #0f1722, color: #e6eef8, font-family: 'JetBrains Mono'; border-radius: 10px; padding: 16px.
- [ ] Shadows limited to rgba(16,20,26,0.12) max opacity and offsets not exceeding values defined (see --shadow-lg).
- [ ] No large decorative gradient opacities > 0.08; gradients use defined tokens --grad-accent-subtle or --grad-accent-radial.
- [ ] Contrast: body text (rgba(16,20,26,0.92)) meets minimum 4.5:1 against #fffcf6 or #fefcf5 (verify with accessibility tool).
- [ ] Buttons: primary height 44px, padding 12px 18px, border-radius 10px, font-weight 600, hover transform -1px.
- [ ] Inputs: border default rgba(16,20,26,0.06), focus outline box-shadow 0 0 0 6px rgba(0,102,255,0.06).
- [ ] IntersectionObserver used for scroll reveal with rootMargin: '0px 0px -8% 0px' and threshold: 0.10.
- [ ] Reduced motion respected via @media (prefers-reduced-motion: reduce).
- [ ] Avoid using accent-primary (#0066ff) as large-area backgrounds or nav backgrounds.
- [ ] Glass effect used only on hero CTA and small floating pills; not used for primary content areas.
- [ ] Validate all color tokens exist in :root and are referenced by components.
- [ ] Ensure no more than two font weights used inside any single card (enforce via code review).
- [ ] Ensure all interactive elements (links, buttons, inputs) have focus styles meeting keyboard accessibility.
- [ ] All radii use tokens: 8px, 12px, 18px, 999px — no ad-hoc radii.

Implementation hints and enforcement:
- Use the exported ensureStyles() to inject CSS tokens before rendering components.
- Call scrollReveal.init('.entrance') after mount to initialize scroll-triggered enter-up animations.
- Use button and input variants classes shown above to ensure pixel-consistency across components.
- Run an automated QA script verifying color token usage, font-load confirmation, and contrast ratios.

End of warm-minimal-tech agent configuration file.