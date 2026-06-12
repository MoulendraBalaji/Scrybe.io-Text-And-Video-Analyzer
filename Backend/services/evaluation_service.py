import os
import uuid
import base64
import numpy as np
import cv2
from PIL import Image
import io

from pipeline.evaluator import evaluate as run_evaluation
from repositories.query_repository import QueryRepository

UPLOAD_DIR = "/tmp/uploads" if os.getenv("VERCEL") else "uploads"

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
