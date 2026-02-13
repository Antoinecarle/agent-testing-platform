# API Design Conventions

## Overview

REST API design patterns, error handling, authentication, validation, and documentation standards for building robust backend services.

## Core Principles

1. **RESTful resources** — Use nouns for endpoints, HTTP verbs for actions
2. **Consistent responses** — Every endpoint returns the same shape
3. **Proper status codes** — Use the right HTTP status for each scenario
4. **Validation at boundaries** — Validate all input at the API layer
5. **Meaningful errors** — Error responses include code, message, and details

## File Guide

- `references/endpoints.md` — Endpoint design patterns and naming
- `references/errors.md` — Error handling and status codes
- `assets/openapi-template.yaml` — OpenAPI 3.0 template

## Response Format

### Success
```json
{
  "data": { ... },
  "meta": { "page": 1, "total": 100 }
}
```

### Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Must be a valid email" }
    ]
  }
}
```
