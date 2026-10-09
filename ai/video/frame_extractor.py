"""Video frame extraction module for VisionPlate AI ALPR pipeline."""

import os
import tempfile
import time
from typing import List, Tuple
import cv2

from app.core.config import settings
from app.core.exceptions import InvalidFileException


class VideoFrameExtractor:
    """Extracts sampled frames from video bytes or files safely using OpenCV."""

    def __init__(
        self,
        sampling_fps: float = settings.VIDEO_SAMPLING_FPS,
        max_duration_seconds: float = settings.MAX_VIDEO_DURATION_SECONDS,
        max_dimension: int = settings.MAX_VIDEO_DIMENSION,
        max_frames: int = settings.MAX_VIDEO_FRAMES_PER_JOB,
        max_size_bytes: int = settings.MAX_VIDEO_SIZE_BYTES,
    ):
        self.sampling_fps = sampling_fps
        self.max_duration_seconds = max_duration_seconds
        self.max_dimension = max_dimension
        self.max_frames = max_frames
        self.max_size_bytes = max_size_bytes

    def extract_frames(
        self, video_bytes: bytes, file_id: str
    ) -> Tuple[float, int, int, int, float, List[Tuple[int, float, bytes, int, int]]]:
        """
        Extracts sampled frames from video bytes.

        Args:
            video_bytes: Raw video file bytes.
            file_id: Upload file identifier for reference.

        Returns:
            Tuple of:
            (video_fps, total_frames, video_width, video_height, duration_seconds, sampled_frames)
            where sampled_frames is a list of:
            (frame_index, timestamp_seconds, frame_jpeg_bytes, frame_width, frame_height)
        """
        if not video_bytes or len(video_bytes) == 0:
            raise InvalidFileException("Video file is empty (0 bytes).")

        if len(video_bytes) > self.max_size_bytes:
            raise InvalidFileException(
                f"Video size ({len(video_bytes)} bytes) exceeds maximum limit of {self.max_size_bytes} bytes."
            )

        # Write to isolated temporary file safely
        temp_fd, temp_path = tempfile.mkstemp(suffix=".mp4")
        try:
            with os.fdopen(temp_fd, "wb") as f:
                f.write(video_bytes)

            cap = cv2.VideoCapture(temp_path)
            if not cap.isOpened():
                raise InvalidFileException("Video file is corrupted, truncated, or cannot be decoded.")

            fps = cap.get(cv2.CAP_PROP_FPS)
            if fps <= 0 or fps > 1000:
                fps = 30.0  # Fallback standard FPS if metadata is missing or distorted

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            if total_frames <= 0 or width <= 0 or height <= 0:
                cap.release()
                raise InvalidFileException("Video container contains no valid frames or has invalid dimensions.")

            duration = total_frames / fps

            if duration > self.max_duration_seconds:
                cap.release()
                raise InvalidFileException(
                    f"Video duration ({duration:.1f}s) exceeds maximum allowed limit of {self.max_duration_seconds}s."
                )

            if width > self.max_dimension or height > self.max_dimension:
                cap.release()
                raise InvalidFileException(
                    f"Video dimensions ({width}x{height}) exceed maximum allowed dimension of {self.max_dimension}px."
                )

            # Determine frame sampling step
            step = max(1, int(round(fps / self.sampling_fps)))
            sampled_frames = []

            for frame_idx in range(0, total_frames, step):
                if len(sampled_frames) >= self.max_frames:
                    break

                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if not ret or frame is None:
                    continue

                timestamp = round(frame_idx / fps, 3)

                # Encode frame to JPEG format
                ret_enc, buffer = cv2.imencode(".jpg", frame)
                if not ret_enc:
                    continue

                frame_bytes = buffer.tobytes()
                sampled_frames.append((frame_idx, timestamp, frame_bytes, width, height))

            cap.release()

            if not sampled_frames:
                raise InvalidFileException("Could not extract any valid frames from the video file.")

            return fps, total_frames, width, height, round(duration, 2), sampled_frames

        finally:
            if os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass
