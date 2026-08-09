from fastapi import FastAPI

from app.api.health import router as health_router
from app.profiles.router import router as profiles_router
from app.groups.router import router as groups_router
from app.channels.router import router as channels_router
from app.messages.router import router as messages_router
from app.study_rooms.router import router as study_rooms_router
from app.resources.router import router as resources_router
from app.forum.router import router as forum_router
from app.notifications.router import router as notifications_router

app = FastAPI(title="Study Platform API", version="1.0.0")

app.include_router(health_router)
app.include_router(profiles_router)
app.include_router(groups_router)
app.include_router(channels_router)
app.include_router(messages_router)
app.include_router(study_rooms_router)
app.include_router(resources_router)
app.include_router(forum_router)
app.include_router(notifications_router)
