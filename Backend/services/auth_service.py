import os
import bcrypt
import jwt
from datetime import datetime, timedelta
from repositories.user_repository import UserRepository

SECRET_KEY = os.getenv("SECRET_KEY", "scrybe_secret_key_v2_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 30

class AuthService:
    def __init__(self):
        self.user_repo = UserRepository()

    def hash_password(self, password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def verify_password(self, password: str, password_hash: str) -> bool:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

    def create_access_token(self, user_id: int, username: str) -> str:
        payload = {
            "sub": username,
            "id": user_id,
            "exp": datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
            "iat": datetime.utcnow(),
            "type": "access"
        }
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    def create_refresh_token(self, user_id: int) -> str:
        payload = {
            "sub": str(user_id),
            "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            "iat": datetime.utcnow(),
            "type": "refresh"
        }
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    def decode_token(self, token: str) -> dict | None:
        try:
            return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    def register(self, username: str, password: str, first_name: str, last_name: str) -> dict:
        existing = self.user_repo.find_by_username(username)
        if existing:
            raise ValueError("Username already registered")

        password_hash = self.hash_password(password)
        user_id = self.user_repo.create(username, password_hash, first_name, last_name)
        return {"id": user_id, "username": username, "message": "User registered successfully"}

    def login(self, username: str, password: str) -> dict:
        user = self.user_repo.find_by_username(username)
        if not user:
            raise ValueError("Invalid username or password")
        if not user.get("is_active"):
            raise ValueError("Account is deactivated")

        if not self.verify_password(password, user["password_hash"]):
            raise ValueError("Invalid username or password")

        self.user_repo.update_last_login(user["id"])
        access_token = self.create_access_token(user["id"], user["username"])
        refresh_token = self.create_refresh_token(user["id"])

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "username": user["username"],
            "first_name": user["first_name"],
            "last_name": user["last_name"]
        }

    def refresh_token(self, refresh_token: str) -> dict:
        payload = self.decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")

        user_id = int(payload["sub"])
        user = self.user_repo.find_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        new_access_token = self.create_access_token(user["id"], user["username"])
        return {"access_token": new_access_token, "token_type": "bearer"}
