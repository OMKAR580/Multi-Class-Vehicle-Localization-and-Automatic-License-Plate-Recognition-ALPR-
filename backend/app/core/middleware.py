"""Request logging middleware."""

import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response



logger = logging.getLogger("app.request")


async def log_requests(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Log method, path, status and duration without query strings or secrets."""
    start = time.perf_counter()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "%s %s -> %d (%.1f ms)",
            request.method,
            request.url.path,
            status_code,
            duration_ms,
        )

