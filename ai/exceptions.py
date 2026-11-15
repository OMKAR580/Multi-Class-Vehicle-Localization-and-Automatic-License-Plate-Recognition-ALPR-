"""Standalone exception definitions for VisionPlate AI Pipeline."""

try:
    from app.core.exceptions import (
        ALPRPlatformException,
        InvalidFileException,
        ModelNotConfiguredException as BackendModelNotConfiguredException,
        RecognitionException as BackendRecognitionException,
    )
except ImportError:
    class ALPRPlatformException(Exception):
        """Base exception when backend is not present."""
        def __init__(self, message: str, status_code: int = 400, code: str = "BAD_REQUEST"):
            self.message = message
            self.status_code = status_code
            self.code = code
            super().__init__(self.message)

    class InvalidFileException(ALPRPlatformException):
        pass

    class BackendModelNotConfiguredException(ALPRPlatformException):
        pass

    class BackendRecognitionException(ALPRPlatformException):
        pass


class PipelineException(ALPRPlatformException):
    """Base exception for all AI/ML pipeline failures."""
    pass


class ModelNotConfiguredException(BackendModelNotConfiguredException, PipelineException):
    """Raised when model checkpoint files are missing or unconfigured."""
    pass


class InvalidImageException(InvalidFileException, PipelineException):
    """Raised when image bytes or array cannot be decoded or has invalid dimensions."""
    pass


class RecognitionException(BackendRecognitionException, PipelineException):
    """Raised when recognition processing fails unexpectedly."""
    pass
