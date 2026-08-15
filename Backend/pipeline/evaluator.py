import os
import uuid

from pipeline.extract_audio import extract_audio
from pipeline.speech_to_text import transcribe_audio_with_segments
from pipeline.text_cleaning import clean_text
from models.similarity_model import calculate_similarity
from utils.score_calculator import convert_to_score
from utils.summarizer import summarize_text
from utils.feedback_generator import generate_feedback
from pipeline.extract_frames import extract_frame
from utils.frame_analyzer import compare_frame_with_reference
from utils.rubric import compute_rubric


def evaluate(video_path, reference_answer):

    audio_path = f"uploads/audio/{uuid.uuid4()}.wav"
    frame_path = None

    try:
        # Attempt visual analysis first, will gracefully fail / return None if audio-only
        frame_path = extract_frame(video_path)
        visual_feedback = None
        if frame_path:
            visual_feedback = compare_frame_with_reference(frame_path, reference_answer)

        extract_audio(video_path, audio_path)

        transcript, segments = transcribe_audio_with_segments(audio_path)

        clean_answer = clean_text(transcript)

        similarity = calculate_similarity(clean_answer, reference_answer)

        score = convert_to_score(similarity)

        summary = summarize_text(transcript)

        feedback = generate_feedback(transcript, reference_answer, score)

        # Five-dimension rubric — the single opaque score is replaced
        # by legible sub-scores, each with its own feedback.
        rubric = compute_rubric(
            transcript,
            segments,
            reference_answer,
            similarity,
            visual_feedback,
        )

        return {
            "transcript": transcript,
            "summary": summary,
            "similarity": similarity,
            "score": rubric["overall"],
            "rubric": rubric,
            "feedback": feedback,
            "visual_feedback": visual_feedback or "No visual data detected or analysis failed.",
            "transcript_segments": segments,
            "duration_seconds": round(segments[-1]["end"], 2) if segments else None,
            "message": "Evaluation completed successfully"
        }
    except Exception as e:
        return {
            "error": str(e)
        }
    finally:
        # Cleanup
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
        if frame_path and os.path.exists(frame_path):
            os.remove(frame_path)