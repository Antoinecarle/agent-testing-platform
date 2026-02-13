# Error Handling

## HTTP Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST (resource created) |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input, validation failure |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource, version conflict |
| 422 | Unprocessable | Valid syntax but semantic error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Unexpected server error |

## Error Codes

```javascript
const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_REQUIRED: 401,
  INSUFFICIENT_PERMISSIONS: 403,
  RESOURCE_NOT_FOUND: 404,
  DUPLICATE_RESOURCE: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};
```

## Error Middleware Pattern

```javascript
function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';
  
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  }
  
  res.status(status).json({
    error: { code, message, details: err.details || null }
  });
}
```
