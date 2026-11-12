from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import register_error_handlers
from app.routers import groups


def create_app() -> FastAPI:
    app = FastAPI(title="SplitBill API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in get_settings().cors_origins.split(",")],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    app.include_router(groups.router)
    return app


app = create_app()
