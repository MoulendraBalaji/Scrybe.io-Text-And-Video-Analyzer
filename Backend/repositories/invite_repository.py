from datetime import datetime, timezone

from database.setup import DatabaseConfig


def _utc_str(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _parse_dt(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8", "replace")
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


class InviteRepository:
    def __init__(self):
        self.db = DatabaseConfig

    def create(
        self,
        token: str,
        sender_id: int,
        prompt: str,
        reference_answer: str,
        expires_at: datetime,
        max_uses: int = 1,
        question_set_id: int | None = None,
    ) -> dict:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO invite_links (token, question_set_id, sender_id, prompt, reference_answer, "
                "expires_at, max_uses, used_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
                (token, question_set_id, sender_id, prompt, reference_answer, _utc_str(expires_at), max_uses),
            )
            conn.commit()
            return {"token": token}
        finally:
            cursor.close()
            conn.close()

    def find_by_token(self, token: str) -> dict | None:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT token, question_set_id, sender_id, prompt, reference_answer, expires_at, "
                "max_uses, used_count, created_at FROM invite_links WHERE token = ?",
                (token,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "token": row[0],
                "question_set_id": row[1],
                "sender_id": row[2],
                "prompt": row[3],
                "reference_answer": row[4],
                "expires_at": _parse_dt(row[5]),
                "max_uses": row[6],
                "used_count": row[7],
                "created_at": row[8].strftime("%Y-%m-%d %H:%M:%S") if row[8] else "",
            }
        finally:
            cursor.close()
            conn.close()

    def is_valid(self, invite: dict) -> bool:
        if not invite:
            return False
        now = datetime.now(timezone.utc)
        expires = invite.get("expires_at")
        if expires is None:
            return False
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return expires > now and invite.get("used_count", 0) < invite.get("max_uses", 1)

    def increment_use(self, token: str) -> bool:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE invite_links SET used_count = used_count + 1 WHERE token = ?",
                (token,),
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            cursor.close()
            conn.close()

    def list_by_sender(self, sender_id: int) -> list[dict]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT token, question_set_id, prompt, reference_answer, expires_at, max_uses, used_count, created_at "
                "FROM invite_links WHERE sender_id = ? ORDER BY created_at DESC",
                (sender_id,),
            )
            rows = cursor.fetchall()
            return [
                {
                    "token": row[0],
                    "question_set_id": row[1],
                    "prompt": row[2],
                    "reference_answer": row[3],
                    "expires_at": row[4].strftime("%Y-%m-%d %H:%M:%S") if row[4] else "",
                    "max_uses": row[5],
                    "used_count": row[6],
                    "created_at": row[7].strftime("%Y-%m-%d %H:%M:%S") if row[7] else "",
                }
                for row in rows
            ]
        finally:
            cursor.close()
            conn.close()
