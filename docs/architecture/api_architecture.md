# API Architecture & Endpoints Specification

Base Path: `/api/v1`

## API Router Groups
- `/auth`: Sign in, OAuth token exchange, refresh tokens
- `/users`: Profile details, API key management
- `/detection`: Submit media for inference, job status polling
- `/history`: Historical detection records
- `/reports`: Export summary PDFs/CSVs
- `/health`: Health check endpoint for uptime monitors
