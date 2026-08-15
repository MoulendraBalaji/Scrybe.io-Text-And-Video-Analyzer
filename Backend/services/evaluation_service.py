import os
import json
import uuid
import base64
import numpy as np
import cv2
from datetime import datetime, timedelta, timezone
from PIL import Image
import io

from pipeline.evaluator import evaluate as run_evaluation
from repositories.query_repository import QueryRepository
from repositories.question_repository import QuestionRepository, generate_invite_token
from repositories.invite_repository import InviteRepository

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

class EvaluationService:
    def __init__(self):
        self.query_repo = QueryRepository()
        os.makedirs(f"{UPLOAD_DIR}/videos", exist_ok=True)
        os.makedirs(f"{UPLOAD_DIR}/audio", exist_ok=True)

    def evaluate_video(self, file_content: bytes, content_type: str, reference_answer: str) -> dict:
        if not content_type.startswith("video/") and not content_type.startswith("audio/"):
            return {"error": f"Invalid file type '{content_type}'. Please upload a valid video file."}

        video_id = str(uuid.uuid4())
        ext = ".mp4" if content_type.startswith("video/") else ".wav"
        video_path = f"{UPLOAD_DIR}/videos/{video_id}{ext}"

        with open(video_path, "wb") as buffer:
            buffer.write(file_content)

        if os.path.getsize(video_path) < 100:
            os.remove(video_path)
            return {"error": "The uploaded video file is empty or corrupted."}

        try:
            result = run_evaluation(video_path, reference_answer)
            return result
        except Exception as e:
            return {"error": str(e)}
        finally:
            if os.path.exists(video_path):
                os.remove(video_path)

    def analyze_frame(self, image_data: str) -> dict:
        try:
            header, encoded = image_data.split(",", 1) if "," in image_data else ("", image_data)
            img_data = base64.b64decode(encoded)
            image = Image.open(io.BytesIO(img_data))
            open_cv_image = np.array(image)
            if len(open_cv_image.shape) == 3:
                open_cv_image = cv2.cvtColor(open_cv_image, cv2.COLOR_RGB2BGR)

            gray = cv2.cvtColor(open_cv_image, cv2.COLOR_BGR2GRAY)
            brightness = float(np.mean(gray))
            contrast = float(np.std(gray))
            edges = cv2.Canny(gray, 100, 200)
            edge_density = float(np.sum(edges > 0) / edges.size * 100)

            return {
                "brightness": round(min(100.0, max(0.0, (brightness / 255.0) * 100)), 1),
                "contrast": round(min(100.0, max(0.0, (contrast / 128.0) * 100)), 1),
                "edge_density": round(min(100.0, max(0.0, edge_density * 20.0)), 1),
                "info_rate": round(min(100.0, max(0.0, (contrast / 128.0 * 0.6 + edge_density * 20.0 * 0.4))), 1),
                "status": "Frame parsed successfully"
            }
        except Exception as e:
            return {"brightness": 50.0, "contrast": 50.0, "edge_density": 50.0, "info_rate": 50.0, "status": f"Fallback: {str(e)}"}

    def save_query(self, username: str, query_text: str, response_text: str) -> dict:
        from repositories.user_repository import UserRepository
        user_repo = UserRepository()
        user = user_repo.find_by_username(username)
        if not user:
            raise ValueError("User not found")
        query_id = self.query_repo.create(user["id"], query_text, response_text)
        return {"message": "Query added successfully", "id": query_id}

    def get_queries(self, username: str) -> list:
        return self.query_repo.find_by_user(username)

    def update_query(self, query_id: int, query_text: str, response_text: str) -> bool:
        return self.query_repo.update(query_id, query_text, response_text)

    def delete_query(self, query_id: int) -> bool:
        return self.query_repo.delete(query_id)

    def get_leaderboard(self) -> list:
        return self.query_repo.get_leaderboard()

    def get_streak(self, user_id: int) -> dict:
        return self.query_repo.get_streak(user_id)

    def generate_follow_up(self, transcript: str, reference_answer: str, missing_concepts: list[str] | None = None) -> str:
        from utils.feedback_generator import generate_follow_up
        return generate_follow_up(transcript, reference_answer, missing_concepts)

    # ------------------------------------------------------------
    # QUESTION LIBRARY (Section 1.1)
    # ------------------------------------------------------------
    def list_questions(self, category: str | None = None, user_id: int | None = None) -> list:
        return QuestionRepository().list_questions(category=category, user_id=user_id)

    def create_question(
        self,
        user_id: int,
        category: str,
        prompt: str,
        model_answer: str,
        key_concepts: list[str],
        org_id: int | None = None,
    ) -> dict:
        qid = QuestionRepository().create(
            category=category,
            prompt=prompt,
            model_answer=model_answer,
            key_concepts=key_concepts,
            created_by=user_id,
            org_id=org_id,
        )
        return {"message": "Question added to the library", "id": qid}

    def delete_question(self, question_id: int, user_id: int) -> bool:
        return QuestionRepository().delete(question_id, user_id)

    # ------------------------------------------------------------
    # INVITE LINKS (Section 1.4)
    # ------------------------------------------------------------
    def create_invite(self, user_id: int, invite) -> dict:
        q_repo = QuestionRepository()
        prompt, reference, question_id = invite.prompt, invite.reference_answer, invite.question_id
        if invite.question_id:
            question = q_repo.find_by_id(invite.question_id)
            if not question:
                raise ValueError("Question not found")
            prompt = prompt or question["prompt"]
            reference = reference or question["model_answer"]
            question_id = question["id"]
        if not prompt or not reference:
            raise ValueError("An invite needs a question prompt and a reference answer.")

        token = generate_invite_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=invite.expires_in_hours)
        InviteRepository().create(
            token=token,
            sender_id=user_id,
            prompt=prompt,
            reference_answer=reference,
            expires_at=expires_at,
            max_uses=invite.max_uses,
            question_set_id=question_id,
        )
        return {
            "token": token,
            "link": f"/invite/{token}",
            "expires_at": expires_at.strftime("%Y-%m-%d %H:%M:%S"),
            "max_uses": invite.max_uses,
        }

    def list_invites(self, user_id: int) -> list:
        return InviteRepository().list_by_sender(user_id)

    def get_invite(self, token: str) -> dict | None:
        return InviteRepository().find_by_token(token)

    def submit_invite(self, token: str, file_content: bytes, content_type: str) -> dict:
        """Public candidate-facing evaluation. The result lands in the
        sender's dashboard (source='screened') without any account."""
        repo = InviteRepository()
        invite = repo.find_by_token(token)
        if not invite:
            raise ValueError("This invite link is invalid.")
        if not repo.is_valid(invite):
            raise ValueError("This invite link has expired or reached its usage limit.")

        result = self.evaluate_video(file_content, content_type, invite["reference_answer"])
        if "error" in result:
            return result

        payload = {
            "score": result.get("score"),
            "rubric": result.get("rubric"),
            "transcript": result.get("transcript"),
            "summary": result.get("summary"),
            "visual_feedback": result.get("visual_feedback"),
            "feedback": result.get("feedback"),
            "grade": None,
            "source": "screened",
            "invite_token": token,
            "candidate": True,
        }
        try:
            from repositories.query_repository import QueryRepository
            QueryRepository().create(
                invite["sender_id"],
                invite["prompt"] or "Screened candidate response",
                json.dumps(payload),
                question_id=invite.get("question_set_id"),
                source="screened",
            )
            repo.increment_use(token)
        except Exception as e:
            print(f"Invite result save failed: {e}")

        result["source"] = "screened"
        return result

    # ------------------------------------------------------------
    # PROGRESS (Section 1.3)
    # ------------------------------------------------------------
    def get_progress(self, user_id: int, limit: int = 15) -> dict:
        return QueryRepository().get_progress(user_id, limit=limit)

    # ------------------------------------------------------------
    # PRIVACY & DATA (Section 1.5)
    # ------------------------------------------------------------
    def export_user_data(self, user_id: int) -> dict:
        from repositories.user_repository import UserRepository
        user = UserRepository().find_by_id(user_id)
        queries = QueryRepository().find_by_user_id(user_id)

        conn = None
        cursor = None
        try:
            from database.setup import DatabaseConfig
            conn = DatabaseConfig.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, content, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            )
            rows = cursor.fetchall()
            notes = [
                {"id": r[0], "content": r[1], "created_at": r[2].strftime("%Y-%m-%d %H:%M:%S") if r[2] else ""}
                for r in rows
            ]
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

        return {
            "exported_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "user": user,
            "queries": queries,
            "notes": notes,
        }

    def delete_user_data(self, user_id: int) -> dict:
        deleted_queries = QueryRepository().delete_all_for_user(user_id)

        conn = None
        cursor = None
        try:
            from database.setup import DatabaseConfig
            conn = DatabaseConfig.get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM notes WHERE user_id = ?", (user_id,))
            conn.commit()
            deleted_notes = cursor.rowcount
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

        return {"deleted_queries": deleted_queries, "deleted_notes": deleted_notes}
