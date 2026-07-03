"""Player control endpoints for the /api mirror."""

from flask import current_app, jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields, validate

from pikaraoke.routes.api._utils import require_admin

api_player_bp = Blueprint("api_player", __name__, url_prefix="/api/player")


class ActionBody(Schema):
    action = fields.String(
        required=True, validate=validate.OneOf(["play", "pause", "stop", "skip", "restart"])
    )


class VolumeBody(Schema):
    level = fields.Float(required=True, validate=validate.Range(min=0, max=1))


class PitchBody(Schema):
    level = fields.Integer(required=True, validate=validate.Range(min=-12, max=12))


@api_player_bp.route("", methods=["GET"])
def get_player_state():
    """Get the currently playing song state. Public access so any connected client can render playback state."""
    k = current_app.config["KARAOKE_INSTANCE"]
    return jsonify(k.get_now_playing())


@api_player_bp.route("/action", methods=["POST"])
@require_admin
@api_player_bp.arguments(ActionBody, location="json")
def player_action(body):
    k = current_app.config["KARAOKE_INSTANCE"]
    pc = k.playback_controller
    action = body["action"]

    success = True
    if action == "play":
        if not pc.is_playing:
            success = False
        elif pc.is_paused:
            success = pc.pause()
    elif action == "pause":
        if not pc.is_playing:
            success = False
        elif not pc.is_paused:
            success = pc.pause()
    elif action == "stop":
        pc.end_song()
        success = True
    elif action == "skip":
        success = pc.skip()
    elif action == "restart":
        success = k.restart()

    if not success:
        return jsonify({"success": False, "action": action}), 409

    return jsonify({"success": True, "action": action})


@api_player_bp.route("/volume", methods=["GET"])
@require_admin
def get_player_volume():
    k = current_app.config["KARAOKE_INSTANCE"]
    return jsonify({"volume": k.volume})


@api_player_bp.route("/volume", methods=["POST"])
@require_admin
@api_player_bp.arguments(VolumeBody, location="json")
def player_volume(body):
    k = current_app.config["KARAOKE_INSTANCE"]
    success = k.volume_change(body["level"])
    if not success:
        return jsonify({"success": False, "volume": body["level"]}), 409
    return jsonify({"success": True, "volume": body["level"]})


@api_player_bp.route("/pitch", methods=["GET"])
@require_admin
def get_player_pitch():
    k = current_app.config["KARAOKE_INSTANCE"]
    return jsonify({"pitch": k.playback_controller.now_playing_transpose})


@api_player_bp.route("/pitch", methods=["POST"])
@require_admin
@api_player_bp.arguments(PitchBody, location="json")
def player_pitch(body):
    k = current_app.config["KARAOKE_INSTANCE"]
    if not k.playback_controller.is_playing:
        return jsonify({"success": False, "pitch": body["level"]}), 409
    k.transpose_current(body["level"])
    return jsonify({"success": True, "pitch": body["level"]})
