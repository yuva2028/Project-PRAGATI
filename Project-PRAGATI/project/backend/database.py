from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from pathlib import Path

# Use DATABASE_URL if configured in .env, otherwise fallback to SQLite
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

engine = None
SessionLocal = None

if SQLALCHEMY_DATABASE_URL:
    try:
        # Check if we need connect_args (only for sqlite)
        connect_args = {}
        if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
        
        engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
        # Test if it can be imported/loaded
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    except Exception as e:
        print(f"[WARN] Failed to initialize database with {SQLALCHEMY_DATABASE_URL}: {e}. Falling back to SQLite.")
        engine = None

if not engine:
    DATABASE_DIR = Path(__file__).resolve().parent.parent / "database"
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_DIR}/pragati.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_demo_user():
    """
    Creates a default demo user (admin / admin123) on first startup so that
    judges and reviewers can log in immediately without having to register.
    This is idempotent — safe to call on every startup.
    """
    try:
        from backend.models.user import User
        import bcrypt

        db = SessionLocal()
        try:
            existing = db.query(User).filter(User.username == "admin").first()
            if not existing:
                hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
                demo_user = User(
                    username="admin",
                    email="admin@pragati.isro",
                    hashed_password=hashed,
                    disabled=False,
                )
                db.add(demo_user)
                db.commit()
                print("[PRAGATI] Demo user created: admin / admin123")
            else:
                print("[PRAGATI] Demo user already exists: admin")
        finally:
            db.close()
    except Exception as e:
        print(f"[WARN] Could not seed demo user: {e}")

