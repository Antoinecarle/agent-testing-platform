# Endpoint Design Patterns

## Naming Conventions

| Action | Method | Endpoint | Example |
|--------|--------|----------|---------|
| List | GET | `/resources` | `GET /api/users` |
| Get one | GET | `/resources/:id` | `GET /api/users/123` |
| Create | POST | `/resources` | `POST /api/users` |
| Update | PUT | `/resources/:id` | `PUT /api/users/123` |
| Partial update | PATCH | `/resources/:id` | `PATCH /api/users/123` |
| Delete | DELETE | `/resources/:id` | `DELETE /api/users/123` |
| Action | POST | `/resources/:id/action` | `POST /api/users/123/activate` |

## Query Parameters

- `?search=term` — Full-text search
- `?sort=field&order=asc` — Sorting
- `?page=1&limit=20` — Pagination
- `?fields=id,name,email` — Field selection
- `?filter[status]=active` — Filtering

## Pagination

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```
