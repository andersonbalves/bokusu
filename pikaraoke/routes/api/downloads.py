"""Download queue endpoints for the /api mirror."""

from flask import jsonify, Response
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_karaoke_instance

api_downloads_bp = Blueprint("api_downloads", __name__, url_prefix="/api")


class DownloadBodySchema(Schema):
    song_url = fields.String(required=True)
    song_added_by = fields.String(required=True)
    song_title = fields.String(required=True)
    queue = fields.Boolean(load_default=False)


@api_downloads_bp.route("/downloads", methods=["POST"])
@api_downloads_bp.arguments(DownloadBodySchema, location="json")
def start_download(body: dict) -> tuple[Response, int] | Response:
    """Queue a YouTube download, optionally enqueueing after."""
    k = get_karaoke_instance()
    k.download_manager.queue_download(
        body["song_url"], body["queue"], body["song_added_by"], body["song_title"]
    )
    return jsonify({"status": "ok"})


@api_downloads_bp.route("/downloads", methods=["GET"])
def downloads_status() -> Response:
    """Active, pending and failed downloads."""
    k = get_karaoke_instance()
    return jsonify(k.download_manager.get_downloads_status())


@api_downloads_bp.route("/downloads/errors/<error_id>", methods=["DELETE"])
def dismiss_error(error_id: str) -> tuple[Response, int] | Response:
    """Dismiss a download error by id."""
    k = get_karaoke_instance()
    success = k.download_manager.remove_error(error_id)
    if not success:
        return jsonify({"error": "Download error ID not found"}), 404
    return jsonify({"success": True})
