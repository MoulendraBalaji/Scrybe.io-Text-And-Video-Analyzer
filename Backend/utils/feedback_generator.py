import os
import json
import re
from collections import Counter

# Common English stop words to ignore during concept extraction
_STOP_WORDS = {
    "a", "an", "the", "is", "it", "in", "on", "at", "to", "and", "or",
    "but", "of", "for", "with", "that", "this", "was", "are", "be",
    "as", "by", "from", "so", "if", "about", "up", "we", "i", "you",
    "he", "she", "they", "them", "his", "her", "its", "our", "your",
    "my", "me", "do", "not", "have", "has", "had", "can", "will",
    "would", "could", "should", "also", "just", "like", "um", "uh",
    "when", "then", "than", "what", "which", "who", "how", "there",
    "their", "been", "being", "into", "through", "during", "before",
    "after", "because", "while", "where", "were", "more", "most",
    "other", "some", "such", "no", "nor", "very", "still", "each",
    "few", "get", "got", "may", "any", "all", "both", "between",
    "same", "different", "use", "used", "using", "make", "made", "one",
    "two", "three", "first", "second", "last", "much", "many",
}

def _extract_keywords(text: str, top_n: int = 15) -> list[str]:
    """Extract the top N significant keywords from a text, sorted by frequency."""
    tokens = re.findall(r'\b[a-z]{3,}\b', text.lower())
    filtered = [w for w in tokens if w not in _STOP_WORDS]
    freq = Counter(filtered)
    return [word for word, _ in freq.most_common(top_n)]

def _keyword_present(keyword: str, text: str) -> bool:
    """Check if a keyword (or its partial root) appears in the text."""
    text_lower = text.lower()
    # Direct match
    if keyword in text_lower:
        return True
    # Partial / root match
    root = keyword[:5].lower()
    if len(root) >= 4 and root in text_lower:
        return True
    return False

def generate_feedback(transcript: str, reference_answer: str, score: float) -> dict:
    """
    Generate structured feedback by comparing the transcript against the reference 
    using keyword extraction and basic comparison.
    """
    if not transcript or not transcript.strip():
        return {
            "strengths": [],
            "missing": [],
            "suggestion": "No speech detected.",
            "suggestions": [],
            "deep_dive": "No data for deep dive."
        }

    ref_keywords = _extract_keywords(reference_answer, top_n=10)
    
    # Keyword-based baseline detection
    strengths_kw = [kw for kw in ref_keywords if _keyword_present(kw, transcript)]
    missing_kw = [kw for kw in ref_keywords if kw not in strengths_kw]

    strengths = [f"You correctly addressed the key point: {kw}." for kw in strengths_kw[:5]]
    if not strengths:
        strengths = ["Your response lacked alignment with the core key points."]

    missing = [f"You missed discussing the concept of {kw}." for kw in missing_kw[:5]]
    if not missing:
        missing = ["You covered most of the essential key points effectively."]

    return {
        "strengths": strengths,
        "missing": missing,
        "suggestions": [{"type": "General", "content": "Review the reference answer and incorporate missing concepts."}],
        "suggestion": "Focus on ensuring all critical keywords from the reference are naturally covered.",
        "deep_dive": "Based on keyword analysis, your answer captured " + str(len(strengths_kw)) + " out of " + str(len(ref_keywords)) + " primary concepts from the reference answer."
    }

# ============================================================
# STRUCTURE ASSESSMENT — rubric dimension "structure"
# One LLM call when a key is configured (Gemini preferred,
# OpenAI fallback), otherwise a deterministic heuristic that
# scores opening / body / closing presence.
# ============================================================

_STRUCTURE_PROMPT = (
    "You are a speech coach scoring the STRUCTURE of a spoken answer on a scale of 0-100. "
    "Return ONLY a JSON object with keys: score (number), feedback (one specific, short sentence). "
    "A structured answer has a clear opening that restates or frames the question, a body with "
    "logical progression, and a closing that summarizes or lands a takeaway.\n\n"
    "TRANSCRIPT:\n{transcript}"
)

_OPENING_MARKERS = ("let me", "so,", "in short", "first", "i think", "i believe", "to answer", "the question", "i'd say", "i would say", "sure,", "of course,", "absolutely,")
_CLOSING_MARKERS = ("in summary", "in conclusion", "to sum up", "to wrap up", "overall,", "all in all", "finally", "in short", "so to summarize", "bottom line", "that's why", "ultimately,")


def _llm_structure_assessment(transcript: str) -> dict | None:
    """Try Gemini then OpenAI; return {"score": int, "feedback": str} or None."""
    prompt = _STRUCTURE_PROMPT.format(transcript=transcript[:4000])
    result_text = None

    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_key and gemini_key != "YOUR_GEMINI_API_KEY":
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            result_text = response.text
        except Exception as e:
            print(f"Gemini structure assessment failed: {e}")

    if not result_text:
        openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        if openai_key and openai_key != "YOUR_OPENAI_API_KEY":
            try:
                from openai import OpenAI
                client = OpenAI(api_key=openai_key)
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                    max_tokens=200,
                )
                result_text = response.choices[0].message.content
            except Exception as e:
                print(f"OpenAI structure assessment failed: {e}")

    if not result_text:
        return None

    try:
        cleaned = re.sub(r"```(?:json)?|```", "", result_text).strip()
        data = json.loads(cleaned)
        return {
            "score": int(max(0, min(100, float(data.get("score", 50))))),
            "feedback": str(data.get("feedback", "")).strip() or "Your answer structure could be tightened.",
        }
    except Exception:
        return None


def generate_structure_assessment(transcript: str) -> dict:
    """Return {"score": 0-100, "feedback": str} for the structure dimension."""
    if not transcript or not transcript.strip():
        return {"score": 0, "feedback": "No speech detected to evaluate structure."}

    llm = _llm_structure_assessment(transcript)
    if llm:
        return llm

    # ---- heuristic fallback (no LLM key configured) ----
    sentences = re.split(r'(?<=[.!?])\s+', transcript.strip())
    sentences = [s for s in sentences if s.strip()]
    if not sentences:
        return {"score": 0, "feedback": "No speech detected to evaluate structure."}

    lower = transcript.lower()
    opening = any(m in lower for m in _OPENING_MARKERS)
    closing = any(m in lower for m in _CLOSING_MARKERS)

    body_score = min(100.0, (len(sentences) - 1) * 15 + 10)  # a couple of sentences earn a decent body
    score = 20.0
    if opening:
        score += 30
    if body_score:
        score += 30 * (body_score / 100.0)
    if closing:
        score += 20
    score = round(max(5, min(100, score)))

    feedback = "Your answer has a clear start" if opening else "Your answer jumps straight in without framing the question"
    if len(sentences) >= 3:
        feedback += " and develops the idea,"
    else:
        feedback += " but stays short —"
    feedback += " yet there's no clear sign-off" if not closing else " finishing with a clean close. Good narrative shape."

    return {"score": score, "feedback": feedback}


def generate_follow_up(transcript: str, reference_answer: str, missing_concepts: list[str] | None = None) -> str:
    """
    Generate one targeted follow-up question on the candidate's weakest
    missing concept, turning a single submission into a mock-interview thread.
    """
    ref_keywords = _extract_keywords(reference_answer, top_n=8)
    if not ref_keywords:
        return "What was the single most important point you were trying to make?"

    if missing_concepts:
        target = next((k for k in missing_concepts if k and len(k) >= 3), None)
    else:
        target = next((kw for kw in ref_keywords if not _keyword_present(kw, transcript)), None)

    if not target:
        target = ref_keywords[0]

    return (
        f"You covered '{target}' only lightly. Take another shot and explain "
        f"how '{target}' connects to the bigger picture - imagine you are teaching "
        f"it to someone hearing it for the first time."
    )
