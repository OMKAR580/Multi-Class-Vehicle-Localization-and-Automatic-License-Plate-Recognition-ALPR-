"""Unit tests for VideoFrameExtractor module."""

import os
import tempfile
import cv2
import numpy as np
import pytest

from ai.video.frame_extractor import VideoFrameExtractor
from app.core.exceptions import InvalidFileException


def create_synthetic_mp4_bytes(
    width: int = 320,
    height: int = 240,
    fps: float = 10.0,
    num_frames: int = 10,
) -> bytes:
    """Helper to generate a synthetic valid MP4 video in memory."""
    fd, path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    try:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(path, fourcc, fps, (width, height))
        for _ in range(num_frames):
            frame = np.zeros((height, width, 3), dtype=np.uint8)
            out.write(frame)
        out.release()

        with open(path, "rb") as f:
            return f.read()
    finally:
        if os.path.exists(path):
            os.unlink(path)


def test_video_extractor_empty_bytes():
    """Empty video bytes raise InvalidFileException."""
    extractor = VideoFrameExtractor()
    with pytest.raises(InvalidFileException, match="Video file is empty"):
        extractor.extract_frames(b"", "test_file_id")


def test_video_extractor_corrupt_bytes():
    """Garbage bytes raise InvalidFileException."""
    extractor = VideoFrameExtractor()
    with pytest.raises(InvalidFileException, match="corrupted, truncated, or cannot be decoded"):
        extractor.extract_frames(b"NOT_A_VIDEO_CONTAINER_STREAM_DATA", "test_file_id")


def test_video_extractor_oversized_bytes():
    """Video exceeding max_size_bytes raises InvalidFileException."""
    extractor = VideoFrameExtractor(max_size_bytes=100)
    video_bytes = create_synthetic_mp4_bytes()
    with pytest.raises(InvalidFileException, match="Video size"):
        extractor.extract_frames(video_bytes, "test_file_id")


def test_video_extractor_successful_extraction():
    """Valid synthetic video produces frame tuples with correct FPS and timestamps."""
    video_bytes = create_synthetic_mp4_bytes(width=320, height=240, fps=10.0, num_frames=20)
    extractor = VideoFrameExtractor(sampling_fps=1.0)
    fps, total_frames, w, h, duration, sampled_frames = extractor.extract_frames(
        video_bytes, "test_file_id"
    )

    assert fps == pytest.approx(10.0, rel=1e-2)
    assert total_frames == 20
    assert w == 320
    assert h == 240
    assert duration == pytest.approx(2.0, rel=1e-2)
    assert len(sampled_frames) > 0

    for f_idx, ts, frame_bytes, frame_w, frame_h in sampled_frames:
        assert isinstance(f_idx, int)
        assert ts >= 0.0
        assert len(frame_bytes) > 0
        assert frame_w == 320
        assert frame_h == 240
