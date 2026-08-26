"""Run backend (uvicorn) and frontend (vite) together for local development.

This variant adds ANSI colors so backend/frontend logs, HTTP methods,
status codes, URLs, paths, IP:ports, and log levels are easier to scan.
No third-party package is required.
"""

import asyncio
import os
import re
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

# Helps enable ANSI escape sequences in many Windows terminals.
if os.name == "nt":
    os.system("")


# ---------------------------------------------------------------------------
# ANSI colors
# ---------------------------------------------------------------------------
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"

BLACK = "\033[30m"
WHITE = "\033[97m"
GRAY = "\033[90m"
BLUE = "\033[94m"
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
MAGENTA = "\033[95m"

BG_BLUE = "\033[44m"
BG_MAGENTA = "\033[45m"

PREFIX_STYLES = {
    "backend": f"{BOLD}{WHITE}{BG_BLUE}",
    "frontend": f"{BOLD}{WHITE}{BG_MAGENTA}",
}

METHOD_COLORS = {
    "GET": BLUE,
    "POST": GREEN,
    "PUT": YELLOW,
    "PATCH": YELLOW,
    "DELETE": RED,
    "OPTIONS": MAGENTA,
    "HEAD": CYAN,
}

HTTP_REQUEST_RE = re.compile(
    r'"(?P<method>GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) '
    r'(?P<path>\S+) HTTP/(?P<version>\d(?:\.\d)?)"'
)

HTTP_STATUS_RE = re.compile(r'(?P<space>\s)(?P<status>[1-5]\d{2})(?P<rest>\s[^\s]+)?$')
IP_PORT_RE = re.compile(r"\b(?P<ip>(?:\d{1,3}\.){3}\d{1,3}):(?P<port>\d+)\b")
URL_RE = re.compile(r"https?://[^\s]+")


def color_status(code: int) -> str:
    if code >= 500:
        return RED
    if code >= 400:
        return YELLOW
    if code >= 300:
        return CYAN
    if code >= 200:
        return GREEN
    return MAGENTA


def colorize_log(prefix: str, text: str) -> str:
    """Add readable colors to one backend/frontend log line."""

    # Prefix badge.
    prefix_style = PREFIX_STYLES.get(prefix, f"{BOLD}{WHITE}")
    badge = f"{prefix_style} {prefix} {RESET}"

    # Uvicorn/log levels.
    text = re.sub(r"\bINFO:", f"{DIM}{GRAY}INFO:{RESET}", text)
    text = re.sub(r"\bWARNING:", f"{BOLD}{YELLOW}WARNING:{RESET}", text)
    text = re.sub(r"\bERROR:", f"{BOLD}{RED}ERROR:{RESET}", text)
    text = re.sub(r"\bCRITICAL:", f"{BOLD}{RED}CRITICAL:{RESET}", text)

    # Client IP + ephemeral port.
    text = IP_PORT_RE.sub(
        lambda m: (
            f"{GRAY}{m.group('ip')}{RESET}:"
            f"{DIM}{GRAY}{m.group('port')}{RESET}"
        ),
        text,
    )

    # Uvicorn request: method, route/path, HTTP version.
    def request_replacer(match: re.Match[str]) -> str:
        method = match.group("method")
        path = match.group("path")
        version = match.group("version")
        method_color = METHOD_COLORS.get(method, WHITE)

        return (
            f'"{BOLD}{method_color}{method}{RESET} '
            f"{CYAN}{path}{RESET} "
            f"{DIM}{GRAY}HTTP/{version}{RESET}\""
        )

    text = HTTP_REQUEST_RE.sub(request_replacer, text)

    # HTTP status code at the end of a Uvicorn access-log line.
    def status_replacer(match: re.Match[str]) -> str:
        code = int(match.group("status"))
        rest = match.group("rest") or ""
        return (
            f"{match.group('space')}"
            f"{BOLD}{color_status(code)}{code}{RESET}"
            f"{rest}"
        )

    text = HTTP_STATUS_RE.sub(status_replacer, text)

    # Vite/server URLs such as http://localhost:5173/.
    text = URL_RE.sub(lambda m: f"{BOLD}{CYAN}{m.group(0)}{RESET}", text)

    # A few common success/failure words outside HTTP status lines.
    text = re.sub(r"\b(ready|started|running|success|successful)\b", rf"{GREEN}\1{RESET}", text, flags=re.I)
    text = re.sub(r"\b(failed|failure|exception|traceback)\b", rf"{RED}\1{RESET}", text, flags=re.I)

    return f"{badge} {text}"


async def stream_output(
    process: asyncio.subprocess.Process,
    prefix: str,
) -> None:
    assert process.stdout is not None

    async for line in process.stdout:
        text = line.decode(errors="replace").rstrip()
        print(colorize_log(prefix, text), flush=True)


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
            f"{BOLD}{RED}npm not found on PATH; cannot start the frontend.{RESET}",
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

    print()
    print(f"{BOLD}{BLUE}Backend :{RESET}  {CYAN}http://localhost:8000{RESET}")
    print(f"{BOLD}{MAGENTA}Frontend:{RESET}  {CYAN}http://localhost:5173{RESET}")
    print(f"{DIM}{GRAY}Press Ctrl+C to stop both.{RESET}\n")

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
                print(f"{YELLOW}Stopping {name}...{RESET}")
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
