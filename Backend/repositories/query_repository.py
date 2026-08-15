from database.setup import DatabaseConfig

class QueryRepository:
    def __init__(self):
        self.db = DatabaseConfig

    def create(
        self,
        user_id: int,
        query_text: str,
        response_text: str,
        question_id: int | None = None,
        source: str = "practice",
    ) -> int:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO Queries (user_id, query_text, response_text, question_id, source) VALUES (?, ?, ?, ?, ?)",
                (user_id, query_text, response_text, question_id, source)
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
                "SELECT q.id, q.query_text, q.response_text, q.created_at, q.source, q.question_id "
                "FROM queries q "
                "JOIN users u ON q.user_id = u.Id "
                "WHERE u.Username = ? "
                "ORDER BY q.created_at DESC",
                (username,)
            )
            rows = cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "query_text": row[1],
                    "response_text": row[2],
                    "created_at": row[3].strftime("%Y-%m-%d %H:%M:%S") if row[3] else "",
                    "source": row[4] or "practice",
                    "question_id": row[5],
                }
                for row in rows
            ]
        finally:
            cursor.close()
            conn.close()

    def find_by_user_id(self, user_id: int) -> list:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, query_text, response_text, created_at, source, question_id "
                "FROM queries WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,)
            )
            rows = cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "query_text": row[1],
                    "response_text": row[2],
                    "created_at": row[3].strftime("%Y-%m-%d %H:%M:%S") if row[3] else "",
                    "source": row[4] or "practice",
                    "question_id": row[5],
                }
                for row in rows
            ]
        finally:
            cursor.close()
            conn.close()

    def delete_all_for_user(self, user_id: int) -> int:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM queries WHERE user_id = ?", (user_id,))
            conn.commit()
            return cursor.rowcount
        finally:
            cursor.close()
            conn.close()

    def get_progress(self, user_id: int, limit: int = 15) -> dict:
        """Trend series per rubric dimension across the user's last N sessions."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, query_text, response_text, created_at "
                "FROM queries WHERE user_id = ? "
                "ORDER BY created_at DESC LIMIT ?",
                (user_id, limit)
            )
            rows = cursor.fetchall()
            sessions = []
            for row in rows:
                sessions.append({
                    "id": row[0],
                    "query_text": row[1],
                    "response_text": row[2],
                    "created_at": row[3].strftime("%Y-%m-%d %H:%M:%S") if row[3] else "",
                })
            return self._build_progress(sessions)
        finally:
            cursor.close()
            conn.close()

    def _build_progress(self, sessions: list) -> dict:
        import json as _json
        dimensions = ["content_accuracy", "structure", "filler_words", "pace", "visual_presence"]
        series = {d: [] for d in dimensions}
        overall_series = []
        last = {}

        for s in sessions:
            date = (s["created_at"] or "")[:10]
            parsed = {"score": None}
            try:
                parsed = _json.loads(s["response_text"])
            except Exception:
                continue
            if not isinstance(parsed, dict):
                continue

            overall = parsed.get("score")
            if overall is None:
                rubric = parsed.get("rubric") or {}
                overall = rubric.get("overall")
            if overall is None:
                continue
            overall_series.append({"date": date, "value": overall})
            last = {"date": date, "score": overall}

            rubric = parsed.get("rubric") or {}
            dims = rubric.get("dimensions") or {}
            for d in dimensions:
                val = dims.get(d, {}).get("score")
                if val is None:
                    continue
                series[d].append({"date": date, "value": val})
                if d not in last:
                    last[d] = val

        def trend(points):
            if len(points) < 2:
                return None
            return round(points[-1]["value"] - points[0]["value"], 1)

        return {
            "sessions": [s["query_text"] for s in sessions],
            "overall": overall_series,
            "dimensions": {d: series[d] for d in dimensions},
            "trends": {
                "overall": trend(overall_series),
                "content_accuracy": trend(series["content_accuracy"]),
                "structure": trend(series["structure"]),
                "filler_words": trend(series["filler_words"]),
                "pace": trend(series["pace"]),
                "visual_presence": trend(series["visual_presence"]),
            },
            "latest": last,
            "total": len(overall_series),
        }

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
                SELECT q.id, u.Username, u.FirstName, u.LastName, q.query_text, q.response_text, q.created_at
                FROM queries q
                JOIN users u ON q.user_id = u.Id
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

    def get_streak(self, user_id: int) -> dict:
        """Current / longest practice streak derived from evaluation history."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT DISTINCT date(created_at) FROM queries WHERE user_id = ?",
                (user_id,)
            )
            rows = cursor.fetchall()
            raw = sorted({str(row[0])[:10] for row in rows if row[0]})
            if not raw:
                return {"current": 0, "longest": 0, "total": 0}

            from datetime import date, timedelta
            parsed = [date.fromisoformat(d) for d in raw]

            longest = current_run = 1
            for i in range(1, len(parsed)):
                current_run = current_run + 1 if (parsed[i] - parsed[i - 1]).days == 1 else 1
                longest = max(longest, current_run)

            practiced = set(parsed)
            current_streak = 0
            day = date.today()
            while day in practiced:
                current_streak += 1
                day -= timedelta(days=1)

            return {"current": current_streak, "longest": longest, "total": len(parsed)}
        finally:
            cursor.close()
            conn.close()
