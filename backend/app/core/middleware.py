"""Request logging middleware."""

import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

from app.core.logging import get_logger

logger = get_logger("app.request")


async def log_requests(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Log method, path, status and duration for each request.

    Only the path is logged: query strings, headers and bodies may carry
    tokens or personal data and are deliberately excluded.
    """
    start = time.perf_counter()

    response = await call_next(request)

    duration_ms = (time.perf_counter() - start) * 1000

    logger.info(
        "%s %s -> %d (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )

    return response