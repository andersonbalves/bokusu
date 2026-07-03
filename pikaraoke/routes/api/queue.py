"""Queue endpoints for the /api mirror."""

from flask import current_app, jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.routes.api._utils import require_admin

api_queue_bp = Blueprint("api_queue", __name__, url_prefix="/api")


class QueueItemBody(Schema):
    song_id = fields.String(required=True)
    user = fields.String(required=True)


class QueueEditBody(Schema):
    user = fields.String(required=True)


@api_queue_bp.route("/queue", methods=["GET"])
def get_queue():
    k = current_app.config["KARAOKE_INSTANCE"]
    return jsonify(k.queue_manager.queue)


@api_queue_bp.route("/queue", methods=["POST"])
@api_queue_bp.arguments(QueueItemBody, location="json")
def add_to_queue(body):
    k = current_app.config["KARAOKE_INSTANCE"]
    result = k.queue_manager.enqueue(body["song_id"], body["user"])
    success = result[0]
    if not success:
        return jsonify({"error": result[1]}), 400
    return jsonify({"success": True})


@api_queue_bp.route("/queue/<path:item_id>", methods=["PUT"])
@require_admin
@api_queue_bp.arguments(QueueEditBody, location="json")
def edit_queue(body, item_id):
    k = current_app.config["KARAOKE_INSTANCE"]
    success = k.queue_manager.edit_user(item_id, body["user"])
    if not success:
        return jsonify({"error": "Item not found"}), 404
    return jsonify({"success": True})


@api_queue_bp.route("/queue/<path:item_id>", methods=["DELETE"])
@require_admin
def delete_queue_item(item_id):
    k = current_app.config["KARAOKE_INSTANCE"]
    success = k.queue_manager.queue_edit(item_id, "delete")
    if not success:
        return jsonify({"error": "Item not found"}), 404
    return jsonify({"success": True})


@api_queue_bp.route("/queue", methods=["DELETE"])
@require_admin
def clear_queue():
    k = current_app.config["KARAOKE_INSTANCE"]
    k.queue_manager.queue_clear()
    return jsonify({"success": True})
