from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.attachments.routers.attachment_router import router as attachments_router
from app.auth.routers.auth_router import router as auth_router
from app.conversations.routers.conversation_router import router as conversations_router
from app.profiles.routers.profile_router import router as profiles_router
from app.groups.routers.group_router import router as groups_router
from app.channels.routers.channel_router import router as channels_router
from app.messages.routers.message_router import router as messages_router
from app.study_rooms.routers.study_room_router import router as study_rooms_router
from app.resources.routers.resource_router import router as resources_router
from app.forum.routers.forum_router import router as forum_router
from app.notifications.routers.notification_router import router as notifications_router
from app.invitations.routers.invitation_router import router as invitations_router

app = FastAPI(title="Study Platform API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(auth_router)
app.include_router(profiles_router)
app.include_router(groups_router)
app.include_router(channels_router)
app.include_router(conversations_router)
app.include_router(messages_router)
app.include_router(attachments_router)
app.include_router(study_rooms_router)
app.include_router(resources_router)
app.include_router(forum_router)
app.include_router(notifications_router)
app.include_router(invitations_router)
