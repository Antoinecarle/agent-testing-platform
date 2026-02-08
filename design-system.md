# Agent Testing Platform - Design System

## Design Tokens

```jsx
const tokens = {
  colors: {
    bg: '#0f0f0f',
    surface: '#1a1a1b',
    surfaceElevated: '#242426',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    violet: '#8B5CF6',
    violetMuted: 'rgba(139, 92, 246, 0.2)',
    violetGlow: 'rgba(139, 92, 246, 0.12)',
    textPrimary: '#F4F4F5',
    textSecondary: '#A1A1AA',
    textMuted: '#52525B',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '48px',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
  font: {
    family: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  }
};
```

## Style: Dark Minimal Violet (Lighter Variant)
- Background: softer dark (#0f0f0f) - plus clair que near-black
- Surfaces: medium dark grays (#1a1a1b, #242426) - meilleur contraste
- Accent: violet/purple (#8B5CF6) for interactive elements
- Borders: slightly more visible white opacity (0.08-0.15)
- Text: white to gray hierarchy (F4F4F5 -> A1A1AA -> 52525B)
- Hover effects: violet glow/border transitions
- Cards: dark surface with 1px border, hover glow
- Typography: Inter for UI, monospace for code/terminal
- Scale: refined (compact, elegant sizing)
- Animations: subtle, cubic-bezier easing
- Layout: grid-based, responsive

## Component Patterns

### Card
```
backgroundColor: surface (#1a1a1b)
border: 1px solid border (rgba 255,255,255,0.08)
borderRadius: 8px
padding: 24px
hover: border-color -> violet, box-shadow violet glow
```

### Badge
```
display: inline-flex
padding: 4px 10px
borderRadius: 100px
background: violetMuted
border: 1px solid violet
color: violet
fontSize: 11px
fontWeight: 600
letterSpacing: 0.05em
textTransform: uppercase
```

### Button Primary
```
backgroundColor: textPrimary (#F4F4F5)
color: bg (#0f0f0f)
border: none
borderRadius: 4px
padding: 6px 14px
fontSize: 12px
fontWeight: 600
```

### Button Secondary
```
backgroundColor: surfaceElevated (#242426)
color: textSecondary
border: 1px solid borderStrong
borderRadius: 4px
padding: 6px 14px
fontSize: 12px
fontWeight: 600
```

### Nav Link
```
color: textMuted (#52525B)
fontSize: 13px
fontWeight: 500
hover: color -> textPrimary
transition: color 0.2s
```

### Title (h1)
```
fontSize: 36px
fontWeight: 700
letterSpacing: -0.02em
gradient: textPrimary to textSecondary
```

### Terminal Preview
```
backgroundColor: bg (#0f0f0f)
border: 1px solid borderStrong
borderRadius: 12px
padding: 16px
fontFamily: monospace
fontSize: 15px
```

---

## Branding: guru.ai

### Logo
**Style:** Pixel art minimaliste 8x8 grid
**Couleurs:** 
- Base: Violet (#8B5CF6)
- Highlights: Light violet (#c4b5fd, #a78bfa)  
- Accents: Deep violet (#7c3aed, #6d28d9)
- Eyes: White (#F4F4F5)

**Concept:** 
Tête de guru stylisée en pixel art avec une aura/halo au-dessus, représentant la sagesse et l'intelligence artificielle. Design minimaliste et reconnaissable même à petite taille.

### Typography
**Logo text:** 
- Font: "Press Start 2P" (pixel font) avec fallback sur "JetBrains Mono"
- guru: blanc (#F4F4F5)
- .ai: violet (#8B5CF6)

**Usage:**
- Navbar: 28px avec texte
- Hero sections: 64px avec glow effect
- Favicon: SVG pixel art 16x16

### Philosophie
Le branding guru.ai combine :
- **Pixel art** pour un look rétro-moderne distinctif
- **Minimalisme** pour la clarté et la reconnaissance
- **Qualité** avec des détails soignés (aura, smile, highlights)
- **Violet** comme couleur signature tech/AI
