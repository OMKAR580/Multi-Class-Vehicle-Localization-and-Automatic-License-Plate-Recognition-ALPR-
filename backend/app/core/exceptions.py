from fastapi import Request, status
from fastapi.responses import JSONResponse
from app.core.logging import logger

class ALPRPlatformException(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class ResourceNotFoundException(ALPRPlatformException):
    def __init__(self, resource_name: str, identifier: str):
        super().__init__(
            message=f"{resource_name} with identifier '{identifier}' was not found.",
            status_code=status.HTTP_404_NOT_FOUND
        )

class InvalidCredentialsException(ALPRPlatformException):
    def __init__(self):
        super().__init__(
            message="Invalid authentication credentials.",
            status_code=status.HTTP_401_UNAUTHORIZED
        )

async def alpr_exception_handler(request: Request, exc: ALPRPlatformException):
    logger.warning(f"Handled exception on {request.url.path}: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "status_code": exc.status_code}
    )

async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred.", "status_code": 500}
    )
