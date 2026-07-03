"""Search endpoints for the /api mirror."""

from flask import jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.youtube_dl import get_search_results

api_search_bp = Blueprint("api_search", __name__, url_prefix="/api")


class SearchQuerySchema(Schema):
    q = fields.String(required=True)
    non_karaoke = fields.Boolean(load_default=False)


@api_search_bp.route("/search", methods=["GET"])
@api_search_bp.arguments(SearchQuerySchema, location="query")
def api_search(args):
    """Search YouTube videos for karaoke tracks."""
    query_str = args["q"]
    if not args["non_karaoke"]:
        query_str += " karaoke"

    raw_results = get_search_results(query_str)
    results = []
    for item in raw_results:
        if len(item) >= 3:
            results.append({
                "title": item[0],
                "url": item[1],
                "id": item[2]
            })
    return jsonify(results)
