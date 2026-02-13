# Frontend Development Patterns

## Overview

React and TypeScript best practices, component patterns, state management, and testing strategies for modern frontend applications.

## Core Stack

- **Framework**: React 18+ with hooks
- **Language**: TypeScript (strict mode)
- **Styling**: CSS Modules / Tailwind CSS / CSS-in-JS
- **State**: React Query for server state, Zustand for client state
- **Routing**: React Router v6+
- **Testing**: Vitest + React Testing Library

## File Guide

- `references/hooks.md` — Custom hook patterns and recipes
- `references/components.md` — Component architecture and patterns
- `assets/tsconfig.json` — Recommended TypeScript configuration

## Principles

1. **Composition over inheritance** — Build small, composable components
2. **Colocation** — Keep related code close together
3. **Type safety** — Leverage TypeScript for self-documenting APIs
4. **Server state separation** — Use React Query for async data, local state for UI
5. **Testing behavior** — Test what users see and do, not implementation details
