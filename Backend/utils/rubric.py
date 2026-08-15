"""
Scrybe Rubric — replaces the single opaque score with five legible
dimensions, each with its own sub-score and short, specific feedback.

  content_accuracy  existing hybrid semantic + keyword score (unchanged)
  filler_words      filler rate per minute, computed directly off the transcript
  pace              words per minute + variance across segments (Whisper timestamps)
  structure         opening/body/close, one LLM call (feedback_generator)
  visual_presence   existing face-detection signal, unchanged

The overall score is a weighted blend; weights are exposed so any
result can be explained ("How this score was calculated").
"""

import re
import statistics

from utils.feedback_generator import generate_structure_assessment

RUBRIC_WEIGHTS = {
    "content_accuracy": 35,
    "structure": 20,
    "filler_words": 15,
    "pace": 15,
    "visual_presence": 15,
}

RUBRIC_LABELS = {
    "content_accuracy": "Content accuracy",
    "structure": "Structure",
    "filler_words": "Filler words",
    "pace": "Pace",
    "visual_presence": "Visual presence",
}

# Single-word fillers and multi-word verbal tics
FILLER_WORDS = {
    "um", "uh", "uhh", "umm", "ah", "er", "eh", "hmm", "mm",
    "like", "actually", "basically", "literally", "so", "right", "well",
    "anyway", "honestly", "you know",
}
FILLER_PHRASES = [
    "you know", "i mean", "kind of", "sort of", "kinda", "sorta",
    "at the end of the day", "to be honest", "in my opinion i think",
]


def _word_count(text: str) -> int:
    if not text:
        return 0
    return len(re.findall(r"\b[\w'-]+\b", text))


def _duration_seconds(segments: list[dict] | None, transcript_duration: float | None = None) -> float:
    if segments:
        return max(segments[-1].get("end", 0.0) - segments[0].get("start", 0.0), segments[-1].get("end", 0.0))
    return transcript_duration or 0.0


def _count_fillers(transcript: str) -> int:
    lower = transcript.lower()
    count = 0
    for phrase in FILLER_PHRASES:
        count += len(re.findall(re.escape(phrase), lower))
    tokens = re.findall(r"\b[a-z']+\b", lower)
    for token in tokens:
        if token in FILLER_WORDS and token not in ("so", "right", "well", "like"):
            # bare interjection vs. legitimate discourse usage — count it regardless,
            # the per-minute rate is the metric, not the absolute number.
            pass
    # word-level fillers (exclude legitimate "so/well/right" connectives from the word pass;
    # phrase pass already catches the strongest tics)
    word_fillers = {"um", "uh", "uhh", "umm", "ah", "er", "eh", "hmm", "mm", "like", "actually", "basically", "literally"}
    count += sum(1 for t in tokens if t in word_fillers)
    return count


def content_dimension(similarity: float) -> dict:
    score = round(max(0.0, min(1.0, similarity)) * 100, 1)
    if score >= 80:
        feedback = "Strong alignment with the reference: the core points came through clearly."
    elif score >= 60:
        feedback = "Reasonable coverage, but some important concepts were only touched lightly."
    else:
        feedback = "The answer diverged from the reference. Revisit the key points you were asked to cover."
    return {"score": score, "feedback": feedback, "detail": f"{score:.0f}/100 hybrid similarity"}


def filler_dimension(transcript: str, duration_seconds: float) -> dict:
    fillers = _count_fillers(transcript) if transcript else 0
    minutes = max(duration_seconds / 60.0, 0.05)
    rate = fillers / minutes

    if rate <= 2:
        score = 95.0 - max(0, (2 - rate)) * 0  # excellent
        score = min(100, score)
        feedback = "Clean delivery — almost no verbal tics."
    elif rate <= 5:
        score = 78.0
        feedback = "A few filler words crept in; they're noticeable but not distracting."
    elif rate <= 10:
        score = 58.0
        feedback = "Filler words ('um', 'like', 'you know') appear regularly. Pause instead of reaching for them."
    else:
        score = 38.0
        feedback = "Heavy filler usage is hurting your credibility. Replace fillers with deliberate pauses."
    return {
        "score": round(score, 1),
        "feedback": feedback,
        "detail": f"{rate:.1f} fillers/min ({fillers} total)",
    }


def pace_dimension(transcript: str, segments: list[dict] | None) -> dict:
    words = _word_count(transcript)
    duration = _duration_seconds(segments)
    minutes = max(duration / 60.0, 0.05)
    wpm = words / minutes

    ideal = (120, 165)
    if wpm < ideal[0]:
        pace_score = max(30.0, 100 - (ideal[0] - wpm) * 0.6)
        pace_note = "deliberate but slow"
    elif wpm > ideal[1]:
        pace_score = max(30.0, 100 - (wpm - ideal[1]) * 0.6)
        pace_note = "rushed"
    else:
        pace_score = 100.0
        pace_note = "well-paced"

    variance = 0.0
    per_seg = []
    if segments and len(segments) >= 2:
        for seg in segments:
            seg_dur = seg.get("end", 0) - seg.get("start", 0)
            seg_words = _word_count(seg.get("text", ""))
            if seg_dur > 1.0 and seg_words > 0:
                per_seg.append(seg_words / (seg_dur / 60.0))
    if len(per_seg) >= 2:
        variance = float(statistics.pstdev(per_seg))

    score = pace_score
    if variance > 90:
        score -= 18
        pace_note += " with uneven rhythm (rushed start / trailing ending)"
    elif variance > 55:
        score -= 8
        pace_note += " with some unevenness"

    score = round(max(5.0, min(100.0, score)), 1)
    feedback = (
        f"Speech ran at {wpm:.0f} wpm — {pace_note}. "
        "Aim for 120–165 wpm and keep the rhythm steady from opener to close."
    )
    return {"score": score, "feedback": feedback, "detail": f"{wpm:.0f} wpm · variance {variance:.0f}"}


def visual_dimension(visual_feedback: str | None) -> dict:
    text = (visual_feedback or "").lower()
    if not text or "unavailable" in text or "unable to" in text:
        return {
            "score": 50.0,
            "feedback": "No reliable visual signal was captured, so this dimension is neutral. Lighting and framing matter — but are not competence.",
            "detail": "No frame signal",
        }
    if "detected" in text and "face" in text:
        m = re.search(r"(\d+)\s+face", text)
        faces = int(m.group(1)) if m else 1
        score = min(95.0, 70 + faces * 10)
        feedback = "Good visual presence — you stayed in frame and on camera."
        detail = f"{faces} face detected in frame"
    else:
        score = 55.0
        feedback = "Your face wasn't clearly detected. Improve lighting and framing — appearance is not a proxy for ability."
        detail = "No clear face detected"
    return {"score": round(score, 1), "feedback": feedback, "detail": detail}


def compute_rubric(
    transcript: str,
    segments: list[dict] | None,
    reference_answer: str,
    similarity: float,
    visual_feedback: str | None,
) -> dict:
    """Full 5-dimension rubric. Never raises: every dimension degrades gracefully."""
    duration = _duration_seconds(segments)

    content = content_dimension(similarity)
    structure = generate_structure_assessment(transcript)
    filler = filler_dimension(transcript, duration)
    pace = pace_dimension(transcript, segments)
    visual = visual_dimension(visual_feedback)

    dims = {
        "content_accuracy": {**content, "label": RUBRIC_LABELS["content_accuracy"]},
        "structure": {"score": structure["score"], "feedback": structure["feedback"], "detail": "Opening / body / close", "label": RUBRIC_LABELS["structure"]},
        "filler_words": {**filler, "label": RUBRIC_LABELS["filler_words"]},
        "pace": {**pace, "label": RUBRIC_LABELS["pace"]},
        "visual_presence": {**visual, "label": RUBRIC_LABELS["visual_presence"]},
    }

    overall = sum(dims[k]["score"] * (RUBRIC_WEIGHTS[k] / 100.0) for k in RUBRIC_WEIGHTS)
    overall = round(max(0.0, min(100.0, overall)), 1)

    return {
        "overall": overall,
        "weights": RUBRIC_WEIGHTS,
        "dimensions": dims,
    }
