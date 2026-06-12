import subprocess

def extract_audio(video_path, audio_path):

    command = [
        "ffmpeg",
        "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "44100",
        "-ac", "2",
        audio_path
    ]

    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    if result.returncode != 0:
        error_output = result.stderr.decode('utf-8')
        if "Invalid data found when processing input" in error_output or "moov atom not found" in error_output:
            raise Exception("The uploaded file does not contain valid video data. It appears to be a text or HTML file renamed to .mp4, or the video file is corrupted. Please ensure you are uploading a real video file.")
        raise Exception(f"FFmpeg failed: {error_output}")

    return audio_path