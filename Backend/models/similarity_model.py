from sentence_transformers import SentenceTransformer
from sentence_transformers import util
import re

# Upgraded to all-mpnet-base-v2 for higher predictability and better context capture
model = SentenceTransformer('all-mpnet-base-v2')

def extract_keywords(text):
    words = re.findall(r'\b\w+\b', text.lower())
    # basic stop words handling
    stopwords = {"the", "is", "in", "and", "to", "a", "of", "for", "on", "it", "with", "as", "by", "an", "this", "that", "i", "you", "we", "are"}
    return set(w for w in words if w not in stopwords and len(w) > 2)

def calculate_keyword_score(answer, reference):
    ans_kw = extract_keywords(answer)
    ref_kw = extract_keywords(reference)
    
    if not ref_kw:
        return 0.0
        
    overlap = ans_kw.intersection(ref_kw)
    return len(overlap) / len(ref_kw)

def calculate_similarity(answer, reference):
    if not answer or not reference:
        return 0.0

    emb1 = model.encode(answer, convert_to_tensor=True)
    emb2 = model.encode(reference, convert_to_tensor=True)

    # 1. Semantic Similarity
    semantic_score = float(util.cos_sim(emb1, emb2)[0][0])
    
    # 2. Keyword overlap score
    keyword_score = calculate_keyword_score(answer, reference)
    
    # 3. Hybrid Score for higher predictability
    # Weight semantic higher than pure keyword match
    final_score = (0.7 * semantic_score) + (0.3 * keyword_score)
    
    return max(0.0, min(1.0, final_score))