"""Local library file endpoints for the /api mirror."""

import logging
import os

from flask import Response, jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_karaoke_instance
from pikaraoke.lib.metadata_parser import youtube_id_suffix
from pikaraoke.routes.api._utils import require_admin

api_files_bp = Blueprint("api_files", __name__, url_prefix="/api")


class BrowseQuerySchema(Schema):
    q = fields.String(load_default="")
    letter = fields.String(load_default="")
    sort = fields.String(load_default="alpha")
    page = fields.Integer(load_default=1)


class RenameBodySchema(Schema):
    old_file_name = fields.String(required=True)
    new_file_name = fields.String(required=True)


class SongQuerySchema(Schema):
    song = fields.String(required=True)


@api_files_bp.route("/files/browse", methods=["GET"])
@api_files_bp.arguments(BrowseQuerySchema, location="query")
def browse(query: dict) -> Response:
    """Paginated, filterable list of library files."""
    k = get_karaoke_instance()
    songs = list(k.song_manager.songs)

    if query["q"]:
        q = query["q"].lower()
        songs = [s for s in songs if q in s.lower()]
    if query["letter"]:
        letter = query["letter"].lower()
        songs = [
            s for s in songs if k.song_manager.display_name_from_path(s).lower().startswith(letter)
        ]
    if query["sort"] == "date":
        # Resolve mtime based on full paths
        songs = sorted(
            songs, key=lambda s: os.path.getmtime(s) if os.path.exists(s) else 0, reverse=True
        )

    per_page = k.browse_results_per_page
    page = max(query["page"], 1)
    start = (page - 1) * per_page
    page_songs = songs[start : start + per_page]

    return jsonify(
        {
            "files": [
                {"path": s, "displayName": k.song_manager.display_name_from_path(s)}
                for s in page_songs
            ],
            "total": len(songs),
            "page": page,
            "perPage": per_page,
        }
    )


@api_files_bp.route("/files", methods=["DELETE"])
@api_files_bp.arguments(SongQuerySchema, location="query")
@require_admin
def delete_file(query: dict) -> tuple[Response, int] | Response:
    """Delete a library file unless it is queued."""
    k = get_karaoke_instance()
    song = query["song"]
    if not k.song_manager.is_path_in_library(song):
        return jsonify({"error": "Path is outside the song library"}), 400

    if k.queue_manager.is_song_in_queue(song):
        return jsonify({"error": "Song is in the current queue"}), 409

    if not os.path.isfile(song):
        return jsonify({"error": "Song file not found"}), 404

    try:
        k.song_manager.delete(song)
    except OSError as exc:
        logging.error(f"Error deleting file: {exc}")
        return jsonify({"error": f"Error deleting file: {exc}"}), 500

    return jsonify({"success": True, "message": "Song deleted"})


@api_files_bp.route("/files", methods=["PATCH"])
@api_files_bp.arguments(RenameBodySchema, location="json")
@require_admin
def rename_file(body: dict) -> tuple[Response, int] | Response:
    """Rename a library file, preserving the YouTube id suffix."""
    k = get_karaoke_instance()
    old_name = body["old_file_name"]
    if not k.song_manager.is_path_in_library(old_name):
        return jsonify({"error": "Path is outside the song library"}), 400
    if (
        os.path.basename(body["new_file_name"]) != body["new_file_name"]
        or body["new_file_name"] in (".", "..")
    ):
        return jsonify({"error": "Invalid file name"}), 400

    if k.queue_manager.is_song_in_queue(old_name):
        return jsonify({"error": "Song is in the current queue"}), 409

    if not os.path.isfile(old_name):
        return jsonify({"error": "Source song file not found"}), 404

    new_name_full = body["new_file_name"] + youtube_id_suffix(old_name)
    extension = os.path.splitext(old_name)[1]
    target = os.path.join(k.song_manager.download_path, new_name_full + extension)

    # Allow case-only renames or identical renames (no-op)
    if os.path.abspath(old_name) == os.path.abspath(target):
        if old_name != target:
            # Let's perform the rename to change the casing
            try:
                k.song_manager.rename(old_name, new_name_full)
            except OSError as exc:
                logging.error(f"Error renaming file: {exc}")
                return jsonify({"error": f"Error renaming file: {exc}"}), 500
        return jsonify({"success": True, "message": "Song renamed"})

    if os.path.isfile(target):
        return jsonify({"error": "Filename already exists"}), 409

    try:
        k.song_manager.rename(old_name, new_name_full)
    except OSError as exc:
        logging.error(f"Error renaming file: {exc}")
        return jsonify({"error": f"Error renaming file: {exc}"}), 500
    return jsonify({"success": True, "message": "Song renamed"})
