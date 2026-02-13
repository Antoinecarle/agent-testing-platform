# SaaS Design System

## Overview

A comprehensive design system for modern SaaS applications. Covers components, page templates, color tokens, typography, and responsive patterns.

## Core Principles

1. **Consistency** — Every component follows the same spacing, color, and typography rules
2. **Dark-first** — Dark theme as default, light theme as optional variant
3. **Accessible** — WCAG 2.1 AA compliant contrast ratios
4. **Responsive** — Mobile-first with breakpoints at 640px, 768px, 1024px, 1280px

## File Guide

- `references/components.md` — Full component catalog with CSS specs
- `references/styles/clean-minimal.md` — Clean minimal aesthetic reference
- `assets/tokens.css` — CSS custom properties (design tokens)

## Quick Reference

### Spacing Scale
`4px / 8px / 12px / 16px / 24px / 32px / 48px / 64px / 96px`

### Border Radius
- Small: `4px` (inputs, badges)
- Medium: `8px` (cards, buttons)
- Large: `12px` (modals, containers)
- Round: `9999px` (pills, avatars)

### Shadows
- `sm`: `0 1px 2px rgba(0,0,0,0.05)`
- `md`: `0 4px 6px rgba(0,0,0,0.1)`
- `lg`: `0 10px 25px rgba(0,0,0,0.15)`
- `glow`: `0 0 20px rgba(139,92,246,0.3)`
