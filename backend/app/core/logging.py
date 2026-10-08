import logging
import sys

from app.core.config import settings


def setup_logging() -> logging.Logger:
    """Configure stdout logging for both application and request loggers."""
    root = logging.getLogger()
    root.setLevel(getattr(logging, settings.LOG_LEVEL, logging.INFO))

    if not any(getattr(handler, "_alpr_configured", False) for handler in root.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter(
                "[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
        handler._alpr_configured = True
        root.addHandler(handler)

    return logging.getLogger("alpr_platform")


logger = setup_logging()
