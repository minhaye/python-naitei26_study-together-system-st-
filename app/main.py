from fastapi import FastAPI

from app.profiles.routers.profile_router import router as profiles_router
from app.groups.routers.group_router import router as groups_router
from app.channels.routers.channel_router import router as channels_router
from app.messages.routers.message_router import router as messages_router
from app.study_rooms.routers.study_room_router import router as study_rooms_router
from app.resources.routers.resource_router import router as resources_router
from app.forum.routers.forum_router import router as forum_router
from app.notifications.routers.notification_router import router as notifications_router

app = FastAPI(title="Study Platform API", version="1.0.0")

app.include_router(profiles_router)
app.include_router(groups_router)
app.include_router(channels_router)
app.include_router(messages_router)
app.include_router(study_rooms_router)
app.include_router(resources_router)
app.include_router(forum_router)
app.include_router(notifications_router)
