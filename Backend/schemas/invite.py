from pydantic import BaseModel, Field


class InviteCreate(BaseModel):
    """A coach/recruiter creates a shareable link from a library
    question (question_id) or from an ad-hoc prompt + reference."""

    question_id: int | None = None
    prompt: str = ""
    reference_answer: str = ""
    expires_in_hours: int = Field(168, ge=1, le=24 * 365)
    max_uses: int = Field(1, ge=1, le=1000)


class InviteInfo(BaseModel):
    token: str
    question_set_id: int | None = None
    prompt: str
    reference_answer: str
    expires_at: str
    max_uses: int
    used_count: int
    created_at: str
    link: str
