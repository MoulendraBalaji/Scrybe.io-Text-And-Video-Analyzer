import re

def clean_text(text):

    text = text.lower()

    text = re.sub(r'\b(um|uh|like|you know)\b', '', text)

    text = re.sub(r'\s+', ' ', text)

    return text.strip()