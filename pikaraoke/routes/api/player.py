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


@api_player_bp.route("/action", methods=["POST"])
@require_admin
@api_player_bp.arguments(ActionBody, location="json")
def player_action(body):
    k = current_app.config["KARAOKE_INSTANCE"]
    pc = k.playback_controller
    action = body["action"]

    if action == "play":
        pc.unpause()
    elif action == "pause":
        pc.pause()
    elif action == "stop":
        pc.stop()
    elif action == "skip":
        pc.skip()
    elif action == "restart":
        pc.restart()

    return jsonify({"success": True, "action": action})


@api_player_bp.route("/volume", methods=["POST"])
@require_admin
@api_player_bp.arguments(VolumeBody, location="json")
def player_volume(body):
    k = current_app.config["KARAOKE_INSTANCE"]
    k.set_volume(body["level"])
    return jsonify({"success": True, "volume": body["level"]})


@api_player_bp.route("/pitch", methods=["POST"])
@require_admin
@api_player_bp.arguments(PitchBody, location="json")
def player_pitch(body):
    k = current_app.config["KARAOKE_INSTANCE"]
    k.set_audio_pitch(body["level"])
    return jsonify({"success": True, "pitch": body["level"]})
