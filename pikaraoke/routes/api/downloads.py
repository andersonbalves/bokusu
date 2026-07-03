"""Download queue endpoints for the /api mirror."""

from flask import jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_karaoke_instance

api_downloads_bp = Blueprint("api_downloads", __name__, url_prefix="/api")


class DownloadBody(Schema):
    song_url = fields.String(required=True)
    song_added_by = fields.String(required=True)
    song_title = fields.String(required=True)
    queue = fields.Boolean(load_default=False)


@api_downloads_bp.route("/downloads", methods=["POST"])
@api_downloads_bp.arguments(DownloadBody, location="json")
def start_download(body):
    """Queue a YouTube download, optionally enqueueing after."""
    k = get_karaoke_instance()
    k.download_manager.queue_download(
        body["song_url"], body["queue"], body["song_added_by"], body["song_title"]
    )
    return jsonify({"status": "ok"})


@api_downloads_bp.route("/downloads", methods=["GET"])
def downloads_status():
    """Active, pending and failed downloads."""
    k = get_karaoke_instance()
    return jsonify(k.download_manager.get_downloads_status())


@api_downloads_bp.route("/downloads/errors/<error_id>", methods=["DELETE"])
def dismiss_error(error_id):
    """Dismiss a download error by id."""
    k = get_karaoke_instance()
    return jsonify({"success": k.download_manager.remove_error(error_id)})
