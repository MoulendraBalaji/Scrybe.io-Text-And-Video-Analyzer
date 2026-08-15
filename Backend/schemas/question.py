from pydantic import BaseModel, Field

PUBLIC_CATEGORIES = (
    "Behavioral",
    "Technical/SWE",
    "Product/PM",
    "Academic Oral Exam",
    "Sales Pitch",
    "Public Speaking",
)


class QuestionCreate(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)
    prompt: str = Field(..., min_length=1)
    model_answer: str = ""
    key_concepts: list[str] = []
    org_id: int | None = None


class QuestionResponse(BaseModel):
    id: int
    category: str
    prompt: str
    model_answer: str
    key_concepts: list[str]
    org_id: int | None = None
    created_by: int | None = None
    created_at: str
