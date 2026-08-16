from pydantic import BaseModel


class MeetingTokenResponse(BaseModel):
    server_url: str
    participant_token: str
