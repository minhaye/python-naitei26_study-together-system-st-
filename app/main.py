from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.session import engine
from app.attachments.routers.attachment_router import router as attachments_router
from app.auth.routers.auth_router import router as auth_router
from app.conversations.routers.conversation_router import router as conversations_router
from app.profiles.routers.profile_router import router as profiles_router
from app.groups.routers.group_router import router as groups_router
from app.channels.routers.channel_router import router as channels_router
from app.messages.routers.message_router import router as messages_router
from app.study_rooms.routers.study_room_router import router as study_rooms_router
from app.resources.routers.resource_router import router as resources_router
from app.notes.routers.note_router import router as notes_router
from app.forum.routers.forum_router import router as forum_router
from app.notifications.routers.notification_router import router as notifications_router
from app.invitations.routers.invitation_router import router as invitations_router
from app.tasks.routers.task_router import router as tasks_router
from app.roadmaps.routers.roadmap_router import router as roadmaps_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up the DB connection pool on startup so the first real request
    doesn't pay the cold-connection cost (~200-400ms) on top of everything else."""
    try:
        async with engine.connect() as conn:
            await conn.exec_driver_sql("SELECT 1")
    except Exception:
        # Don't block startup if the DB is temporarily unreachable
        pass
    yield


app = FastAPI(title="Study Platform API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.get("/health", include_in_schema=False)
async def health_check():
    """Lightweight keep-alive endpoint — no DB call, no auth.
    Frontend pings this every 10 min to prevent Render free-tier spin-down."""
    return JSONResponse({"status": "ok"})


app.include_router(auth_router)
app.include_router(profiles_router)
app.include_router(groups_router)
app.include_router(channels_router)
app.include_router(conversations_router)
app.include_router(messages_router)
app.include_router(attachments_router)
app.include_router(study_rooms_router)
app.include_router(resources_router)
app.include_router(notes_router)
app.include_router(forum_router)
app.include_router(notifications_router)
app.include_router(invitations_router)
app.include_router(tasks_router)
app.include_router(roadmaps_router)
