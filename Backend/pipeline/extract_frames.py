import ffmpeg
import os
import uuid

def extract_frame(video_path):
    """Extracts a single representative frame from the video (at 1 second mark)."""
    try:
        frame_path = f"uploads/videos/frame_{uuid.uuid4()}.jpg"
        (
            ffmpeg
            .input(video_path, ss=1)
            .output(frame_path, vframes=1)
            .overwrite_output()
            .run(quiet=True)
        )
        if os.path.exists(frame_path):
            return frame_path
    except Exception as e:
        print(f"Frame extraction error: {e}")
    return None
