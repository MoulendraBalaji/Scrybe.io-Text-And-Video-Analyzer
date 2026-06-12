from database.setup import DatabaseConfig

class QueryRepository:
    def __init__(self):
        self.db = DatabaseConfig

    def create(self, user_id: int, query_text: str, response_text: str) -> int:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO Queries (user_id, query_text, response_text) VALUES (?, ?, ?)",
                (user_id, query_text, response_text)
            )
            query_id = cursor.lastrowid
            conn.commit()
            return query_id
        finally:
            cursor.close()
            conn.close()

    def find_by_user(self, username: str) -> list:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT q.id, q.query_text, q.response_text, q.created_at "
                "FROM queries q "
                "JOIN users u ON q.user_id = u.id "
                "WHERE u.username = ? "
                "ORDER BY q.created_at DESC",
                (username,)
            )
            rows = cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "query_text": row[1],
                    "response_text": row[2],
                    "created_at": row[3].strftime("%Y-%m-%d %H:%M:%S") if row[3] else ""
                }
                for row in rows
            ]
        finally:
            cursor.close()
            conn.close()

    def update(self, query_id: int, query_text: str, response_text: str) -> bool:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE queries SET query_text = ?, response_text = ? WHERE id = ?",
                (query_text, response_text, query_id)
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            cursor.close()
            conn.close()

    def delete(self, query_id: int) -> bool:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM queries WHERE id = ?", (query_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            cursor.close()
            conn.close()

    def get_leaderboard(self) -> list:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT q.id, u.username, u.first_name, u.last_name, q.query_text, q.response_text, q.created_at
                FROM queries q
                JOIN users u ON q.user_id = u.id
            """)
            rows = cursor.fetchall()
            result = []
            for row in rows:
                try:
                    import json
                    resp = json.loads(row[5])
                    score = resp.get('score', 0)
                    grade = resp.get('grade', 'Grade F')
                except Exception:
                    score = 0
                    grade = 'Grade F'
                result.append({
                    "id": row[0],
                    "name": f"{row[2]} {row[3]}".strip() or row[1],
                    "question": row[4],
                    "score": score,
                    "grade": grade,
                    "date": row[6].strftime("%m/%d/%Y") if row[6] else ""
                })
            result.sort(key=lambda x: x['score'], reverse=True)
            return result[:20]
        finally:
            cursor.close()
            conn.close()
