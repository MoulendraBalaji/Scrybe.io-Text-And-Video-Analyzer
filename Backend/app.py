"""
Scrybe AI Platform - Backend API v2.0
Clean Architecture with Repository Pattern, Service Layer, and DI
"""

import os
import shutil
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer

from schemas.auth import UserCreate, UserLogin, TokenRefresh
from schemas.evaluation import QueryCreate, QueryUpdate, FrameData, NoteCreate
from services.auth_service import AuthService
from services.evaluation_service import EvaluationService
from middleware.auth_middleware import get_current_user, rate_limit

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("uploads/videos", exist_ok=True)
    os.makedirs("uploads/audio", exist_ok=True)
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
async def evaluate_video(file: UploadFile = File(...), reference_answer: str = Form(...)):
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
