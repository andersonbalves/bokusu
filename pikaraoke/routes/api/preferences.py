"""Preferences endpoints for the /api mirror."""

from flask import current_app, jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.routes.api._utils import require_admin

api_prefs_bp = Blueprint("api_prefs", __name__, url_prefix="/api")


class PrefBody(Schema):
    value = fields.Raw(required=True)


@api_prefs_bp.route("/preferences", methods=["GET"])
def get_preferences():
    k = current_app.config["KARAOKE_INSTANCE"]
    return jsonify(k.preferences.get_all())


@api_prefs_bp.route("/preferences/<key>", methods=["PUT"])
@require_admin
@api_prefs_bp.arguments(PrefBody, location="json")
def put_preference(body, key):
    k = current_app.config["KARAOKE_INSTANCE"]
    if key not in k.preferences.DEFAULTS:
        return jsonify({"error": "Unknown preference"}), 404

    success, message = k.preferences.set(key, body["value"])
    status_code = 200 if success else 500
    return jsonify({"success": success, "message": message}), status_code


@api_prefs_bp.route("/preferences", methods=["DELETE"])
@require_admin
def delete_preferences():
    k = current_app.config["KARAOKE_INSTANCE"]
    success, message = k.preferences.reset_all()
    status_code = 200 if success else 500
    return jsonify({"success": success, "message": message}), status_code
