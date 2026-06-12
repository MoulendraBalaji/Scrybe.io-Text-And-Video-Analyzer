from database.setup import DatabaseConfig

class UserRepository:
    def __init__(self):
        self.db = DatabaseConfig

    def find_by_username(self, username: str) -> dict | None:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT u.Id, u.Username, u.PasswordHash, u.FirstName, u.LastName, u.Email, "
                "u.IsActive, ur.Name as RoleName "
                "FROM Users u "
                "JOIN UserRoles ur ON u.RoleId = ur.Id "
                "WHERE u.Username = ?",
                (username,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0], "username": row[1], "password_hash": row[2],
                    "first_name": row[3], "last_name": row[4], "email": row[5],
                    "is_active": row[6], "role": row[7]
                }
            return None
        finally:
            cursor.close()
            conn.close()

    def find_by_id(self, user_id: int) -> dict | None:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT u.Id, u.Username, u.FirstName, u.LastName, u.Email, "
                "u.IsActive, ur.Name as RoleName "
                "FROM Users u "
                "JOIN UserRoles ur ON u.RoleId = ur.Id "
                "WHERE u.Id = ?",
                (user_id,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0], "username": row[1],
                    "first_name": row[2], "last_name": row[3],
                    "email": row[4], "is_active": row[5], "role": row[6]
                }
            return None
        finally:
            cursor.close()
            conn.close()

    def create(self, username: str, password_hash: str, first_name: str, last_name: str) -> int:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO Users (Username, PasswordHash, FirstName, LastName) "
                "VALUES (?, ?, ?, ?)",
                (username, password_hash, first_name, last_name)
            )
            user_id = cursor.lastrowid
            conn.commit()
            return user_id
        finally:
            cursor.close()
            conn.close()

    def update_last_login(self, user_id: int):
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("UPDATE Users SET LastLoginAt = UTC_TIMESTAMP() WHERE Id = ?", (user_id,))
            conn.commit()
        finally:
            cursor.close()
            conn.close()
