"""Search endpoints for the /api mirror."""

from flask import jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_karaoke_instance
from pikaraoke.lib.youtube_dl import get_search_results, get_stream_url

api_search_bp = Blueprint("api_search", __name__, url_prefix="/api")


class SearchQuerySchema(Schema):
    q = fields.String(required=True)
    non_karaoke = fields.Boolean(load_default=False)


class AutocompleteQuery(Schema):
    q = fields.String(required=True)


class PreviewQuery(Schema):
    url = fields.String(required=True)


@api_search_bp.route("/search", methods=["GET"])
@api_search_bp.arguments(SearchQuerySchema, location="query")
def api_search(args):
    """Search YouTube for karaoke videos."""
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


@api_search_bp.route("/search/autocomplete", methods=["GET"])
@api_search_bp.arguments(AutocompleteQuery, location="query")
def autocomplete(query):
    """Match local library songs for typeahead."""
    k = get_karaoke_instance()
    q = query["q"].lower()
    result = [
        {
            "path": song,
            "fileName": k.song_manager.display_name_from_path(song),
            "type": "autocomplete",
        }
        for song in k.song_manager.songs
        if q in song.lower()
    ]
    return jsonify(result)


@api_search_bp.route("/search/preview", methods=["GET"])
@api_search_bp.arguments(PreviewQuery, location="query")
def preview(query):
    """Resolve a direct stream URL for previewing a YouTube video."""
    stream_url = get_stream_url(query["url"])
    if stream_url is None:
        return jsonify({"error": "Could not fetch stream URL"}), 500
    return jsonify({"stream_url": stream_url})
