import re
from collections import Counter

def summarize_text(text: str, num_sentences: int = 3) -> str:
    """
    Summarizes text using an extractive fallback summarizer.
    """
    if not text or not text.strip():
        return "No transcript available to summarize."

    # Fallback to extractive summarizer
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    if len(sentences) <= num_sentences:
        return text.strip()

    stop_words = {
        "a", "an", "the", "is", "it", "in", "on", "at", "to", "and", "or",
        "but", "of", "for", "with", "that", "this", "was", "are", "be",
        "as", "by", "from", "so", "if", "about", "up", "we", "i", "you",
        "he", "she", "they", "them", "his", "her", "its", "our", "your",
        "my", "me", "do", "not", "have", "has", "had", "can", "will",
        "would", "could", "should", "also", "just", "like", "um", "uh",
    }

    words = re.findall(r'\b[a-z]+\b', text.lower())
    word_freq = Counter(w for w in words if w not in stop_words)

    def score_sentence(sentence):
        tokens = re.findall(r'\b[a-z]+\b', sentence.lower())
        return sum(word_freq.get(t, 0) for t in tokens if t not in stop_words)

    scored = sorted(enumerate(sentences), key=lambda x: score_sentence(x[1]), reverse=True)
    top_indices = sorted([i for i, _ in scored[:num_sentences]])
    summary = " ".join(sentences[i] for i in top_indices)

    return summary.strip()
