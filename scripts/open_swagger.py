import asyncio
import threading
import time
import webbrowser

import uvicorn


if __name__ == "__main__":
    if hasattr(asyncio, "WindowsSelectorEventLoopPolicy"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    url = "http://127.0.0.1:8000/docs"

    def open_browser() -> None:
        time.sleep(2)
        webbrowser.open(url)

    threading.Thread(target=open_browser, daemon=True).start()

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=[".venv/*", "tests/*", ".pytest_cache/*"],
    )
