"""Shared helpers for Tankwise."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant, State


def distance_to_percent(
    distance: float,
    full_distance: float,
    empty_distance: float,
) -> float | None:
    """Convert distance-to-water into a 0–100 tank fill percentage.

    Lower distance means a fuller tank. Returns None if calibration is invalid.
    """
    span = empty_distance - full_distance
    if span <= 0:
        return None
    raw = (empty_distance - distance) / span * 100.0
    return max(0.0, min(100.0, raw))


def percent_to_distance(
    percent: float,
    full_distance: float,
    empty_distance: float,
) -> float | None:
    """Convert fill % into distance-to-water.

    100% -> full_distance, 0% -> empty_distance.
    """
    span = empty_distance - full_distance
    if span <= 0:
        return None
    pct = max(0.0, min(100.0, percent))
    return empty_distance - (pct / 100.0) * span


def parse_float(state: State | None) -> float | None:
    """Parse a numeric entity state, or None if unavailable/unknown."""
    if state is None or state.state in (None, "unknown", "unavailable"):
        return None
    try:
        return float(state.state)
    except (TypeError, ValueError):
        return None


def is_on_state(state: State | None) -> bool | None:
    """Return True/False for on/off entities, None if unavailable."""
    if state is None or state.state in (None, "unknown", "unavailable"):
        return None
    return state.state in ("on", "open", "true", "1", 1, True)


def entity_exists(hass: HomeAssistant, entity_id: str) -> bool:
    """Return True if the entity_id is known to Home Assistant."""
    from homeassistant.helpers import entity_registry as er

    if hass.states.get(entity_id) is not None:
        return True
    registry = er.async_get(hass)
    return registry.async_get(entity_id) is not None


def merge_entry_config(data: dict[str, Any], options: dict[str, Any]) -> dict[str, Any]:
    """Merge config entry data and options (options win)."""
    merged = dict(data)
    merged.update(options)
    return merged


def is_on_condition(
    *,
    mode: str,
    distance: float,
    percent: float | None,
    on_threshold: float,
) -> bool:
    """Return True when the tank is empty enough to request demand ON."""
    if mode == "percent":
        if percent is None:
            return False
        return percent <= on_threshold
    return distance > on_threshold


def is_off_condition(
    *,
    mode: str,
    distance: float,
    percent: float | None,
    off_threshold: float,
) -> bool:
    """Return True when the tank is full enough to force demand OFF."""
    if mode == "percent":
        if percent is None:
            return False
        return percent >= off_threshold
    return distance < off_threshold
