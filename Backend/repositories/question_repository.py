import json
import os
import secrets

from database.setup import DatabaseConfig

SEED_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "Data",
    "question_bank_seed.json",
)

CATEGORIES = (
    "Behavioral",
    "Technical/SWE",
    "Product/PM",
    "Academic Oral Exam",
    "Sales Pitch",
    "Public Speaking",
)


def _parse_concepts(raw):
    if not raw:
        return []
    if isinstance(raw, (list, tuple)):
        return list(raw)
    try:
        parsed = json.loads(raw)
        return list(parsed) if isinstance(parsed, list) else []
    except (ValueError, TypeError):
        return []


def _serialize_concepts(concepts):
    try:
        return json.dumps(list(concepts or []))
    except (ValueError, TypeError):
        return "[]"


class QuestionRepository:
    def __init__(self):
        self.db = DatabaseConfig

    def list_questions(self, category: str | None = None, user_id: int | None = None) -> list[dict]:
        """Public library questions (org_id NULL) plus, for signed-in
        users, any custom questions they authored."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            params = []
            # public library + (only when signed in) the user's own custom questions
            scope = ["org_id IS NULL"]
            if user_id:
                scope.append("(org_id IS NOT NULL AND created_by = ?)")
                params.append(user_id)
            where = "(" + " OR ".join(scope) + ")"
            if category:
                where += " AND LOWER(category) = LOWER(?)"
                params.append(category)
            sql = (
                "SELECT id, category, prompt, model_answer, key_concepts, org_id, created_by, created_at "
                "FROM question_bank WHERE " + where + " ORDER BY id DESC"
            )
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "category": row[1],
                    "prompt": row[2],
                    "model_answer": row[3],
                    "key_concepts": _parse_concepts(row[4]),
                    "org_id": row[5],
                    "created_by": row[6],
                    "created_at": row[7].strftime("%Y-%m-%d %H:%M:%S") if row[7] else "",
                }
                for row in rows
            ]
        finally:
            cursor.close()
            conn.close()

    def find_by_id(self, question_id: int) -> dict | None:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, category, prompt, model_answer, key_concepts, org_id, created_by, created_at "
                "FROM question_bank WHERE id = ?",
                (question_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "id": row[0],
                "category": row[1],
                "prompt": row[2],
                "model_answer": row[3],
                "key_concepts": _parse_concepts(row[4]),
                "org_id": row[5],
                "created_by": row[6],
                "created_at": row[7].strftime("%Y-%m-%d %H:%M:%S") if row[7] else "",
            }
        finally:
            cursor.close()
            conn.close()

    def create(
        self,
        category: str,
        prompt: str,
        model_answer: str,
        key_concepts: list[str],
        created_by: int,
        org_id: int | None = None,
    ) -> int:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO question_bank (category, prompt, model_answer, key_concepts, org_id, created_by) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (category, prompt, model_answer or "", _serialize_concepts(key_concepts), org_id, created_by),
            )
            qid = cursor.lastrowid
            conn.commit()
            return qid
        finally:
            cursor.close()
            conn.close()

    def delete(self, question_id: int, user_id: int) -> bool:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT created_by FROM question_bank WHERE id = ?",
                (question_id,),
            )
            row = cursor.fetchone()
            if not row:
                return False
            if row[0] != user_id:
                # only the author (or an admin via the endpoint) may delete
                return False
            cursor.execute("DELETE FROM question_bank WHERE id = ?", (question_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            cursor.close()
            conn.close()

    def categories(self) -> list[str]:
        return list(CATEGORIES)

    # ------------------------------------------------------------
    # Seed — idempotent default library
    # ------------------------------------------------------------
    def seed_default_questions(self) -> int:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT COUNT(*) FROM question_bank")
            count = cursor.fetchone()[0]
            if count > 0:
                return 0
            if not os.path.exists(SEED_PATH):
                return 0
            with open(SEED_PATH, "r", encoding="utf-8") as f:
                entries = json.load(f)
            for entry in entries:
                cursor.execute(
                    "INSERT INTO question_bank (category, prompt, model_answer, key_concepts, org_id, created_by) "
                    "VALUES (?, ?, ?, ?, NULL, NULL)",
                    (
                        entry.get("category", "General"),
                        entry.get("prompt", ""),
                        entry.get("model_answer", ""),
                        _serialize_concepts(entry.get("key_concepts", [])),
                    ),
                )
            conn.commit()
            return len(entries)
        finally:
            cursor.close()
            conn.close()


def generate_invite_token() -> str:
    """URL-safe, collision-resistant token for shareable invite links."""
    return secrets.token_urlsafe(16)
