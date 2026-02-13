# Code Review Standards

## Overview

Systematic code review checklist and patterns for maintaining high code quality across frontend and backend projects.

## Review Priorities (in order)

1. **Correctness** — Does it work? Does it handle edge cases?
2. **Security** — OWASP top 10, injection, auth issues
3. **Performance** — O(n) concerns, unnecessary re-renders, N+1 queries
4. **Maintainability** — Readable? Testable? Single responsibility?
5. **Style** — Naming, formatting (lowest priority, often automated)

## Security Checklist

- [ ] No SQL/NoSQL injection (parameterized queries)
- [ ] No XSS (sanitized output, Content-Security-Policy)
- [ ] No command injection (no `exec()` with user input)
- [ ] Auth checks on all protected routes
- [ ] No secrets in code (API keys, passwords)
- [ ] Input validation at system boundaries
- [ ] CORS properly configured
- [ ] Rate limiting on auth endpoints

## React/Frontend Patterns

### Good
- Components < 200 lines
- Custom hooks for shared logic
- Memoize expensive computations
- Error boundaries around dynamic content
- Proper key props in lists (not index)

### Red Flags
- `useEffect` with missing dependencies
- State that could be derived
- Prop drilling > 3 levels (use context)
- Inline styles repeated across components
- `any` types in TypeScript

## Backend/API Patterns

### Good
- Consistent error response format
- Input validation middleware
- Async error handling (try/catch or middleware)
- Database queries through abstraction layer
- Proper HTTP status codes

### Red Flags
- Raw SQL with string concatenation
- Unhandled promise rejections
- Missing auth middleware on routes
- Logging sensitive data
- N+1 query patterns in loops

## Review Comment Style

- Be specific: "This could throw if `user` is null" (not "handle errors")
- Suggest fixes: "Consider using `user?.name ?? 'Anonymous'`"
- Praise good code: "Nice use of early returns here"
- Ask questions: "Is this intentionally synchronous?"
- Severity prefix: `[nit]`, `[suggestion]`, `[important]`, `[blocking]`
