"""System administration endpoints for the /api mirror."""

import threading
import time

import psutil
from flask import Response, jsonify
from flask_smorest import Blueprint

from pikaraoke import VERSION
from pikaraoke.lib.current_app import delayed_halt, get_karaoke_instance
from pikaraoke.lib.get_platform import is_raspberry_pi
from pikaraoke.lib.youtube_dl import upgrade_youtubedl
from pikaraoke.routes.api._utils import require_admin

api_system_bp = Blueprint("api_system", __name__, url_prefix="/api")

# delayed_halt cmd codes (see lib/current_app.py)
_HALT_ACTIONS = {"quit": 0, "shutdown": 1, "reboot": 2, "expand-fs": 3}


@api_system_bp.route("/system/info", methods=["GET"])
@require_admin
def system_info() -> Response:
    """CPU, memory, disk stats plus component versions."""
    k = get_karaoke_instance()
    try:
        cpu = f"{psutil.cpu_percent(interval=1)}%"
    except Exception:
        cpu = "unsupported"
    memory = psutil.virtual_memory()
    mem_str = (
        f"{round(memory.available / 1024.0 / 1024.0, 1)}MB free / "
        f"{round(memory.total / 1024.0 / 1024.0, 1)}MB total ({memory.percent}%)"
    )
    disk = psutil.disk_usage("/")
    disk_str = (
        f"{round(disk.free / 1024.0**3, 1)}GB free / "
        f"{round(disk.total / 1024.0**3, 1)}GB total ({disk.percent}%)"
    )
    return jsonify(
        {
            "cpu": cpu,
            "memory": mem_str,
            "disk": disk_str,
            "youtubedlVersion": k.youtubedl_version,
            "pikaraokeVersion": VERSION,
        }
    )


@api_system_bp.route("/system/library-stats", methods=["GET"])
@require_admin
def library_stats() -> Response:
    """Song count of the local library."""
    k = get_karaoke_instance()
    return jsonify({"song_count": len(k.song_manager.songs)})


@api_system_bp.route("/system/sync-library", methods=["POST"])
@require_admin
def sync_library() -> Response:
    """Trigger a background library scan."""
    k = get_karaoke_instance()
    started = k.sync_library()
    return jsonify({"status": "started" if started else "already_syncing"})


@api_system_bp.route("/system/update-ytdl", methods=["POST"])
@require_admin
def update_ytdl() -> Response:
    """Upgrade yt-dlp in a background thread."""
    k = get_karaoke_instance()

    def do_update() -> None:
        time.sleep(3)
        k.youtubedl_version = upgrade_youtubedl()

    threading.Thread(target=do_update).start()
    return jsonify({"status": "started"})


@api_system_bp.route("/system/connection-info", methods=["GET"])
def connection_info() -> Response:
    """Public connection metadata for player screens (QR code URL, platform)."""
    k = get_karaoke_instance()
    return jsonify({"url": k.url, "isRaspberryPi": is_raspberry_pi()})


@api_system_bp.route("/system/<action>", methods=["POST"])
@require_admin
def halt_action(action: str) -> tuple[Response, int] | Response:
    """Quit, shutdown, reboot or expand-fs via delayed halt."""
    if action not in _HALT_ACTIONS:
        return jsonify({"error": f"Unknown action: {action}"}), 404
    threading.Thread(target=delayed_halt, args=[_HALT_ACTIONS[action]]).start()
    return jsonify({"status": "started"})
