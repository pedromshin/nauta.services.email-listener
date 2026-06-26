"""
Entry point for container deployment (ECS).
Imports and exposes the FastAPI application from the app package.
"""

from app.main import app

__all__ = ["app"]

if __name__ == "__main__":
    # Allows running directly with `python main.py` for local testing
    import uvicorn

    from app.settings import get_settings

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info",
    )
