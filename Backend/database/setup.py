import os
import sqlite3
from datetime import datetime, timezone
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------
# SQLite (local dev fallback) — enable with DB_ENGINE=sqlite
# ---------------------------------------------------------------

def _parse_datetime(value):
    """PARSE_DECLTYPES converter for DATETIME columns so repository
    code can call row[..].strftime(...) unchanged (like on MySQL)."""
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8", "replace")
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None

sqlite3.register_converter("datetime", _parse_datetime)

def _utc_timestamp():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

class SQLiteConnectionWrapper:
    """Drop-in connection wrapper matching the MySQL wrapper's surface.
    - '?' placeholders work natively in sqlite3
    - DATETIME columns are re-parsed as datetime objects (PARSE_DECLTYPES)
      so repository code calling row[..].strftime keeps working
    - UTC_TIMESTAMP() is registered so user_repository SQL is DB-agnostic
    """

    def __init__(self, path):
        self.connection = sqlite3.connect(
            path,
            detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
        )
        self.connection.row_factory = sqlite3.Row
        try:
            self.connection.execute("PRAGMA foreign_keys = ON")
        except Exception:
            pass
        self.connection.create_function("UTC_TIMESTAMP", 0, _utc_timestamp)

    def cursor(self):
        return self.connection.cursor()

    def commit(self):
        self.connection.commit()

    def close(self):
        self.connection.close()

class MySQLCursorWrapper:
    def __init__(self, cursor):
        self.cursor = cursor

    def execute(self, operation, params=None):
        # Translate placeholder '?' to '%s'
        if isinstance(operation, str):
            operation = operation.replace('?', '%s')
        return self.cursor.execute(operation, params)

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def close(self):
        self.cursor.close()

    @property
    def rowcount(self):
        return self.cursor.rowcount

    @property
    def lastrowid(self):
        return self.cursor.lastrowid

class MySQLConnectionWrapper:
    def __init__(self, connection):
        self.connection = connection

    def cursor(self):
        return MySQLCursorWrapper(self.connection.cursor())

    def commit(self):
        self.connection.commit()

    def close(self):
        self.connection.close()

class DatabaseConfig:
    DB_ENGINE = os.getenv("DB_ENGINE", "mysql").lower()

    HOST = os.getenv("MYSQL_HOST", "localhost")
    PORT = int(os.getenv("MYSQL_PORT", "3306"))
    DATABASE = os.getenv("MYSQL_DATABASE", "ScrybeDB")
    USERNAME = os.getenv("MYSQL_USER", "root")
    PASSWORD = os.getenv("MYSQL_PASSWORD", "")

    # Where the SQLite file lives when DB_ENGINE=sqlite
    SQLITE_PATH = os.getenv(
        "SQLITE_PATH",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scrybe.db"),
    )

    @classmethod
    def get_connection(cls):
        if cls.DB_ENGINE == "sqlite":
            cls._ensure_sqlite_dir()
            return SQLiteConnectionWrapper(cls.SQLITE_PATH)

        conn = mysql.connector.connect(
            host=cls.HOST,
            port=cls.PORT,
            user=cls.USERNAME,
            password=cls.PASSWORD,
            database=cls.DATABASE
        )
        return MySQLConnectionWrapper(conn)

    @classmethod
    def _ensure_sqlite_dir(cls):
        directory = os.path.dirname(cls.SQLITE_PATH)
        if directory:
            os.makedirs(directory, exist_ok=True)

    @classmethod
    def init_database(cls):
        if cls.DB_ENGINE == "sqlite":
            # The file is created lazily on first connect
            cls._ensure_sqlite_dir()
            return

        try:
            conn = mysql.connector.connect(
                host=cls.HOST,
                port=cls.PORT,
                user=cls.USERNAME,
                password=cls.PASSWORD
            )
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {cls.DATABASE}")
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Database init warning: {e}")

    @classmethod
    def execute_schema(cls):
        if cls.DB_ENGINE == "sqlite":
            cls._ensure_sqlite_dir()
            schema_path = os.path.join(os.path.dirname(__file__), "schema_sqlite.sql")
            if os.path.exists(schema_path):
                with open(schema_path, "r", encoding="utf-8") as f:
                    sql = f.read()
                conn = sqlite3.connect(cls.SQLITE_PATH)
                try:
                    conn.executescript(sql)
                    conn.commit()
                finally:
                    conn.close()
                print("SQLite database schema initialized successfully.")
            return

        schema_path = os.path.join(os.path.dirname(__file__), "schema_mysql.sql")
        if os.path.exists(schema_path):
            with open(schema_path, "r", encoding="utf-8") as f:
                sql = f.read()
            # MySQL connector cannot run multiple statements with standard execute unless we use multi=True
            conn = mysql.connector.connect(
                host=cls.HOST,
                port=cls.PORT,
                user=cls.USERNAME,
                password=cls.PASSWORD,
                database=cls.DATABASE
            )
            cursor = conn.cursor()
            # Split by semicolon, but clean up the statements
            statements = sql.split(';')
            for statement in statements:
                stmt_stripped = statement.strip()
                if stmt_stripped:
                    try:
                        cursor.execute(stmt_stripped)
                        conn.commit()
                    except Exception as e:
                        print(f"Schema execution warning on stmt [{stmt_stripped[:50]}...]: {e}")
            cursor.close()
            conn.close()
            print("MySQL database schema initialized successfully.")

    @classmethod
    def migrate(cls):
        """Idempotent column-level migrations for pre-existing databases.
        New installs get everything from the schema files; older installs
        are patched in place here."""
        if cls.DB_ENGINE == "sqlite":
            cls._ensure_sqlite_dir()
            conn = sqlite3.connect(cls.SQLITE_PATH)
            try:
                cursor = conn.cursor()
                cursor.execute("PRAGMA table_info(Users)")
                cols = {row[1] for row in cursor.fetchall()}
                if "AvatarUrl" not in cols:
                    cursor.execute("ALTER TABLE Users ADD COLUMN AvatarUrl TEXT")
                    conn.commit()
                cursor.close()
            finally:
                conn.close()
            return

        try:
            conn = mysql.connector.connect(
                host=cls.HOST,
                port=cls.PORT,
                user=cls.USERNAME,
                password=cls.PASSWORD,
                database=cls.DATABASE
            )
            cursor = conn.cursor()
            # widen AvatarUrl so base64 data-URL avatars fit
            cursor.execute("ALTER TABLE Users MODIFY AvatarUrl LONGTEXT")
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Schema migration warning: {e}")
