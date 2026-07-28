# Kong API Gateway

## Overview

The API Gateway serves as the single entry point for all client requests. It routes incoming requests to the appropriate backend microservice.

## Responsibilities

- **Request routing**: Forward requests to the correct service
- **Load balancing**: Distribute traffic (if applicable)
- **Authentication**: Validate tokens/credentials (optional)
- **Rate limiting**: Protect services from overload (optional)
- **CORS handling**: Allow frontend cross-origin requests
- **Request/Response transformation**: Modify headers, paths as needed

## Tech Stack

| Component  | Choice             |
|------------|--------------------|
| Approach   | Kong Gateway 3.9 with PostgreSQL |

## Routing Table

| External Path        | Target Service | Internal URL                   |
|----------------------|----------------|--------------------------------|
| `/api/service-a/*`   | Service A      | `http://service-a:5000/*`      |
| `/api/service-b/*`   | Service B      | `http://service-b:5000/*`      |

## Running

```bash
# From project root
docker compose up gateway --build
```

Kong listens on `http://localhost:8080`. Its Admin API is local-only at
`http://localhost:8001`; for example, `curl http://localhost:8001/status`.
Kong Manager is local-only at `http://localhost:8002`.

## Routes

On the first start, the configuration in [`kong.yml`](../docs/api-specs/kong.yml) is imported into Kong's PostgreSQL database. The gateway removes
the route prefix before forwarding requests, so this request:

```bash
curl http://localhost:8080/api/service-a/health
```

is forwarded to `http://service-a:5000/health` inside the Compose network.

After initialization, manage routes through Kong Manager or the Admin API. To
replace the database with a freshly imported `kong.yml`, intentionally remove
the `kong-data` volume and start again:

```bash
docker compose down --volumes
docker compose up --build
```

## Configuration

The gateway uses Docker Compose networking. Services are accessible by their
service names defined in `docker-compose.yml` (e.g., `service-a`, `service-b`).

## Notes

- Use service names (not `localhost`) for upstream URLs inside Docker
- The proxy exposes port 8080 to the host
- The Admin API exposes port 8001 only on `127.0.0.1`
- Kong Manager exposes port 8002 only on `127.0.0.1`
- Kong's PostgreSQL database is internal-only and persists in the `kong-data` volume
