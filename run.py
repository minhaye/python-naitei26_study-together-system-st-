import asyncio
import sys

if sys.platform == "win32":
    # psycopg's async mode needs a selector event loop; Windows defaults to Proactor.
    # Must be set before uvicorn creates its event loop, so this has to live here
    # rather than in app/main.py (which uvicorn imports after the loop already exists).
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
