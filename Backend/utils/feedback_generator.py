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
