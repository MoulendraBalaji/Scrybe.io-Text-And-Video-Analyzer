"""
Scrybe AI Platform - Backend API v2.0
Clean Architecture with Repository Pattern, Service Layer, and DI
"""

import os
import shutil
import uuid
import time as _time
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer

from schemas.auth import UserCreate, UserLogin, TokenRefresh, ProfileUpdate, AvatarUpdate
from schemas.evaluation import QueryCreate, QueryUpdate, FrameData, NoteCreate, FollowUpRequest
from schemas.question import QuestionCreate
from schemas.invite import InviteCreate
from services.auth_service import AuthService
from services.evaluation_service import EvaluationService
from repositories.invite_repository import InviteRepository
from middleware.auth_middleware import get_current_user, get_optional_user, rate_limit

security = HTTPBearer(auto_error=False)
auth_service = AuthService()
evaluation_service = EvaluationService()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)

    def disconnect(self, websocket: WebSocket, client_id: str):
        if client_id in self.active_connections:
            self.active_connections[client_id].remove(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]

    async def send_to_client(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            for connection in self.active_connections[client_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

# ============================================================
# SCRYBE PULSE — live coaching nudges
# Each rule fires a short, actionable nudge the moment a
# telemetry threshold is crossed, rate-limited per client.
# ============================================================

NUDGE_RULES = [
    ("lighting", lambda t: t.get("brightness", 50) < 30, "Your lighting is low - move toward better light."),
    ("lighting", lambda t: t.get("brightness", 50) > 85, "Overexposed - soften the light and sit more in it."),
    ("contrast", lambda t: t.get("contrast", 50) < 20, "Your signal is flat - add more contrast to your frame."),
    ("edge_density", lambda t: t.get("edge_density", 50) < 8, "Your frame looks blurry - steady the camera."),
    ("silence", lambda t: bool(t.get("silence", False)), "You've paused - keep the momentum going."),
    ("semantic_drift", lambda t: t.get("drift", 0) > 0.55, "You're drifting from the core topic - pull it back."),
]
NUDGE_COOLDOWN = 8  # seconds between nudges of the same type per client
_nudge_state: dict[str, dict[str, float]] = {}

async def _maybe_send_nudges(client_id: str, telemetry: dict):
    if not telemetry:
        return
    now = _time.time()
    state = _nudge_state.setdefault(client_id, {})
    for nudge_type, check, message in NUDGE_RULES:
        try:
            if not check(telemetry):
                continue
        except Exception:
            continue
        if now - state.get(nudge_type, 0) < NUDGE_COOLDOWN:
            continue
        state[nudge_type] = now
        await manager.send_to_client(client_id, {
            "type": "coach_nudge",
            "nudge_type": nudge_type,
            "message": message,
        })

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("uploads/videos", exist_ok=True)
    os.makedirs("uploads/audio", exist_ok=True)
    try:
        # Ensure tables exist and seed the default Question Library.
        # Any failure here must not stop the API from booting.
        from database.setup import DatabaseConfig
        DatabaseConfig.init_database()
        DatabaseConfig.execute_schema()
        DatabaseConfig.migrate()
        from repositories.question_repository import QuestionRepository
        seeded = QuestionRepository().seed_default_questions()
        if seeded:
            print(f"Question Library seeded with {seeded} questions.")
    except Exception as e:
        print(f"Startup DB setup skipped: {e}")
    yield

app = FastAPI(
    title="Scrybe AI Platform API",
    description="Enterprise-grade AI-powered video and speech intelligence platform",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# HEALTH & ROOT
# ============================================================

@app.get("/")
async def read_root():
    return {
        "status": "operational",
        "engine": "Scrybe AI",
        "version": "2.0.0",
        "endpoints": {
            "api_docs": "/api/docs",
            "health": "/health",
        }
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": str(__import__('datetime').datetime.utcnow())}

# ============================================================
# AUTH ENDPOINTS
# ============================================================

@app.post("/api/v1/auth/register")
@app.post("/register")
async def register(user: UserCreate):
    try:
        rate_limit(f"register:{user.username}", max_requests=5, window_seconds=300)
        result = auth_service.register(user.username, user.password, user.first_name, user.last_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/auth/login")
@app.post("/login")
async def login(user: UserLogin):
    try:
        rate_limit(f"login:{user.username}", max_requests=10, window_seconds=60)
        result = auth_service.login(user.username, user.password)
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.post("/api/v1/auth/refresh")
async def refresh_token(token_data: TokenRefresh):
    try:
        result = auth_service.refresh_token(token_data.refresh_token)
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.get("/api/v1/auth/me")
async def get_me(payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from repositories.user_repository import UserRepository
    user_repo = UserRepository()
    user = user_repo.find_by_id(payload["id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ============================================================
# EVALUATION ENDPOINTS
# ============================================================

@app.post("/api/v1/evaluate")
@app.post("/evaluate")
async def evaluate_video(file: UploadFile = File(...), reference_answer: str = Form(...), question: str = Form("")):
    rate_limit("evaluate", max_requests=20, window_seconds=60)
    file_content = await file.read()
    result = evaluation_service.evaluate_video(file_content, file.content_type or "", reference_answer)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/v1/analyze-frame")
@app.post("/analyze-frame")
async def analyze_frame(data: FrameData):
    return evaluation_service.analyze_frame(data.image)

# ============================================================
# QUERY / HISTORY ENDPOINTS
# ============================================================

@app.post("/api/v1/queries")
@app.post("/queries")
async def create_query(query: QueryCreate, username: str):
    try:
        return evaluation_service.save_query(username, query.query_text, query.response_text)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/v1/queries/{username}")
@app.get("/queries/{username}")
async def get_queries(username: str):
    queries = evaluation_service.get_queries(username)
    return {"queries": queries}

@app.put("/api/v1/queries/{query_id}")
@app.put("/queries/{query_id}")
async def update_query(query_id: int, query: QueryUpdate):
    success = evaluation_service.update_query(query_id, query.query_text, query.response_text)
    if not success:
        raise HTTPException(status_code=404, detail="Query not found")
    return {"message": "Query updated successfully"}

@app.delete("/api/v1/queries/{query_id}")
@app.delete("/queries/{query_id}")
async def delete_query(query_id: int):
    success = evaluation_service.delete_query(query_id)
    if not success:
        raise HTTPException(status_code=404, detail="Query not found")
    return {"message": "Query deleted successfully"}

# ============================================================
# LEADERBOARD
# ============================================================

@app.get("/api/v1/leaderboard")
@app.get("/leaderboard")
async def get_leaderboard():
    leaderboard = evaluation_service.get_leaderboard()
    return {"leaderboard": leaderboard}

# ============================================================
# INTERVIEW — targeted follow-up question
# ============================================================

@app.post("/api/v1/interview/follow-up")
@app.post("/interview/follow-up")
async def follow_up_question(req: FollowUpRequest):
    rate_limit("follow-up", max_requests=20, window_seconds=60)
    question = evaluation_service.generate_follow_up(
        req.transcript, req.reference_answer, req.missing_concepts
    )
    return {"question": question}

# ============================================================
# BATCH EVALUATION — enterprise tier only
# ============================================================

@app.post("/api/v1/batch/evaluate")
@app.post("/batch/evaluate")
async def batch_evaluate(
    files: list[UploadFile] = File(...),
    reference_answer: str = Form(...),
    payload: dict = Depends(get_current_user),
):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    rate_limit("batch-evaluate", max_requests=5, window_seconds=60)

    from repositories.user_repository import UserRepository
    tier = UserRepository().get_subscription(payload["id"])
    if not tier or not tier.get("hasBatchProcessing"):
        raise HTTPException(
            status_code=403,
            detail="Batch processing is part of the Enterprise plan. Upgrade to unlock it.",
        )

    results = []
    for file in files:
        content = await file.read()
        result = evaluation_service.evaluate_video(content, file.content_type or "", reference_answer)
        results.append({"file": file.filename, "result": result})
    return {"results": results, "message": "Batch evaluation completed"}

# ============================================================
# QUESTION LIBRARY (Section 1.1)
# ============================================================

@app.get("/api/v1/questions")
@app.get("/questions")
async def list_questions(category: str | None = None, payload: dict = Depends(get_optional_user)):
    user_id = payload.get("id") if payload else None
    return {"questions": evaluation_service.list_questions(category=category, user_id=user_id)}

@app.post("/api/v1/questions")
@app.post("/questions")
async def create_question(question: QuestionCreate, payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    rate_limit(f"questions:{payload['id']}", max_requests=30, window_seconds=300)
    try:
        return evaluation_service.create_question(
            user_id=payload["id"],
            category=question.category,
            prompt=question.prompt,
            model_answer=question.model_answer,
            key_concepts=question.key_concepts,
            org_id=question.org_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/v1/questions/{question_id}")
@app.delete("/questions/{question_id}")
async def delete_question(question_id: int, payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not evaluation_service.delete_question(question_id, payload["id"]):
        raise HTTPException(status_code=404, detail="Question not found or you may not delete it")
    return {"message": "Question deleted successfully"}

# ============================================================
# INVITE LINKS (Section 1.4) — real B2B flow
# ============================================================

@app.post("/api/v1/invites")
@app.post("/invites")
async def create_invite(invite: InviteCreate, payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    rate_limit(f"invites:{payload['id']}", max_requests=20, window_seconds=300)
    try:
        return evaluation_service.create_invite(payload["id"], invite)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/invites")
@app.get("/invites")
async def list_invites(payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    invites = evaluation_service.list_invites(payload["id"])
    for inv in invites:
        inv["link"] = f"/invite/{inv['token']}"
    return {"invites": invites}

@app.get("/api/v1/invites/{token}")
@app.get("/invites/{token}")
async def get_invite(token: str):
    invite = evaluation_service.get_invite(token)
    if not invite:
        raise HTTPException(status_code=404, detail="This invite link does not exist.")
    if not InviteRepository().is_valid(invite):
        raise HTTPException(status_code=410, detail="This invite link has expired or reached its usage limit.")
    return {
        "token": invite["token"],
        "prompt": invite["prompt"],
        "reference_answer": invite["reference_answer"],
        "max_uses": invite["max_uses"],
        "used_count": invite["used_count"],
        "expires_at": invite["expires_at"].strftime("%Y-%m-%d %H:%M:%S") if invite["expires_at"] else "",
    }

@app.post("/api/v1/invites/{token}/submit")
@app.post("/invites/{token}/submit")
async def submit_invite(token: str, file: UploadFile = File(...)):
    """Public candidate-facing endpoint — no signup required."""
    rate_limit(f"invite-submit:{token}", max_requests=10, window_seconds=3600)
    file_content = await file.read()
    try:
        result = evaluation_service.submit_invite(token, file_content, file.content_type or "")
    except ValueError as e:
        raise HTTPException(status_code=410, detail=str(e))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

# ============================================================
# PROGRESS (Section 1.3) — improvement dashboard
# ============================================================

@app.get("/api/v1/progress")
@app.get("/progress")
async def get_progress(payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return evaluation_service.get_progress(payload["id"])

# ============================================================
# PRIVACY & DATA (Section 1.5) — export / delete
# ============================================================

@app.get("/api/v1/me/data")
@app.get("/me/data")
async def export_my_data(payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return evaluation_service.export_user_data(payload["id"])

@app.delete("/api/v1/me/data")
@app.delete("/me/data")
async def delete_my_data(payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = evaluation_service.delete_user_data(payload["id"])
    return {**result, "message": "Your stored evaluation history and notes were deleted."}

# ============================================================
# ME — streak + subscription tier
# ============================================================

@app.get("/api/v1/me/streak")
@app.get("/me/streak")
async def get_my_streak(payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from repositories.query_repository import QueryRepository
    streak = QueryRepository().get_streak(payload["id"])
    return streak

@app.get("/api/v1/me/tier")
@app.get("/me/tier")
async def get_my_tier(payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from repositories.user_repository import UserRepository
    tier = UserRepository().get_subscription(payload["id"])
    if not tier:
        raise HTTPException(status_code=404, detail="Subscription tier not found")
    return tier

@app.put("/api/v1/me")
@app.put("/me")
async def update_my_profile(profile: ProfileUpdate, payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from repositories.user_repository import UserRepository
    user_repo = UserRepository()
    user_repo.update_profile(payload["id"], profile.first_name, profile.last_name, profile.email)
    user = user_repo.find_by_id(payload["id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Profile updated successfully", "user": user}

@app.put("/api/v1/me/avatar")
@app.put("/me/avatar")
async def update_my_avatar(avatar_data: AvatarUpdate, payload: dict = Depends(get_current_user)):
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from repositories.user_repository import UserRepository
    user_repo = UserRepository()
    if avatar_data.avatar:
        # store only image data URLs (data:image/...;base64,...); reject anything else
        if not str(avatar_data.avatar).startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Avatar must be an image data URL")
        if len(avatar_data.avatar) > 4_000_000:
            raise HTTPException(status_code=400, detail="Avatar image is too large (max ~3 MB)")
    user_repo.update_avatar(payload["id"], avatar_data.avatar)
    user = user_repo.find_by_id(payload["id"])
    return {"message": "Avatar updated successfully", "user": user}

# ============================================================
# NOTES
# ============================================================

@app.post("/api/v1/notes")
@app.post("/notes")
async def create_note(note: NoteCreate, username: str):
    from repositories.user_repository import UserRepository
    user_repo = UserRepository()
    user = user_repo.find_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    conn = None
    cursor = None
    try:
        from database.setup import DatabaseConfig
        conn = DatabaseConfig.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO notes (user_id, content) VALUES (?, ?)",
            (user["id"], note.content)
        )
        conn.commit()
        return {"message": "Note added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

@app.get("/api/v1/notes/{username}")
@app.get("/notes/{username}")
async def get_notes(username: str):
    from repositories.user_repository import UserRepository
    user_repo = UserRepository()
    user = user_repo.find_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    conn = None
    cursor = None
    try:
        from database.setup import DatabaseConfig
        conn = DatabaseConfig.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, content, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC",
            (user["id"],)
        )
        rows = cursor.fetchall()
        notes = [
            {"id": row[0], "content": row[1], "created_at": row[2].strftime("%Y-%m-%d %H:%M:%S") if row[2] else ""}
            for row in rows
        ]
        return {"notes": notes}
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# ============================================================
# DATABASE SETUP
# ============================================================

@app.get("/api/v1/setup-db")
@app.get("/setup_db")
async def setup_db():
    try:
        from database.setup import DatabaseConfig
        DatabaseConfig.init_database()
        DatabaseConfig.execute_schema()
        return {"message": "Database tables setup successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database setup failed: {str(e)}")

# ============================================================
# WEBSOCKET FOR REAL-TIME PROCESSING
# ============================================================

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "ping":
                await manager.send_to_client(client_id, {"type": "pong"})

            elif msg_type == "frame_analysis":
                image_data = data.get("image", "")
                result = evaluation_service.analyze_frame(image_data)
                await manager.send_to_client(client_id, {
                    "type": "frame_result",
                    "data": result
                })
                await _maybe_send_nudges(client_id, result)

            elif msg_type == "telemetry":
                telemetry = data.get("data", {})
                await manager.send_to_client(client_id, {
                    "type": "telemetry_result",
                    "data": telemetry
                })
                await _maybe_send_nudges(client_id, telemetry)

            elif msg_type == "transcribe":
                text = data.get("text", "")
                await manager.send_to_client(client_id, {
                    "type": "transcription_result",
                    "data": {"text": text, "status": "received"}
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
    except Exception as e:
        manager.disconnect(websocket, client_id)
        print(f"WebSocket error: {e}")
    finally:
        _nudge_state.pop(client_id, None)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
