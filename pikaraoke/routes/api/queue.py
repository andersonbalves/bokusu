"""Queue endpoints for the /api mirror."""

from flask import current_app, jsonify, Response
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.routes.api._utils import require_admin

api_queue_bp = Blueprint("api_queue", __name__, url_prefix="/api")


class QueueItemBodySchema(Schema):
    song_id = fields.String(required=True)
    user = fields.String(required=True)


class QueueEditBodySchema(Schema):
    user = fields.String(required=True)


class ReorderBodySchema(Schema):
    old_index = fields.Integer(required=True)
    new_index = fields.Integer(required=True)


@api_queue_bp.route("/queue", methods=["GET"])
def get_queue() -> Response:
    k = current_app.config["KARAOKE_INSTANCE"]
    return jsonify(k.queue_manager.queue)


@api_queue_bp.route("/queue", methods=["POST"])
@api_queue_bp.arguments(QueueItemBodySchema, location="json")
def add_to_queue(body: dict) -> tuple[Response, int] | Response:
    k = current_app.config["KARAOKE_INSTANCE"]
    result = k.queue_manager.enqueue(body["song_id"], body["user"])
    success = result[0]
    if not success:
        return jsonify({"error": result[1]}), 400
    return jsonify({"success": True})


@api_queue_bp.route("/queue/<path:item_id>", methods=["PUT"])
@require_admin
@api_queue_bp.arguments(QueueEditBodySchema, location="json")
def edit_queue(body: dict, item_id: str) -> tuple[Response, int] | Response:
    k = current_app.config["KARAOKE_INSTANCE"]
    success = k.queue_manager.edit_user(item_id, body["user"])
    if not success:
        return jsonify({"error": "Item not found"}), 404
    return jsonify({"success": True})


@api_queue_bp.route("/queue/<path:item_id>", methods=["DELETE"])
@require_admin
def delete_queue_item(item_id: str) -> tuple[Response, int] | Response:
    k = current_app.config["KARAOKE_INSTANCE"]
    success = k.queue_manager.queue_edit(item_id, "delete")
    if not success:
        return jsonify({"error": "Item not found"}), 404
    return jsonify({"success": True})


@api_queue_bp.route("/queue", methods=["DELETE"])
@require_admin
def clear_queue() -> Response:
    k = current_app.config["KARAOKE_INSTANCE"]
    k.queue_manager.queue_clear()
    return jsonify({"success": True})


@api_queue_bp.route("/queue/reorder", methods=["PUT"])
@require_admin
@api_queue_bp.arguments(ReorderBodySchema, location="json")
def reorder_queue(body: dict) -> tuple[Response, int] | Response:
    k = current_app.config["KARAOKE_INSTANCE"]
    success = k.queue_manager.reorder(body["old_index"], body["new_index"])
    if not success:
        return jsonify({"error": "Failed to reorder queue"}), 400
    return jsonify({"success": True})
