import logging
import sys
from app.core.config import settings

def setup_logging():
    logging_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    logger = logging.getLogger("alpr_platform")
    logger.setLevel(logging_level)
    
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
    return logger

logger = setup_logging()
