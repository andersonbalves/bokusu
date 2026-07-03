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


class QueueItemActionSchema(Schema):
    song = fields.String(required=True)
    action = fields.String(required=True)  # top, bottom, up, down


class AddRandomSchema(Schema):
    amount = fields.Integer(required=True)


class SongQuerySchema(Schema):
    song = fields.String(required=True)


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


@api_queue_bp.route("/queue/item", methods=["PATCH"])
@require_admin
@api_queue_bp.arguments(QueueItemActionSchema, location="json")
def move_queue_item(body: dict) -> tuple[Response, int] | Response:
    k = current_app.config["KARAOKE_INSTANCE"]
    song_path = body["song"]
    action = body["action"]

    # 1. Find the index
    index = -1
    for i, item in enumerate(k.queue_manager.queue):
        if item["file"] == song_path:
            index = i
            break

    if index == -1:
        return jsonify({"error": "Song not found in queue"}), 404

    # 2. Calculate the new index
    if action == "top":
        new_index = 0
    elif action == "bottom":
        new_index = len(k.queue_manager.queue) - 1
    elif action == "up":
        new_index = max(0, index - 1)
    elif action == "down":
        new_index = min(len(k.queue_manager.queue) - 1, index + 1)
    else:
        return jsonify({"error": f"Unknown action: {action}"}), 400

    success = k.queue_manager.reorder(index, new_index)
    if not success:
        return jsonify({"error": "Failed to reorder item"}), 400
    return jsonify({"success": True})


@api_queue_bp.route("/queue/item", methods=["DELETE"])
@require_admin
@api_queue_bp.arguments(SongQuerySchema, location="query")
def delete_queue_item_by_song(query: dict) -> tuple[Response, int] | Response:
    k = current_app.config["KARAOKE_INSTANCE"]
    song = query["song"]
    success = k.queue_manager.queue_edit(song, "delete")
    if not success:
        return jsonify({"error": "Item not found in queue"}), 404
    return jsonify({"success": True})


@api_queue_bp.route("/queue/random", methods=["POST"])
@require_admin
@api_queue_bp.arguments(AddRandomSchema, location="json")
def add_random_songs(body: dict) -> Response:
    k = current_app.config["KARAOKE_INSTANCE"]
    success = k.queue_manager.queue_add_random(body["amount"])
    return jsonify({"success": success})
