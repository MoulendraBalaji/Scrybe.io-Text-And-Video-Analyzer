from pydantic import BaseModel, Field

class QueryCreate(BaseModel):
    query_text: str
    response_text: str

class QueryUpdate(BaseModel):
    query_text: str
    response_text: str

class QueryResponse(BaseModel):
    id: int
    query_text: str
    response_text: str
    created_at: str

class FrameData(BaseModel):
    image: str

class FrameAnalysisResult(BaseModel):
    brightness: float = 50.0
    contrast: float = 50.0
    edge_density: float = 50.0
    info_rate: float = 50.0
    status: str = "Frame parsed successfully"

class NoteCreate(BaseModel):
    content: str

class EvaluationResult(BaseModel):
    transcript: str = ""
    summary: str = ""
    similarity: float = 0.0
    score: float = 0.0
    feedback: dict = {}
    visual_analysis: str = "No visual data detected."
    message: str = "Evaluation completed successfully"
