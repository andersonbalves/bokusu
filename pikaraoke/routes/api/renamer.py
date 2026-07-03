"""Batch song renamer endpoints for the /api mirror."""

import logging
import os

from flask import jsonify, Response
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_karaoke_instance
from pikaraoke.lib.metadata_parser import get_song_correct_name
from pikaraoke.routes.api._utils import names_match, require_admin

api_renamer_bp = Blueprint("api_renamer", __name__, url_prefix="/api")

RESULTS_PER_PAGE = 10


class RenamerQuerySchema(Schema):
    page = fields.Integer(load_default=1)
    only_mismatched = fields.Boolean(load_default=False)


class RenamerRenameBodySchema(Schema):
    old_name = fields.String(required=True)
    new_name = fields.String(required=True)


@api_renamer_bp.route("/renamer/songs", methods=["GET"])
@api_renamer_bp.arguments(RenamerQuerySchema, location="query")
@require_admin
def renamer_songs(query: dict) -> Response:
    """Library files with rename suggestions (before/after)."""
    k = get_karaoke_instance()
    entries = []
    for song in k.song_manager.songs:
        current = k.song_manager.filename_from_path(song)
        suggested = get_song_correct_name(current, raw_filename=song)
        is_equal = names_match(current, suggested)
        if query["only_mismatched"] and is_equal:
            continue
        entries.append(
            {
                "file": song,
                "currentName": current,
                "suggestedName": suggested,
                "isEqual": is_equal,
            }
        )

    page = max(query["page"], 1)
    start = (page - 1) * RESULTS_PER_PAGE
    return jsonify(
        {
            "songs": entries[start : start + RESULTS_PER_PAGE],
            "total": len(entries),
            "page": page,
        }
    )


@api_renamer_bp.route("/renamer/rename", methods=["POST"])
@api_renamer_bp.arguments(RenamerRenameBodySchema, location="json")
@require_admin
def renamer_rename(body: dict) -> tuple[Response, int] | Response:
    """Apply a single rename suggestion."""
    k = get_karaoke_instance()
    old_name = body["old_name"]
    if k.queue_manager.is_song_in_queue(old_name):
        return jsonify({"error": "Song is in the current queue"}), 409

    if not os.path.isfile(old_name):
        return jsonify({"error": "Source song file not found"}), 404

    try:
        k.song_manager.rename(old_name, body["new_name"])
    except OSError as exc:
        logging.error(f"Error renaming file: {exc}")
        return jsonify({"error": f"Error renaming file: {exc}"}), 500
    return jsonify({"success": True, "message": "Song renamed"})
