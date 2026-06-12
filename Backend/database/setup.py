import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

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
    HOST = os.getenv("MYSQL_HOST", "localhost")
    PORT = int(os.getenv("MYSQL_PORT", "3306"))
    DATABASE = os.getenv("MYSQL_DATABASE", "ScrybeDB")
    USERNAME = os.getenv("MYSQL_USER", "root")
    PASSWORD = os.getenv("MYSQL_PASSWORD", "")

    @classmethod
    def get_connection(cls):
        conn = mysql.connector.connect(
            host=cls.HOST,
            port=cls.PORT,
            user=cls.USERNAME,
            password=cls.PASSWORD,
            database=cls.DATABASE
        )
        return MySQLConnectionWrapper(conn)

    @classmethod
    def init_database(cls):
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

