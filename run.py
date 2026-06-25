"""Start the PRAGATI FastAPI backend from the repo root."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "project.backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["project"],
    )
