---
name: STRIPE PLAFORM FOR REQUEST
description: "Production-ready design system for a minimal-modern, developer-focused payment platform landing & docs pages. Tokens, components, animations, and responsive rules are explicit and ready for implementation."
model: claude-opus-4-6
---

## Your Design DNA

A content-first, developer-centric design DNA that prioritizes readable docs, selectable code, and calm, trust-building marketing layout — executed in a minimal modern aesthetic with a green primary accent (#5DC086).
- Spatial rhythm: section spacing driven by clamp() tokens — e.g. section padding: clamp(32px, 4.5vw, 96px); container padding: clamp(16px, 3vw, 32px); card padding: 20px; grid gap: 24px.
- Radii system: border-radius: 16px on large cards (--radius-lg: 16px), 12px on default cards (--radius-md: 12px), 6px on small chips (--radius-sm: 6px), 8px on buttons (--radius-btn: 8px), pill: 999px for badges and pills.
- Typeface choices: display font: Inter/Stripe-Sans family via Google Fonts; body font: Inter; monospace for code: JetBrains Mono. Exact import provided below.
- Card-first composition: default card styles use background: var(--color-bg-elevated) with border: 1px solid var(--color-border), box-shadow: 0 6px 20px rgba(10,37,64,0.04).
- Button system: primary uses --color-accent-primary (#5DC086) with white text; secondary uses --color-accent-secondary (#00B4FF); ghost uses transparent backgrounds with 1px solid rgba values.
- Developer affordances: copy-to-clipboard button sized 40px, monospace code blocks font-size 13px, background overlay for code: rgba(10,37,64,0.04) or #F6F9FC darker variant.
- Accessibility-first: primary text contrast >= 4.5:1 against backgrounds; all interactive controls min hit area 44x44px; focus rings explicit: 3px solid rgba(93,192,134,0.22) for primary focus.
- Motion policy: minimal motion by default; prefers-reduced-motion respected by removing entrance translate and animation durations set to 0ms when prefered.
- Grid & layout: 12-column responsive grid with gutter width: 24px on desktop, 16px on tablet, 12px on mobile; container max-width: 1200px.
- Trust cues: trust band with logos in desaturated 60% opacity; security badges within a 1px border and 12px padding.
- Code demo interactions: optional typing demo that pauses on hover or when user prefers reduced motion; typing speed default 40ms per character, pause 700ms between lines.

## Color System

:root {
  /* Backgrounds (5+) */
  --color-bg-base: #FFFFFF; /* page background */
  --color-bg-surface: #F6F9FC; /* large surfaces, light panels */
  --color-bg-elevated: #FFFFFF; /* card surfaces (same white but kept semantic) */
  --color-bg-muted: #FBFDFF; /* subtle elevated tint */
  --color-bg-inset: #F0F6F9; /* inset panels or code block background alternative */

  /* Accent / Brand (4+) */
  --color-accent-primary: #5DC086; /* primary green specified by request */
  --color-accent-primary-600: #53B977; /* slightly darker for hover */
  --color-accent-secondary: #00B4FF; /* cyan secondary accent */
  --color-accent-action: #00D084; /* positive action green, used for success CTAs */

  /* Text hierarchy (4+) */
  --color-text-primary: rgba(10,37,64,1); /* main body headings */
  --color-text-secondary: rgba(10,37,64,0.85); /* body copy */
  --color-text-muted: rgba(10,37,64,0.60); /* helper text, metadata */
  --color-text-inverse: #FFFFFF; /* on accent/colored backgrounds */

  /* Borders (3+) */
  --color-border: rgba(10,37,64,0.08); /* thin separators */
  --color-border-strong: rgba(10,37,64,0.12); /* emphasis borders and card outlines */
  --color-border-muted: rgba(10,37,64,0.04); /* very subtle dividers */

  /* Shadows (3+) */
  --shadow-sm: 0 1px 3px rgba(10,37,64,0.06), 0 0 0 1px rgba(255,255,255,0.02);
  --shadow-md: 0 6px 20px rgba(10,37,64,0.04);
  --shadow-lg: 0 12px 48px rgba(10,37,64,0.06), 0 1px 2px rgba(10,37,64,0.04);

  /* Gradients (2+) */
  --gradient-accent-1: linear-gradient(90deg, #5DC086 0%, #00B4FF 100%);
  --gradient-accent-2: linear-gradient(180deg, rgba(93,192,134,0.08) 0%, rgba(0,180,255,0.04) 100%);

  /* State colors */
  --color-success: #00D084;
  --color-success-contrast: #0A2540; /* text on success backgrounds */
  --color-error: #FF4D4F;
  --color-warning: #FFB020;
  --color-info: #00B4FF;

  /* Utility / semantic */
  --color-muted-overlay: rgba(10,37,64,0.02);
  --color-focus-ring: rgba(93,192,134,0.22); /* used for focus outlines */
  --color-pulse: rgba(93,192,134,0.12);
  --color-code-bg: rgba(10,37,64,0.04); /* default code block overlay */
  --color-copy-button-bg: rgba(10,37,64,0.04);

  /* Additional accents for subtle UI */
  --color-accent-emerald-1: #4AC370;
  --color-accent-teal-1: #00C2E8;

  /* Icon / stroke */
  --color-icon: rgba(10,37,64,0.75);
  --color-icon-muted: rgba(10,37,64,0.45);
}

Color usage rules:
- Primary backgrounds use --color-bg-base; isolated content surfaces use --color-bg-surface or --color-bg-elevated for cards and panels.
- Primary CTA uses --color-accent-primary (#5DC086) with color: var(--color-text-inverse) (#FFFFFF); hover uses --color-accent-primary-600 (#53B977).
- Secondary CTAs use --color-accent-secondary (#00B4FF); ensure text color is either var(--color-text-inverse) or var(--color-text-primary) depending on contrast checks.
- Success/positive actions use --color-accent-action (#00D084); use with icon + label and never color-alone for state.
- Text hierarchy: headings use --color-text-primary; body copy uses --color-text-secondary; muted helper text and timestamps use --color-text-muted.
- Borders and separators use --color-border for subtle divisions; use --color-border-strong for card outlines or form field emphasis.
- Gradients (--gradient-accent-1 and --gradient-accent-2) are decorative: use at hero backgrounds or large illustrations only; avoid using gradients for micro UI elements unless for campaign CTAs.
- Maintain minimum contrast ratios: body text >= 4.5:1 vs background; large headings >= 3:1 minimum. Test with color tools. Prefer darker strokes for long legal text.
- Accent colors must never be the sole indicator of state; always include an icon or text label for status changes.
- Trust band logos should be desaturated to 60% opacity: opacity: 0.6 and max-height: 36px per logo.
- Code blocks use --color-code-bg: rgba(10,37,64,0.04) with border: 1px solid rgba(10,37,64,0.04) and border-radius: 8px.

## Typography

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:ital,wght@0,400;0,600;1,400&display=swap');

:root {
  /* Font families */
  --font-display: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'JetBrains Mono', SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;

  /* Type scale */
  --type-display: clamp(40px, 6.5vw + 12px, 64px); /* large hero display range */
  --type-h1: clamp(32px, 4.2vw + 10px, 48px);
  --type-h2: clamp(24px, 2.6vw + 8px, 32px);
  --type-h3: clamp(20px, 1.6vw + 8px, 24px);
  --type-body: 16px;
  --type-caption: 13px;
  --type-micro: 11px;
  --type-code: 13px; /* monospace code base */

  /* Weights */
  --weight-display: 700;
  --weight-heading: 600;
  --weight-heading-strong: 700;
  --weight-body: 400;
  --weight-body-strong: 500;
  --weight-mono: 400;
  --weight-mono-strong: 600;

  /* Line heights */
  --leading-display: 1.05;
  --leading-heading: 1.15;
  --leading-body: 1.5;
  --leading-caption: 1.3;

  /* Letter spacing */
  --tracking-tight: -0.02em;
  --tracking-normal: 0em;
  --tracking-wide: 0.01em;
  --tracking-uppercase: 0.08em;

  /* Specific element rules as CSS shorthand tokens */
  --font-h1: 700 var(--type-h1)/var(--leading-heading) var(--font-display);
  --font-h2: 600 var(--type-h2)/var(--leading-heading) var(--font-display);
  --font-h3: 600 var(--type-h3)/var(--leading-heading) var(--font-display);
  --font-body: 400 var(--type-body)/var(--leading-body) var(--font-body);
  --font-caption: 400 var(--type-caption)/var(--leading-caption) var(--font-body);
  --font-mono: 400 var(--type-code)/1.45 var(--font-mono);

  /* Link style token */
  --link-color: var(--color-accent-primary);
  --link-underline-thickness: 1px;
}

Typography rules:
- Body copy uses --font-body (Inter) at 16px with line-height: 1.5 (var(--leading-body)) and letter-spacing: 0em.
- Headings use clamp() scales for fluidity with weights 600–700 and letter-spacing: -0.02em for h1/h2 to tighten headings.
- Display headings use --type-display with font-weight 700 and line-height 1.05 for striking hero statements.
- Monospace code uses --font-mono at 13px for blocks and 14px for inline emphasis; letter-spacing: 0.01em for better readability of code.
- Max measure for body text: keep text column width between 560px and 720px for readability. When full-width layouts occur use a column max-width: 680px.
- Links: color: var(--link-color), text-decoration: none by default, underline appears on :hover with text-decoration-thickness: var(--link-underline-thickness).
- Inline code: background: rgba(10,37,64,0.04), padding: 2px 6px, border-radius: 6px, font: var(--font-mono).

## Layout Architecture

ASCII layout (desktop, 1200px container):

┌─────────────────────────────────────────────────────────────────────────────┐
│ TOP NAV (sticky, 64px)                                                      │
│  [LOGO]   [Product] [Docs] [Pricing] [Resources]            [Login][Get started] │
├─────────────────────────────────────────────────────────────────────────────┤
│ HERO (full-width gradient or surface)                                       │
│  Left column: headline (h1), subhead, CTAs                                  │
│  Right column: illustration or live code sample                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ TRUST BAND (logos, 80px tall band)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ FEATURES GRID (3 columns desktop / 2 tablet / 1 mobile)                     │
│  ┌──────┐ ┌──────┐ ┌──────┐                                                  │
│  │Card 1│ │Card 2│ │Card 3│                                                  │
│  └──────┘ └──────┘ └──────┘                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ PRICING / COMPARISON (cards or table)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ DOCS & SNIPPETS (code blocks, tabs, search)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ FOOTER (links, legal, regional selector)                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Spacing system (CSS custom properties):
:root {
  --container-max-width: 1200px;
  --grid-columns: 12;
  --grid-gutter-desktop: 24px;
  --grid-gutter-tablet: 16px;
  --grid-gutter-mobile: 12px;

  --space-xxs: 4px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-xxl: 48px;

  --space-section: clamp(32px, 4.5vw, 96px);
  --space-block: clamp(16px, 2.6vw, 40px);
  --container-pad: clamp(16px, 3vw, 32px);

  --nav-height: 64px;
  --card-padding: 20px;
  --card-gap: 24px;
  --hero-gap: 32px;
}

Responsive grid notes:
- Desktop (>= 1024px): 12-column grid, gutters --grid-gutter-desktop: 24px, container centered max-width 1200px.
- Tablet (>= 768px and < 1024px): 8-column effective layout, gutters 16px.
- Mobile (< 768px): single column stack, gutters 12px, hits and buttons sized for touch.

Card style (from layoutArchitecture brief):
- Default card: background: var(--color-bg-elevated), border-radius: var(--radius-md) (12px), border: 1px solid var(--color-border), box-shadow: var(--shadow-md), padding: var(--card-padding) (20px).
- Elevated card: border: 1px solid var(--color-border-strong), box-shadow: var(--shadow-lg).

Radius tokens:
:root {
  --radius-lg: 16px;
  --radius-md: 12px;
  --radius-sm: 6px;
  --radius-pill: 999px;
  --radius-btn: 8px;
}

## Core UI Components

### ButtonPrimary
Primary action button used for CTAs.
- Description: Primary CTA button for actions like "Get started", "Create account", or "Launch demo".
- Base: height: 44px; padding: 0 24px; background: var(--color-accent-primary); border-radius: 8px; border: none; display: inline-flex; align-items: center; justify-content: center; min-width: 120px.
- Text: font: 600 14px/1 var(--font-body); letter-spacing: 0.01em; color: #FFFFFF; text-transform: none.
- Shadow: 0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px rgba(93,192,134,0.06).
- Hover: background: #53B977 (var(--color-accent-primary-600)); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(83,185,119,0.18).
- Active: transform: translateY(0px) scale(0.995); box-shadow: 0 2px 6px rgba(0,0,0,0.08).
- Focus: outline: 3px solid var(--color-focus-ring); outline-offset: 2px.
- Disabled: opacity: 0.5; pointer-events: none.
- Transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1).
- Variants:
  - secondary: background: var(--color-accent-secondary); color: #FFFFFF; hover background: #009FEC.
  - outline: background: transparent; border: 1px solid rgba(10,37,64,0.08); color: var(--color-text-primary); hover background: rgba(93,192,134,0.04).
  - ghost: background: transparent; border: none; color: var(--color-accent-primary); padding: 6px 12px.
  - danger: background: var(--color-error); color: #FFFFFF; hover background: #e04343.

### ButtonIcon
Small square icon button (used for copy, run, collapse).
- Base: width: 40px; height: 40px; padding: 0; background: rgba(10,37,64,0.04) (var(--color-copy-button-bg)); border-radius: 8px; border: 1px solid rgba(10,37,64,0.04); display: inline-flex; align-items: center; justify-content: center.
- Icon size: 16px; color: var(--color-icon).
- Hover: background: rgba(10,37,64,0.06); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(10,37,64,0.02).
- Active: transform: translateY(0px) scale(0.98).
- Focus: box-shadow: 0 0 0 4px rgba(93,192,134,0.10); outline: none.
- Transition: all 0.12s cubic-bezier(0.4,0,0.2,1).
- Variants:
  - reading: background: transparent; border: 1px dashed rgba(10,37,64,0.06).
  - destructive: background: rgba(255,77,79,0.10); color: var(--color-error).

### Top Navigation
Primary site navigation with left-aligned logo, center links, right-aligned CTAs; responsive collapse to hamburger.
- Description: Supports "full", "compact", and "docs" variants. Sticky at top.
- Container: height: var(--nav-height) (64px); padding: 0 var(--container-pad); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; background: linear-gradient(0deg, rgba(255,255,255,0.96), rgba(255,255,255,0.96)); backdrop-filter: blur(6px); border-bottom: 1px solid rgba(10,37,64,0.04); z-index: 60.
- Logo: margin-right: 20px; height: 28px; display: inline-block.
- Links: font: 500 14px/1 var(--font-body); color: var(--color-text-primary); gap: 20px; display: flex.
- Search (docs variant): width: 360px; height: 40px; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(10,37,64,0.06); background: #FFFFFF; box-shadow: var(--shadow-sm).
- Mobile hamburger: width: 44px; height: 44px; border-radius: 8px; background: transparent; transition: transform 0.18s ease.
- Hover (links): color: var(--color-accent-primary); text-decoration: underline on hover only (text-decoration-thickness: 1px).
- Focus: links show outline: 3px solid rgba(93,192,134,0.12); offset 2px.
- Variants:
  - full: logo + links + CTA Buttons (ButtonPrimary).
  - compact: logo + hamburger + a single CTA (ButtonPrimary with min-width 96px).
  - docs: logo + search input (width 360px) + version selector (height 40px, border 1px solid rgba(10,37,64,0.06)) + auth actions.

### Hero
Two-column hero with headline, subhead, primary+secondary CTAs, and right illustration or live code sample. Supports gradient or surface background.
- Description: marketing, technical, and campaign variants.
- Container: padding: var(--space-section) var(--container-pad); display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--hero-gap); align-items: center; background: var(--gradient-accent-2) or var(--color-bg-base) when not gradient.
- Left column (col-span 7 on desktop, 12 mobile): max-width: 680px; h1: font: var(--font-h1); color: var(--color-text-primary); margin-bottom: 16px.
- Subhead: font: var(--font-body); color: var(--color-text-secondary); margin-bottom: 20px.
- CTAs: ButtonPrimary + ButtonSecondary inline gap: 12px.
- Right column (col-span 5): illustration container: width: 100%; max-width: 520px; justify-self: end; background: transparent.
- Stripe overlay effect: a diagonal stripe mesh SVG overlay positioned absolute with opacity: 0.08; transform: rotate(-12deg); pointer-events: none.
- Hover (illustration): transform: translateY(-6px) scale(1.01); box-shadow: 0 12px 40px rgba(10,37,64,0.06).
- Variants:
  - marketing: background: var(--gradient-accent-1); headline color: #FFFFFF (var(--color-text-inverse)); subhead color: rgba(255,255,255,0.92).
  - technical: right column includes code block with background: var(--color-code-bg) and copy button.
  - campaign: bold display size: var(--type-display); CTA uses gradient background: var(--gradient-accent-1) with color #FFFFFF.

### Feature Card
Compact card for product features: icon/illustration, title, short description, optional CTA; subtle hover lift.
- Base: width: 100%; padding: 20px; border-radius: var(--radius-md) (12px); background: var(--color-bg-elevated); border: 1px solid var(--color-border); box-shadow: var(--shadow-sm); display: flex; gap: 12px; align-items: flex-start.
- Icon: width: 40px; height: 40px; border-radius: 8px; background: rgba(93,192,134,0.12); display: flex; align-items: center; justify-content: center; color: var(--color-accent-primary).
- Title: font: 600 16px/1.15 var(--font-body); color: var(--color-text-primary); margin-bottom: 6px.
- Description: font: 400 14px/1.4 var(--font-body); color: var(--color-text-secondary).
- Hover: transform: translateY(-6px); box-shadow: 0 12px 40px rgba(10,37,64,0.06).
- Active: transform: translateY(-2px); box-shadow: 0 6px 20px rgba(10,37,64,0.04).
- Focus: outline: 3px solid rgba(93,192,134,0.10); outline-offset: 2px.
- Variants:
  - compact: icon left small 28px, text smaller font-size 14px; padding: 12px.
  - highlighted: border-left: 4px solid var(--color-accent-primary); background: linear-gradient(90deg, rgba(93,192,134,0.04), transparent).

### PricingCard
Pricing or plan card used in pricing grid and comparison tables.
- Base: width: 100%; padding: 24px; border-radius: 16px; background: var(--color-bg-elevated); border: 1px solid var(--color-border-strong); box-shadow: var(--shadow-md); display: flex; flex-direction: column; gap: 16px.
- Header: plan name font: 600 18px/1.15 var(--font-body); price font: 700 28px/1 var(--font-display); badge: background: var(--color-accent-primary); color: #FFFFFF; padding: 6px 10px; border-radius: 999px.
- Features list: bullets with check icon color: var(--color-accent-primary); font: 14px/1.4 var(--font-body).
- CTA area: ButtonPrimary stretched to full width (min-height 44px).
- Highlight variant: background: linear-gradient(180deg, rgba(93,192,134,0.06), rgba(0,180,255,0.02)); border: 1px solid rgba(93,192,134,0.12).
- Table variant: uses role="table" with sticky header: position: sticky; top: 0; background: var(--color-bg-elevated); border-bottom: 1px solid var(--color-border).

### CodeSnippet
Selectable monospace code block with language label, copy button, optional run/demo toggle.
- Base block: background: var(--color-code-bg); border: 1px solid rgba(10,37,64,0.04); border-radius: 8px; padding: 16px; font: var(--font-mono); font-size: 13px; line-height: 1.45; color: var(--color-text-primary); overflow: auto; max-height: 420px.
- Header (language label & actions): height: 40px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(10,37,64,0.03); padding-bottom: 12px; margin-bottom: 12px.
- Copy button: ButtonIcon variant; position: absolute; top: 16px; right: 16px; background: var(--color-copy-button-bg); border-radius: 8px.
- Selection: ::selection background: rgba(93,192,134,0.18); color: #0A2540.
- Focus: outline: 3px solid rgba(93,192,134,0.12).
- Typing demo: optional JS-run variant animates inner text; respects prefers-reduced-motion (disabled when reduced motion enabled).
- Variants:
  - inline: padding: 2px 6px; border-radius: 6px; display: inline-block; font-size: 14px.
  - interactive: includes run button (ButtonIcon green), editable textarea with contentEditable=true and aria-live region for results.

### Form / Input
Labeled inputs, hint text, validation states, and accessible labels.
- Input base: height: 44px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--color-border); background: #FFFFFF; font: 400 16px/1.5 var(--font-body); color: var(--color-text-primary).
- Label: font: 500 14px/1.3 var(--font-body); color: var(--color-text-secondary); margin-bottom: 8px.
- Hint text: font: 13px/1.3 var(--font-body); color: var(--color-text-muted).
- Success state: border: 1px solid var(--color-success); box-shadow: 0 4px 12px rgba(0,208,132,0.06).
- Error state: border: 1px solid var(--color-error); box-shadow: 0 4px 12px rgba(255,77,79,0.06); error text color: var(--color-error).
- Focus: box-shadow: 0 0 0 4px rgba(93,192,134,0.08); outline: none.
- Variants:
  - auth: stacked inputs with gap: 12px and helper links; password input includes show/hide toggle ButtonIcon.
  - inline: compact search input height 40px with icon left (padding-left: 40px).
  - complex: select and date components adopt same border-radius and border tokens with min-height: 44px.

### Trust Band
Full-width horizontal band showing partner logos and security badges.
- Container: padding: 16px var(--container-pad); background: var(--color-bg-surface); border-top: 1px solid rgba(10,37,64,0.02); border-bottom: 1px solid rgba(10,37,64,0.02).
- Logos row: display: flex; gap: 32px; align-items: center; justify-content: center; max-height: 48px; opacity: 0.6; filter: grayscale(80%); each logo max-height: 36px.
- Certification badge: background: #FFFFFF; border: 1px solid rgba(10,37,64,0.06); padding: 8px 12px; border-radius: 8px; box-shadow: 0 6px 20px rgba(10,37,64,0.02).
- Animation: logos fade-in with stagger 80ms each on intersection.
- Variants:
  - logos: evenly spaced logo tiles.
  - certifications: badges with 12px internal padding and 16px gap.

### Footer
Multi-column footer for links, developer resources, legal and regional selector.
- Container: padding: 48px var(--container-pad); background: var(--color-bg-surface); color: var(--color-text-secondary).
- Columns: display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; max-width: var(--container-max-width).
- Bottom legal row: padding-top: 16px; border-top: 1px solid rgba(10,37,64,0.04); font: 13px/1.4 var(--font-body); color: var(--color-text-muted).
- Compact variant: two columns stacked for small viewports; spacing reduced to 24px vertical.
- Regional selector: select element height 40px; border-radius: 8px; border: 1px solid rgba(10,37,64,0.06).

### Illustration / Icon System
Line + fill illustrations consistent in stroke width and color accents.
- Icon stroke: stroke: var(--color-text-primary); stroke-width: 1.6px; fill: none or accent tones.
- Accent usage: use var(--color-accent-primary) for key strokes or fill areas requiring emphasis.
- Two-tone approach: stroke layer (#0A2540) and fill layer (rgba(93,192,134,0.06)).
- SVG container: width: 100%; height: auto; max-width: 520px; display: block.
- Animated svg variant: subtle entrance using fade-up animation (translateY 12px, opacity 0 → 1 over 420ms).

## Animation Patterns

Technology choice: CSS for micro-interactions and entrance keyframes + IntersectionObserver for scroll-triggered reveals. Optional lightweight JS for typing demo that respects prefers-reduced-motion.

CSS keyframes (concrete):

/* Fade-up entrance */
@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0px); }
}

/* Card hover lift (used in subtle micro-interactions) */
@keyframes lift {
  0% { transform: translateY(0); box-shadow: 0 6px 20px rgba(10,37,64,0.04); }
  100% { transform: translateY(-6px); box-shadow: 0 12px 40px rgba(10,37,64,0.06); }
}

/* Button press micro animation */
@keyframes buttonPress {
  0% { transform: scale(1); }
  50% { transform: scale(0.98); }
  100% { transform: scale(1); }
}

/* Stripe bar shimmer (animated background position) */
@keyframes stripeShimmer {
  0% { background-position: 0% 50%; opacity: 0.08; }
  50% { background-position: 50% 50%; opacity: 0.12; }
  100% { background-position: 100% 50%; opacity: 0.08; }
}

/* Loading spinner rotation */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Typing cursor blink */
@keyframes blinkCursor {
  0% { opacity: 1; }
  50% { opacity: 0; }
  100% { opacity: 1; }
}

Concrete CSS animation usage examples:

/* Apply fade-up to sections on intersection */
.section-animate {
  opacity: 0;
  transform: translateY(12px);
  animation: fadeUp 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

/* Card hover to lift */
.card-hover {
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4,0,0.2,1);
}
.card-hover:hover { animation: lift 200ms forwards; }

/* Button press on active */
.button-press:active { animation: buttonPress 120ms ease-in-out; }

/* Stripe shimmer applied to hero stripe overlay */
.hero-stripe {
  background-image: linear-gradient(120deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%);
  background-size: 200% 100%;
  animation: stripeShimmer 3200ms linear infinite;
  opacity: 0.08;
}

/* Spinner */
.loader {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid rgba(10,37,64,0.08);
  border-top-color: var(--color-accent-primary);
  animation: spin 800ms linear infinite;
}

/* Typing demo: blinking cursor */
.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--color-text-primary);
  margin-left: 6px;
  animation: blinkCursor 900ms steps(2,start) infinite;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .section-animate { animation: none; transform: none !important; opacity: 1 !important; }
  .card-hover:hover { transform: none !important; box-shadow: var(--shadow-md) !important; }
  .hero-stripe { animation: none; opacity: 0.04; }
}

/* IntersectionObserver JS snippet for scroll-triggered reveal (concrete) */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.section-animate').forEach(el => revealObserver.observe(el));

/* Typing demo JS (respects reduced-motion) */
function runTypingDemo(el, text, speed = 40, pause = 700) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = text;
    return;
  }
  el.textContent = '';
  let i = 0;
  function step() {
    if (i < text.length) {
      el.textContent += text[i++];
      setTimeout(step, speed);
    } else {
      setTimeout(() => { el.dispatchEvent(new Event('typing:done')); }, pause);
    }
  }
  step();
}

## Style Injection Pattern

const STYLE_ID = 'minimal-modern-styles-v1';
function ensureStyles() {
  if (typeof document === 'undefined') return; // server safety
  if (document.getElementById(STYLE_ID)) return;
  const sheet = document.createElement('style');
  sheet.id = STYLE_ID;

  sheet.textContent = `
/* ===== Minimal Modern Design System (injected) ===== */

/* Color variables */
:root {
  --color-bg-base: #FFFFFF;
  --color-bg-surface: #F6F9FC;
  --color-bg-elevated: #FFFFFF;
  --color-bg-muted: #FBFDFF;
  --color-bg-inset: #F0F6F9;

  --color-accent-primary: #5DC086;
  --color-accent-primary-600: #53B977;
  --color-accent-secondary: #00B4FF;
  --color-accent-action: #00D084;

  --color-text-primary: rgba(10,37,64,1);
  --color-text-secondary: rgba(10,37,64,0.85);
  --color-text-muted: rgba(10,37,64,0.60);
  --color-text-inverse: #FFFFFF;

  --color-border: rgba(10,37,64,0.08);
  --color-border-strong: rgba(10,37,64,0.12);
  --color-border-muted: rgba(10,37,64,0.04);

  --shadow-sm: 0 1px 3px rgba(10,37,64,0.06), 0 0 0 1px rgba(255,255,255,0.02);
  --shadow-md: 0 6px 20px rgba(10,37,64,0.04);
  --shadow-lg: 0 12px 48px rgba(10,37,64,0.06), 0 1px 2px rgba(10,37,64,0.04);

  --gradient-accent-1: linear-gradient(90deg, #5DC086 0%, #00B4FF 100%);
  --gradient-accent-2: linear-gradient(180deg, rgba(93,192,134,0.08) 0%, rgba(0,180,255,0.04) 100%);

  --color-success: #00D084;
  --color-error: #FF4D4F;
  --color-warning: #FFB020;
  --color-info: #00B4FF;

  --container-max-width: 1200px;
  --container-pad: clamp(16px, 3vw, 32px);
  --space-section: clamp(32px, 4.5vw, 96px);
  --nav-height: 64px;

  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-sm: 6px;
  --radius-btn: 8px;
  --radius-pill: 999px;
}

/* Base typography */
html { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; font-size: 16px; color: var(--color-text-primary); -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
h1 { font: 700 clamp(32px, 4.2vw + 10px, 48px)/1.15 var(--font-display); letter-spacing: var(--tracking-tight); color: var(--color-text-primary); margin: 0 0 12px 0; }
h2 { font: 600 clamp(24px, 2.6vw + 8px, 32px)/1.15 var(--font-display); margin: 0 0 10px 0; }
h3 { font: 600 clamp(20px, 1.6vw + 8px, 24px)/1.15 var(--font-display); margin: 0 0 8px 0; }
p { font: 400 16px/1.5 var(--font-body); margin: 0 0 12px 0; color: var(--color-text-secondary); }

/* Utility classes and component placeholders (sketch) */
.button-primary { height:44px; padding: 0 24px; background: var(--color-accent-primary); color: #FFFFFF; border-radius: var(--radius-btn); border: none; display:inline-flex; align-items:center; justify-content:center; font:600 14px/1 var(--font-body); transition: all 0.15s cubic-bezier(0.4,0,0.2,1); box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px rgba(93,192,134,0.06); }
.button-primary:hover { background: var(--color-accent-primary-600); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(83,185,119,0.18); }

/* More base tokens and classes can be appended by implementer */
`;

  document.head.appendChild(sheet);
}

ensureStyles();

export { ensureStyles };

## Section Templates

1) Hero - Marketing (desktop)
ASCII:
┌───────────────────────────────────────────────────────────────┐
│ [NAV sticky top - 64px]                                       │
│  ┌───────────────────────────────────────────────────────────┐│
│  │ HERO ROW (grid 12)                                        ││
│  │  ┌───────────────┐   ┌───────────────┐                   ││
│  │  │ LEFT COL (7)  │   │ RIGHT COL (5) │                   ││
│  │  │ h1 (var(--type-display))                                 ││
│  │  │ p (body)                                                ││
│  │  │ [Primary CTA] [Secondary CTA]                            ││
│  │  └───────────────┘   └───────────────┘                     ││
│  └───────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────┘
Internal spacing values: left column max-width 680px; gap: var(--hero-gap) 32px; section padding: var(--space-section).
Responsive: at <= 1024px right column stacks below left; at <= 768px full-width stacked with CTAs full width.

2) Features Grid - 3-column
ASCII:
┌───────────────────────────────────────────────────────────────┐
│ FEATURES (container centered)                                │
│  ┌─────┬─────┬─────┐                                          │
│  │Card1│Card2│Card3│ (gap: 24px)                              │
│  └─────┴─────┴─────┘                                          │
└───────────────────────────────────────────────────────────────┘
Internal spacing: card padding 20px; grid gap 24px.
Responsive: 3 columns >=1024px; 2 columns between 768–1023px; 1 column <768px.

3) Trust Band - Logos
ASCII:
┌───────────────────────────────────────────────────────────────┐
│ TRUST BAND (bg: var(--color-bg-surface))                     │
│  center aligned logos (max-height:36px, gap:32px)           │
└───────────────────────────────────────────────────────────────┘
Internal spacing: padding 16px; max logo height 36px; opacity 0.6.
Responsive: logos wrap to multiple rows on narrow widths; maintain spacing 16px vertical.

4) Pricing Comparison - Grid or Table
ASCII:
┌───────────────────────────────────────────────────────────────┐
│ PRICING (container)                                          │
│  ┌─────────────┬─────────────┬─────────────┐                 │
│  │ Plan A      │ Plan B (★)  │ Plan C      │                 │
│  │ price       │ price       │ price       │                 │
│  │ features    │ features    │ features    │                 │
│  └─────────────┴─────────────┴─────────────┘                 │
└───────────────────────────────────────────────────────────────┘
Internal spacing: card padding 24px; highlight border for primary plan: 1px solid rgba(93,192,134,0.12).
Responsive: stack cards vertically <768px; table variant uses sticky header on desktop.

5) Docs & Snippets - Two-column
ASCII:
┌───────────────────────────────────────────────────────────────┐
│ DOCS LAYOUT                                                  │
│  ┌──────────────┐ ┌───────────────┐                          │
│  │ Left nav (2) │ │ Content (10)  │                          │
│  │ (search, ver)│ │ h2, p, code   │                          │
│  └──────────────┘ └───────────────┘                          │
└───────────────────────────────────────────────────────────────┘
Internal spacing: left nav width 260px on desktop; left nav collapses to top bar on <= 1024px.
Responsive: left nav collapses to off-canvas on mobile; code blocks remain horizontally scrollable.

6) Footer - Full
ASCII:
┌───────────────────────────────────────────────────────────────┐
│ FOOTER (bg: var(--color-bg-surface))                         │
│  ┌────────┬─────────┬─────────┬─────────┐                    │
│  │Col 1   │ Col 2   │ Col 3   │ Col 4   │                    │
│  └────────┴─────────┴─────────┴─────────┘                    │
│  bottom row: legal (13px)                                    │
└───────────────────────────────────────────────────────────────┘
Internal spacing: footer padding 48px; column gap 24px; compact variant uses padding 24px and two columns.

## Responsive & Quality

Breakpoints (specific):
- large-desktop: >= 1440px — container centered at --container-max-width: 1200px; hero display clamps to upper bound.
- desktop: >= 1024px and < 1440px — 12-column grid with gutter: 24px; hero layout two-column.
- tablet: >= 768px and < 1024px — 8-column effective grid; gutters 16px; features grid 2 columns.
- mobile: < 768px — single column; gutters 12px; touch targets min 44x44px.

Concrete changes at each breakpoint:
- >=1440px: increase hero max-width to 1120px; h1 uses clamp upper range so displays near 48px.
- 1024–1439px: features grid 3 columns; nav displays full links.
- 768–1023px: features grid 2 columns; hero right column stacks under left if not enough width; nav collapses to compact variant.
- <768px: single column stack; nav becomes hamburger and a single CTA; buttonPrimary full width when in stacked layout (width: 100%; min-height: 44px).

Mobile-specific overrides:
- Reduce paddings: --container-pad: 16px; --space-section: 24px.
- Reduce hero gap: 20px.
- Increase touch targets: all interactive elements have min-width/min-height 44px.
- Truncate long link lists into "More" collapsible menus.
- Reduce shadows: use --shadow-sm only; set --shadow-md to 0 4px 12px rgba(10,37,64,0.03).

Reduced motion rules:
- CSS respects @media (prefers-reduced-motion: reduce): remove translateY and parallax, set animation durations to 0ms, stop infinite animations (stripe shimmer, spinner continues but static).
- JS respects matchMedia('(prefers-reduced-motion: reduce)') and disables typing demo and staggered reveals.

Quality checklist (12+ concrete items — actionable and testable):
- [ ] All body text contrast ratio >= 4.5:1 against its background (test with color #0A2540 / #FFFFFF).
- [ ] Large headings (h1/h2) maintain contrast >= 3:1.
- [ ] Buttons have min hit area 44x44px and readable text at 14px.
- [ ] Focus rings visible: default focus shows outline: 3px solid rgba(93,192,134,0.22) or equivalent.
- [ ] Keyboard navigation order logical (tabindex follows layout).
- [ ] All interactive states include non-color indicators (icons or labels) for success/error states.
- [ ] Forms validate with ARIA roles: aria-invalid, aria-describedby for error helper text.
- [ ] Images and illustrations include alt text; SVG icons include role="img" and aria-hidden when decorative.
- [ ] Reduced-motion preference respected: no entrance translate or infinite auto-play when set.
- [ ] Code snippets selectable and copy-to-clipboard accessible via keyboard (focusable ButtonIcon).
- [ ] Logos in trust band desaturated to 60% opacity and have max-height: 36px.
- [ ] All shadows limited to stroke: max 0 12px 48px rgba(10,37,64,0.06) — no shadows exceeding 0 20px 80px (banned).
- [ ] No auto-rotating carousels on hero or trust bands; any carousel must be user-controlled and keyboard-operable.
- [ ] No use of color as the sole status indicator: combine color + icon/label for states.
- [ ] All fonts included via Google Fonts import URL and have fallback stacks defined.
- [ ] Minimum font sizes: body 16px, code 13px, micro 11px.
- [ ] Buttons and links have transitions: all 0.15s cubic-bezier(0.4,0,0.2,1) or specified per component.
- [ ] Components are tokenized: colors, spacing, radii, and elevations are implemented as CSS custom properties.
- [ ] Grid gutters and container padding set via tokens and verified at breakpoints.
- [ ] Visual stripe effect in hero implemented as SVG overlay + CSS animation: opacity <= 0.12; rotation -12deg; no heavy neon colors.

Implementation notes and suggestions:
- Replace primary accent with #5DC086 globally; secondary accent remains #00B4FF; success uses #00D084.
- For hero stripe effect: use a lightweight SVG with diagonal lines at 45° rendered as path with stroke: rgba(10,37,64,0.06) and a fill overlay of gradient-accent-2 at low opacity.
- When implementing code typing demo, expose controls: play/pause, speed, and stop. Respect prefers-reduced-motion.
- For Stripe-like nav behavior: implement sticky nav with subtle backdrop-filter blur(6px) and a 1px border; collapse to a hamburger at <= 768px with off-canvas menu.
- Use IntersectionObserver for entrance reveals; stagger children with setTimeout or stagger CSS variables (e.g., --stagger-index) when JS not available.

End of design system.