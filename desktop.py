#!/usr/bin/env python3
"""Launch lipano as a self-contained Windows or Linux desktop window."""

from __future__ import annotations

import contextlib
import http.server
import os
from pathlib import Path
import shutil
import signal
import socketserver
import subprocess
import sys
import threading
import urllib.error
import urllib.request


APP_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
BROWSER_CANDIDATES = (
    "google-chrome",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "msedge",
)
SERVER_PORT = 49317
HEALTH_RESPONSE = b"lipano-ready"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Serve only the installed application without terminal noise or caching."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def log_message(self, _format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        if self.path == "/__lipano_health__":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(HEALTH_RESPONSE)))
            self.end_headers()
            self.wfile.write(HEALTH_RESPONSE)
            return
        super().do_GET()

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


class LocalServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def find_browser() -> str | None:
    for candidate in BROWSER_CANDIDATES:
        if path := shutil.which(candidate):
            return path

    if sys.platform == "win32":
        windows_locations = []
        local_app_data = os.environ.get("LOCALAPPDATA")
        program_files = os.environ.get("PROGRAMFILES")
        program_files_x86 = os.environ.get("PROGRAMFILES(X86)")
        if local_app_data:
            windows_locations.extend([
                Path(local_app_data) / "Google/Chrome/Application/chrome.exe",
                Path(local_app_data) / "Microsoft/Edge/Application/msedge.exe",
            ])
        for root in filter(None, (program_files, program_files_x86)):
            windows_locations.extend([
                Path(root) / "Google/Chrome/Application/chrome.exe",
                Path(root) / "Microsoft/Edge/Application/msedge.exe",
            ])
        for path in windows_locations:
            if path.is_file():
                return str(path)
    return None


def show_error(message: str) -> None:
    if sys.platform == "win32":
        import ctypes

        ctypes.windll.user32.MessageBoxW(0, message, "lipano", 0x10)
        return
    zenity = shutil.which("zenity")
    if zenity:
        subprocess.run(
            [zenity, "--error", "--title=lipano", f"--text={message}"],
            check=False,
        )
    else:
        print(f"lipano: {message}", file=sys.stderr)


def existing_server_is_ready() -> bool:
    try:
        with urllib.request.urlopen(
            f"http://127.0.0.1:{SERVER_PORT}/__lipano_health__",
            timeout=0.5,
        ) as response:
            return response.read() == HEALTH_RESPONSE
    except (OSError, urllib.error.URLError):
        return False


def get_profile_dir() -> Path:
    if sys.platform == "win32":
        config_root = Path(
            os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")
        )
        profile_name = "browser-profile"
    else:
        config_root = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
        profile_name = "chrome-profile"
    return config_root / "lipano" / profile_name


def main() -> int:
    if not (APP_DIR / "index.html").is_file():
        show_error("ไม่พบไฟล์โปรแกรม index.html")
        return 1

    browser = find_browser()
    if not browser:
        show_error("lipano ต้องใช้ Microsoft Edge, Google Chrome หรือ Chromium")
        return 1

    owns_server = True
    try:
        server = LocalServer(("127.0.0.1", SERVER_PORT), QuietHandler)
    except OSError:
        if not existing_server_is_ready():
            show_error(f"พอร์ตภายใน {SERVER_PORT} ถูกใช้งานโดยโปรแกรมอื่น")
            return 1
        owns_server = False
        server = None

    server_thread = None
    if server:
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
    process: subprocess.Popen[bytes] | None = None

    def stop_server(*_args: object) -> None:
        if process and process.poll() is None:
            process.terminate()
        if server:
            threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop_server)
    signal.signal(signal.SIGINT, stop_server)

    profile_dir = get_profile_dir()
    profile_dir.mkdir(parents=True, exist_ok=True)
    command = [
        browser,
        f"--app=http://127.0.0.1:{SERVER_PORT}/",
        f"--user-data-dir={profile_dir}",
        "--window-size=1280,900",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-mode",
        "--disable-component-update",
        "--disable-sync",
    ]
    if sys.platform != "win32":
        command.extend(["--class=lipano", "--name=lipano"])
    try:
        with open(os.devnull, "wb") as devnull:
            process = subprocess.Popen(command, stdout=devnull, stderr=devnull)
            return_code = process.wait()
    except OSError as exc:
        show_error(f"เปิดหน้าต่างโปรแกรมไม่สำเร็จ: {exc}")
        return 1
    finally:
        if owns_server and server:
            server.shutdown()
            server.server_close()
            if server_thread:
                server_thread.join(timeout=2)

    return return_code


if __name__ == "__main__":
    with contextlib.suppress(KeyboardInterrupt):
        raise SystemExit(main())
