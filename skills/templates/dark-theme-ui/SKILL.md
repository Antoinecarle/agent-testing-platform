# Dark Theme UI Design System

## Overview

Premium dark-themed interface design system for SaaS, AI, and tech products. Inspired by Linear, Vercel, Raycast, and Apple's design language.

## Color System

### Background Layers
```
Layer 0 (deepest):  #0a0a0a — App background
Layer 1 (surface):  #141415 — Cards, sidebars
Layer 2 (elevated): #1e1e20 — Modals, dropdowns
Layer 3 (float):    #282828 — Tooltips, popovers
```

### Border System
```
Subtle:   rgba(255, 255, 255, 0.06)
Default:  rgba(255, 255, 255, 0.10)
Strong:   rgba(255, 255, 255, 0.16)
Focus:    accent color at 60% opacity
```

### Accent Colors
```
Primary:  #8B5CF6 (violet)
Success:  #22C55E
Warning:  #F59E0B
Danger:   #EF4444
Info:     #3B82F6
```

### Text Hierarchy
```
Primary:    #F4F4F5 — Headings, important text
Secondary:  #A1A1AA — Body text, descriptions
Muted:      #52525B — Labels, placeholders
Disabled:   #3F3F46 — Disabled state
```

## Typography

- **Headings**: Inter, -0.02em tracking, weight 600-700
- **Body**: Inter, 14px base, line-height 1.6
- **Mono**: JetBrains Mono or Fira Code, 12-13px
- **Labels**: 10px uppercase, 0.05em tracking, weight 600

## Component Patterns

### Cards
- Background: Layer 1
- Border: subtle (0.06 opacity)
- Border-radius: 8px
- Hover: border transitions to accent color
- Shadow on hover: `0 4px 20px accent-color/10`

### Buttons
- Primary: white bg (#F4F4F5), dark text (#0a0a0a)
- Secondary: Layer 2 bg, subtle border
- Ghost: transparent, text color on hover
- All: 4px radius, 12px font, 600 weight

### Inputs
- Background: Layer 0 (#0a0a0a)
- Border: default opacity
- Focus: accent border with glow
- Padding: 10px 12px
- Font: 13px

## Glassmorphism (use sparingly)

```css
.glass {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```

## Animation Guidelines

- Transitions: 150-200ms ease
- Hover states: color/border transitions only
- Page transitions: fade 200ms
- Loading: subtle pulse or skeleton
- No bouncing or elastic animations
