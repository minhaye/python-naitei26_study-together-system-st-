"""Run backend (uvicorn) and frontend (vite) together for local development."""

import asyncio
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend"

# Note: on Windows, asyncio subprocess creation requires the default Proactor
# event loop, so this process must NOT switch to WindowsSelectorEventLoopPolicy
# (that's only needed inside the backend's own process, via run.py).

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def stream_output(
    process: asyncio.subprocess.Process,
    prefix: str,
) -> None:
    assert process.stdout is not None

    async for line in process.stdout:
        print(f"[{prefix}] {line.decode(errors='replace').rstrip()}")


async def run_process(
    cmd: list[str],
    cwd: Path,
    prefix: str,
) -> asyncio.subprocess.Process:
    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    asyncio.create_task(stream_output(process, prefix))
    return process


async def main() -> None:
    npm = shutil.which("npm")

    if npm is None:
        print(
            "npm not found on PATH; cannot start the frontend.",
            file=sys.stderr,
        )
        sys.exit(1)

    backend = await run_process(
        [sys.executable, "run.py"],
        cwd=ROOT,
        prefix="backend",
    )

    frontend = await run_process(
        [npm, "run", "dev", "--", "--open"],
        cwd=FRONTEND_DIR,
        prefix="frontend",
    )

    print("Backend:  http://localhost:8000")
    print("Frontend: http://localhost:5173")
    print("Press Ctrl+C to stop both.\n")

    try:
        await asyncio.gather(
            backend.wait(),
            frontend.wait(),
        )
    except asyncio.CancelledError:
        pass
    finally:
        for process, name in (
            (backend, "backend"),
            (frontend, "frontend"),
        ):
            if process.returncode is None:
                print(f"Stopping {name}...")
                process.terminate()

        await asyncio.gather(
            backend.wait(),
            frontend.wait(),
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass