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
