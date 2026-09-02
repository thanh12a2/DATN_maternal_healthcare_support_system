# Kong API Gateway

## Overview

The API Gateway serves as the single entry point for client requests. It routes incoming requests to backend services through Docker Compose service names.

## Responsibilities

- Request routing.
- CORS handling.
- Future authentication enforcement/JWT verification for protected business routes.
- Future rate limiting for public auth endpoints.

Gateway must not contain business logic.

## Tech Stack

| Component | Choice |
|---|---|
| Gateway | Kong Gateway 3.9 with PostgreSQL |
| Kong database | Dedicated PostgreSQL service `kong-database` |

## Current Routing Table

| External Path | Target Service | Internal URL | Notes |
|---|---|---|---|
| `/auth/*` | Auth Service | `http://auth-service:5003/auth/*` | Public auth endpoints, register/login/refresh/logout future implementation |
| `/health` | Auth Service | `http://auth-service:5003/health` | Auth Service health check |
| `/.well-known/jwks.json` | Auth Service | `http://auth-service:5003/.well-known/jwks.json` | Public JWKS for future JWT validation |
| `/api/sample-service/*` | Sample Service | `http://sample-service:5000/*` | Template/sample route |
| `/api/doctors/*` | Doctor Service | `http://doctor-service:5005/*` | Doctor directory and availability; internal routes are not public |

Current Kong config is in:

```text
docs/api-specs/kong.yml
```

## Running

```bash
# From project root
docker compose up gateway --build
```

Kong listens on:

```text
http://localhost:8080
```

Kong Admin API is local-only:

```text
http://localhost:8001
```

Kong Manager is local-only:

```text
http://localhost:8002
```

## Notes

- Use Docker Compose service names for upstream URLs, not `localhost`.
- Kong proxy exposes host port `8080` by default.
- Kong Admin API and Manager are bound to `127.0.0.1` only.
- Kong database is separate from Auth Database.
- Kong verifies Patient access tokens with the RS256 JWT plugin; Patient Service verifies them again for defense in depth.

## Kong database import behavior

`gateway/init-kong.sh` runs migrations and imports `docs/api-specs/kong.yml` on every initialization, so route and plugin changes are applied to an existing `kong-data` volume without destructive reset. The stable JWT credential is provisioned only when its configured key does not already exist, making repeated Compose startup idempotent.

Provide `AUTH_JWT_PUBLIC_KEY` and `AUTH_JWT_KEY_ID` before startup. Never delete a non-local Kong volume merely to apply configuration changes.
