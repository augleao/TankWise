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


def normalize_notify_services(config: dict[str, Any]) -> list[str]:
    """Return notify service targets from list or legacy single string."""
    raw = config.get("notify_services")
    if raw is None:
        legacy = config.get("notify_service")
        if isinstance(legacy, str) and legacy.strip():
            return [legacy.strip()]
        return []
    if isinstance(raw, str):
        return [part.strip() for part in raw.split(",") if part.strip()]
    out: list[str] = []
    for item in raw:
        text = str(item).strip()
        if text:
            out.append(text)
    return out


def with_normalized_notify(config: dict[str, Any]) -> dict[str, Any]:
    """Ensure config exposes notify_services as a list for the UI/API."""
    normalized = dict(config)
    normalized["notify_services"] = normalize_notify_services(normalized)
    return normalized


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


def is_manual_control_reason(reason: str) -> bool:
    """Return True when the reconcile/demand reason comes from manual control.

    Manual UI, services and physical toggles bypass the automatic pump
    short-cycle cooldown. Automatic hysteresis/cycle/reconcile reasons do not.
    """
    text = (reason or "").strip()
    if text.startswith("demand:") or text.startswith("enabled:"):
        text = text.split(":", 1)[1]
    return (
        text.startswith("ui_")
        or text.startswith("physical_toggle")
        or text.startswith("service_")
        or text in ("manual", "reconcile_now")
    )


def downsample_points(
    points: list[dict[str, Any]],
    max_points: int = 240,
) -> list[dict[str, Any]]:
    """Thin a time series to at most max_points, keeping first/last."""
    if max_points < 2 or len(points) <= max_points:
        return list(points)
    if max_points == 2:
        return [points[0], points[-1]]
    out: list[dict[str, Any]] = [points[0]]
    last_index = len(points) - 1
    buckets = max_points - 2
    for bucket in range(buckets):
        # Pick the point nearest the bucket center (skip endpoints).
        start = 1 + int(bucket * last_index / (buckets + 1))
        end = 1 + int((bucket + 1) * last_index / (buckets + 1))
        if end <= start:
            end = start + 1
        mid = (start + end - 1) // 2
        mid = min(max(mid, 1), last_index - 1)
        candidate = points[mid]
        if candidate is not out[-1]:
            out.append(candidate)
    if points[-1] is not out[-1]:
        out.append(points[-1])
    return out


def call_history_compat(func: Any, *args: Any, **kwargs: Any) -> Any:
    """Call a recorder history helper, dropping kwargs unsupported by this HA version."""
    import inspect

    try:
        params = inspect.signature(func).parameters
    except (TypeError, ValueError):
        params = {}

    if params and any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()):
        filtered = kwargs
    elif params:
        filtered = {key: value for key, value in kwargs.items() if key in params}
    else:
        filtered = kwargs

    try:
        return func(*args, **filtered)
    except TypeError:
        # Last-resort: strip optional kwargs one by one.
        optional = [
            "significant_changes_only",
            "no_attributes",
            "include_start_time_state",
            "end_time",
        ]
        remaining = dict(filtered)
        for key in optional:
            if key not in remaining:
                continue
            remaining.pop(key, None)
            try:
                return func(*args, **remaining)
            except TypeError:
                continue
        raise
