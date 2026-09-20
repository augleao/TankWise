"""Level + pump history helpers backed by the Home Assistant recorder."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .const import (
    LEVEL_HISTORY_MAX_POINTS,
    LEVEL_HISTORY_RANGE_1D,
    LEVEL_HISTORY_RANGE_1H,
    LEVEL_HISTORY_RANGE_1M,
    LEVEL_HISTORY_RANGE_1W,
    LEVEL_HISTORY_RANGES,
)
from .helpers import call_history_compat, distance_to_percent, downsample_points
from .i18n import hass_lang, t as i18n_t

_LOGGER = logging.getLogger(__name__)

_RANGE_DELTAS: dict[str, timedelta] = {
    LEVEL_HISTORY_RANGE_1H: timedelta(hours=1),
    LEVEL_HISTORY_RANGE_1D: timedelta(days=1),
    LEVEL_HISTORY_RANGE_1W: timedelta(days=7),
    LEVEL_HISTORY_RANGE_1M: timedelta(days=30),
}

_PUMP_ON_STATES = frozenset({"on", "open", "true", "1"})


def normalize_history_range(raw: str | None) -> str:
    """Return a supported range key (default: 1 day)."""
    key = str(raw or LEVEL_HISTORY_RANGE_1D).strip().lower()
    if key in LEVEL_HISTORY_RANGES:
        return key
    return LEVEL_HISTORY_RANGE_1D


def _state_timestamp(state: Any, *, start):
    last_changed = getattr(state, "last_changed", None) or getattr(
        state, "last_updated", None
    )
    if last_changed is None:
        return None
    ts = dt_util.as_utc(last_changed)
    if ts < start:
        ts = start
    return ts


def _states_for_entity(raw: Any, entity_id: str) -> list[Any]:
    if isinstance(raw, dict):
        return list(raw.get(entity_id) or [])
    if isinstance(raw, list):
        return list(raw)
    return []


def _extend_to_end(points: list[dict[str, Any]], end_iso: str) -> None:
    if points and points[-1]["ts"] != end_iso:
        last = dict(points[-1])
        last["ts"] = end_iso
        points.append(last)


async def async_level_history(
    hass: HomeAssistant,
    *,
    entry_id: str,
    distance_entity: str,
    pump_entity: str,
    full_distance: float,
    empty_distance: float,
    range_key: str,
) -> dict[str, Any]:
    """Return downsampled level and pump points for the chart modal."""
    range_key = normalize_history_range(range_key)
    end = dt_util.utcnow()
    start = end - _RANGE_DELTAS[range_key]
    end_iso = end.isoformat()

    payload: dict[str, Any] = {
        "entry_id": entry_id,
        "range": range_key,
        "start": start.isoformat(),
        "end": end_iso,
        "entity_id": distance_entity,
        "pump_entity": pump_entity,
        "points": [],
        "pump_points": [],
        "available": False,
        "message": None,
    }

    try:
        from homeassistant.components.recorder import (
            get_instance,
            history as recorder_history,
        )
    except ImportError:
        payload["message"] = i18n_t(hass_lang(hass), "history_no_recorder")
        return payload

    try:
        instance = get_instance(hass)
    except Exception:  # noqa: BLE001
        payload["message"] = i18n_t(hass_lang(hass), "history_no_recorder_active")
        return payload

    entity_ids = [distance_entity, pump_entity]

    def _fetch_one(entity_id: str) -> dict[str, list]:
        # Prefer get_significant_states — widely available and accepts entity lists.
        if hasattr(recorder_history, "get_significant_states"):
            return call_history_compat(
                recorder_history.get_significant_states,
                hass,
                start_time=start,
                end_time=end,
                entity_ids=[entity_id],
                significant_changes_only=False,
                include_start_time_state=True,
                no_attributes=True,
            )
        return call_history_compat(
            recorder_history.state_changes_during_period,
            hass,
            start_time=start,
            end_time=end,
            entity_id=entity_id,
            include_start_time_state=True,
            no_attributes=True,
        )

    def _fetch() -> dict[str, list]:
        # Prefer querying both entities together; fall back to separate calls.
        try:
            if hasattr(recorder_history, "get_significant_states"):
                return call_history_compat(
                    recorder_history.get_significant_states,
                    hass,
                    start_time=start,
                    end_time=end,
                    entity_ids=entity_ids,
                    significant_changes_only=False,
                    include_start_time_state=True,
                    no_attributes=True,
                )
            if hasattr(recorder_history, "state_changes_during_period"):
                # Older API: entity_id is a single string — merge below on TypeError.
                return call_history_compat(
                    recorder_history.state_changes_during_period,
                    hass,
                    start_time=start,
                    end_time=end,
                    entity_id=entity_ids,
                    include_start_time_state=True,
                    no_attributes=True,
                )
            raise AttributeError("No recorder history query helpers available")
        except TypeError:
            merged: dict[str, list] = {}
            for entity_id in entity_ids:
                part = _fetch_one(entity_id)
                if isinstance(part, dict):
                    merged.update(part)
            return merged

    try:
        raw = await instance.async_add_executor_job(_fetch)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Tankwise level history query failed: %s", err)
        payload["message"] = i18n_t(hass_lang(hass), "history_query_failed", err=err)
        return payload

    points: list[dict[str, Any]] = []
    for state in _states_for_entity(raw, distance_entity):
        try:
            distance = float(state.state)
        except (TypeError, ValueError, AttributeError):
            continue
        ts = _state_timestamp(state, start=start)
        if ts is None:
            continue
        percent = distance_to_percent(distance, full_distance, empty_distance)
        if percent is None:
            continue
        points.append(
            {
                "ts": ts.isoformat(),
                "percent": round(percent, 1),
                "distance": round(distance, 3),
            }
        )

    pump_points: list[dict[str, Any]] = []
    for state in _states_for_entity(raw, pump_entity):
        raw_state = getattr(state, "state", None)
        if raw_state in (None, "unknown", "unavailable"):
            continue
        ts = _state_timestamp(state, start=start)
        if ts is None:
            continue
        on = str(raw_state).lower() in _PUMP_ON_STATES
        pump_points.append({"ts": ts.isoformat(), "on": on})

    points.sort(key=lambda row: row["ts"])
    pump_points.sort(key=lambda row: row["ts"])
    _extend_to_end(points, end_iso)
    _extend_to_end(pump_points, end_iso)

    points = downsample_points(points, LEVEL_HISTORY_MAX_POINTS)
    pump_points = downsample_points(pump_points, LEVEL_HISTORY_MAX_POINTS)

    payload["points"] = points
    payload["pump_points"] = pump_points
    payload["available"] = True

    if not points and not pump_points:
        payload["message"] = i18n_t(hass_lang(hass), "history_no_data")
    elif not points:
        payload["message"] = i18n_t(hass_lang(hass), "history_no_level")
    elif not pump_points:
        payload["message"] = i18n_t(hass_lang(hass), "history_no_pump")
    return payload
