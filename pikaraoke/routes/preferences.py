"""User preferences management routes."""

import flask_babel
from flask import flash, jsonify, redirect, url_for
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import broadcast_event, get_karaoke_instance, is_admin
from pikaraoke.lib.preference_manager import PreferenceManager

_ = flask_babel.gettext

def _default_score_phrases() -> dict[str, list[str]]:
    """Translated built-in phrases, used when the user has not set custom ones."""
    return {
        "low": [
            _("Never sing again... ever."),
            _("That was a really good impression of a dying cat!"),
            _("Thank God it's over."),
            _("Pass the mic, please!"),
            _("Well, I'm sure you're very good at your day job."),
        ],
        "mid": [
            _("I've seen better."),
            _("Ok... just ok."),
            _("Not bad for an amateur."),
            _("You put on a decent show."),
            _("That was... something."),
        ],
        "high": [
            _("Congratulations! That was unbelievable!"),
            _("Wow, have you tried auditioning for The Voice?"),
            _("Please, sing another one!"),
            _("You rock! You know that?!"),
            _("Woah, who let Freddie Mercury in here?"),
        ],
    }

def _parse_stored_phrases(stored: str) -> list[str]:
    """Split a stored phrase string on '|' (preferred) or '\\n' (legacy)."""
    sep = "|" if "|" in stored else "\n"
    return [p.strip() for p in stored.split(sep) if p.strip()]

def _get_active_score_phrases(k) -> dict[str, list[str]]:
    """Custom phrases if configured; translated built-in defaults otherwise."""
    defaults = _default_score_phrases()
    result = {}
    for tier in ("low", "mid", "high"):
        stored = getattr(k, f"{tier}_score_phrases")
        result[tier] = (_parse_stored_phrases(stored) if stored else []) or defaults[tier]
    return result

_SCORE_PHRASE_KEYS = {"low_score_phrases", "mid_score_phrases", "high_score_phrases"}

preferences_bp = Blueprint("preferences", __name__)


class ChangePreferenceQuery(Schema):
    pref = fields.String(
        required=True, metadata={"description": "Name of the preference to change"}
    )
    val = fields.String(required=True, metadata={"description": "New value for the preference"})


@preferences_bp.route("/change_preferences", methods=["GET"])
@preferences_bp.arguments(ChangePreferenceQuery, location="query")
def change_preferences(query):
    """Change a user preference setting."""
    k = get_karaoke_instance()
    if is_admin():
        preference = query["pref"]
        val = query["val"]
        success, message = k.preferences.set(preference, val)
        if success:
            broadcast_event("preferences_update", {"key": preference, "value": val})
            if preference in _SCORE_PHRASE_KEYS:
                broadcast_event("score_phrases_update", _get_active_score_phrases(k))
        return jsonify([success, message])
    else:
        # MSG: Message shown after trying to change preferences without admin permissions.
        flash(_("You don't have permission to change preferences"), "is-danger")
    return redirect(url_for("info.info"))


@preferences_bp.route("/clear_preferences", methods=["GET"])
def clear_preferences():
    """Reset all preferences to defaults."""
    k = get_karaoke_instance()
    if is_admin():
        success, message = k.preferences.reset_all()
        if success:
            k.update_now_playing_socket()
            broadcast_event("preferences_reset", PreferenceManager.DEFAULTS)
            broadcast_event("score_phrases_update", _get_active_score_phrases(k))
        flash(message, "is-success" if success else "is-danger")
    else:
        # MSG: Message shown after trying to clear preferences without admin permissions.
        flash(_("You don't have permission to clear preferences"), "is-danger")
    return redirect(url_for("info.info"))
