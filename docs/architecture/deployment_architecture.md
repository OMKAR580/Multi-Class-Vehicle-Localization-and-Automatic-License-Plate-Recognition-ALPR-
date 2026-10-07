# Infrastructure & Local Deployment Architecture

## Container Orchestration
Local development and single-server production deployment are managed via `docker-compose.yml`:
- Service 1: `postgres` (PostgreSQL 16)
- Service 2: `redis` (Redis 7)
- Service 3: `backend` (FastAPI Python API)
- Service 4: `frontend` (Next.js Node Web Application)

## Scalability Boundary
AI worker instances run as separate worker boundaries scale-able horizontally without modifying API backend code.
