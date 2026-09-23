"""Shared Tankwise API helpers for websocket and HTTP views."""

from __future__ import annotations

import json
from pathlib import Path

import logging
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_CRITICAL_LEVEL_PERCENT,
    CONF_DISTANCE_ENTITY,
    CONF_EMPTY_DISTANCE,
    CONF_EXPOSE_PERCENTAGE,
    CONF_FAILSAFE_MARGIN_MINUTES,
    CONF_FULL_DISTANCE,
    CONF_LED_ENTITIES,
    CONF_LEVEL_NOTIFY_HOLD_SECONDS,
    CONF_LOW_LEVEL_PERCENT,
    CONF_NOTIFY_SERVICE,
    CONF_NOTIFY_SERVICES,
    CONF_OFF_HOLD_SECONDS,
    CONF_OFF_THRESHOLD,
    CONF_ON_HOLD_SECONDS,
    CONF_ON_THRESHOLD,
    CONF_THRESHOLD_MODE,
    DEFAULT_THRESHOLD_MODE,
    THRESHOLD_MODE_DISTANCE,
    THRESHOLD_MODE_PERCENT,
    CONF_PUMP_ENTITY,
    CONF_RECONCILE_INTERVAL,
    CONF_RECONCILE_RETRIES,
    CONF_RECONCILE_ENABLED,
    CONF_REST_MINUTES,
    CONF_TOGGLE_ENTITIES,
    CONF_WORK_MINUTES,
    DOMAIN,
)
from .helpers import merge_entry_config, with_normalized_notify

_LOGGER = logging.getLogger(__name__)



def integration_version() -> str:
    try:
        manifest = json.loads(
            (Path(__file__).with_name("manifest.json")).read_text(encoding="utf-8")
        )
        return str(manifest.get("version", "?"))
    except Exception:  # noqa: BLE001
        return "?"


DATA_KEYS = {
    CONF_PUMP_ENTITY,
    CONF_DISTANCE_ENTITY,
}

UPDATE_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_PUMP_ENTITY): cv.entity_id,
        vol.Optional(CONF_DISTANCE_ENTITY): cv.entity_id,
        vol.Optional(CONF_FULL_DISTANCE): vol.Coerce(float),
        vol.Optional(CONF_EMPTY_DISTANCE): vol.Coerce(float),
        vol.Optional(CONF_EXPOSE_PERCENTAGE): cv.boolean,
        vol.Optional(CONF_THRESHOLD_MODE): vol.In([THRESHOLD_MODE_DISTANCE, THRESHOLD_MODE_PERCENT]),
        vol.Optional(CONF_ON_THRESHOLD): vol.Coerce(float),
        vol.Optional(CONF_OFF_THRESHOLD): vol.Coerce(float),
        vol.Optional(CONF_ON_HOLD_SECONDS): vol.Coerce(int),
        vol.Optional(CONF_OFF_HOLD_SECONDS): vol.Coerce(int),
        vol.Optional(CONF_RECONCILE_INTERVAL): vol.Coerce(int),
        vol.Optional(CONF_RECONCILE_RETRIES): vol.Coerce(int),
        vol.Optional(CONF_RECONCILE_ENABLED): cv.boolean,
        vol.Optional(CONF_WORK_MINUTES): vol.Coerce(float),
        vol.Optional(CONF_REST_MINUTES): vol.Coerce(float),
        vol.Optional(CONF_FAILSAFE_MARGIN_MINUTES): vol.Coerce(float),
        vol.Optional(CONF_TOGGLE_ENTITIES): vol.All(cv.ensure_list, [cv.entity_id]),
        vol.Optional(CONF_LED_ENTITIES): vol.All(cv.ensure_list, [cv.entity_id]),
        vol.Optional(CONF_NOTIFY_SERVICES): vol.All(cv.ensure_list, [cv.string]),
        vol.Optional(CONF_NOTIFY_SERVICE): cv.string,  # legacy
        vol.Optional(CONF_LOW_LEVEL_PERCENT): vol.Coerce(float),
        vol.Optional(CONF_CRITICAL_LEVEL_PERCENT): vol.Coerce(float),
        vol.Optional(CONF_LEVEL_NOTIFY_HOLD_SECONDS): vol.Coerce(int),
    },
    extra=vol.PREVENT_EXTRA,
)

ENTITY_DOMAINS = (
    "switch",
    "sensor",
    "binary_sensor",
    "light",
    "input_boolean",
    "input_number",
    "number",
)


def list_entries(hass: HomeAssistant) -> list[ConfigEntry]:
    return list(hass.config_entries.async_entries(DOMAIN))


def resolve_entry(hass: HomeAssistant, entry_id: str | None) -> ConfigEntry | None:
    entries = list_entries(hass)
    if entry_id:
        for entry in entries:
            if entry.entry_id == entry_id:
                return entry
        return None
    if len(entries) == 1:
        return entries[0]
    return None


def entry_payload(hass: HomeAssistant, entry: ConfigEntry) -> dict[str, Any]:
    config = merge_entry_config(dict(entry.data), dict(entry.options))
    status: dict[str, Any] = {
        "enabled": True,
        "desired_on": False,
        "pump_on": None,
        "distance": None,
        "percent": None,
        "cycle_phase": "idle",
        "pump_allowed": False,
        "reconcile_healthy": True,
        "last_error": None,
        "reason": "init",
    }
    data = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    controller = data.get("controller") if isinstance(data, dict) else None
    if controller is not None:
        snap = controller.snapshot()
        status.update(
            {
                "enabled": snap.enabled,
                "desired_on": snap.desired_on,
                "pump_on": snap.pump_on,
                "distance": snap.distance,
                "percent": snap.percent,
                "cycle_phase": snap.cycle_phase,
                "pump_allowed": snap.pump_allowed,
                "reconcile_healthy": snap.reconcile_healthy,
                "last_error": snap.last_error,
                "reason": snap.reason,
                **{
                    k: snap.attributes.get(k)
                    for k in (
                        "threshold_mode",
                        "on_threshold",
                        "off_threshold",
                        "on_hold_seconds",
                        "off_hold_seconds",
                        "on_hold_elapsed",
                        "off_hold_elapsed",
                    )
                    if snap.attributes
                },
            }
        )
    return {
        "entry_id": entry.entry_id,
        "title": entry.title,
        "version": integration_version(),
        "config": with_normalized_notify(config),
        "status": status,
    }


def sanitize_updates(raw: dict[str, Any]) -> dict[str, Any]:
    """Drop nulls so optional clears do not fail entity_id validators."""
    cleaned: dict[str, Any] = {}
    for key, value in raw.items():
        if value is None:
            continue
        if key in (CONF_TOGGLE_ENTITIES, CONF_LED_ENTITIES, CONF_NOTIFY_SERVICES) and value == "":
            cleaned[key] = []
            continue
        cleaned[key] = value

    # Prefer list form; migrate legacy single notify_service when needed.
    if CONF_NOTIFY_SERVICES in cleaned:
        services = cleaned[CONF_NOTIFY_SERVICES]
        if isinstance(services, str):
            services = [part.strip() for part in services.split(",") if part.strip()]
        else:
            services = [str(item).strip() for item in services if str(item).strip()]
        cleaned[CONF_NOTIFY_SERVICES] = services
        cleaned[CONF_NOTIFY_SERVICE] = ""
    elif CONF_NOTIFY_SERVICE in cleaned:
        legacy = cleaned.pop(CONF_NOTIFY_SERVICE)
        if isinstance(legacy, str) and legacy.strip():
            cleaned[CONF_NOTIFY_SERVICES] = [legacy.strip()]
        else:
            cleaned[CONF_NOTIFY_SERVICES] = []
        cleaned[CONF_NOTIFY_SERVICE] = ""
    return cleaned


def list_notify_targets(hass: HomeAssistant) -> list[dict[str, str]]:
    """List notify.* services and notify entities for the picker modal."""
    items: dict[str, dict[str, str]] = {}
    notify_services = hass.services.async_services().get("notify") or {}
    for name in sorted(notify_services):
        service_id = f"notify.{name}"
        items[service_id] = {"id": service_id, "name": service_id}
    for entity_id in sorted(hass.states.async_entity_ids("notify")):
        state = hass.states.get(entity_id)
        label = (
            (state.attributes.get("friendly_name") if state else None) or entity_id
        )
        items[entity_id] = {"id": entity_id, "name": f"{label} ({entity_id})"}
    return list(items.values())


def list_picker_entities(hass: HomeAssistant) -> dict[str, list[dict[str, Any]]]:
    buckets: dict[str, list[dict[str, Any]]] = {d: [] for d in ENTITY_DOMAINS}
    for entity_id in sorted(hass.states.async_entity_ids()):
        domain = entity_id.split(".", 1)[0]
        if domain not in buckets:
            continue
        state = hass.states.get(entity_id)
        name = (
            (state.attributes.get("friendly_name") if state else None) or entity_id
        )
        unit = ""
        raw_state = ""
        if state is not None:
            raw_state = str(state.state)
            unit = str(state.attributes.get("unit_of_measurement") or "")
        buckets[domain].append(
            {
                "id": entity_id,
                "name": f"{name} ({entity_id})",
                "state": raw_state,
                "unit": unit,
            }
        )
    buckets["notify"] = list_notify_targets(hass)
    return buckets


async def apply_config_updates(
    hass: HomeAssistant,
    entry: ConfigEntry,
    raw_config: dict[str, Any],
) -> ConfigEntry:
    """Validate and apply config updates; reloads the entry."""
    updates = UPDATE_SCHEMA(sanitize_updates(raw_config))
    current = merge_entry_config(dict(entry.data), dict(entry.options))
    merged = {**current, **updates}

    if float(merged[CONF_EMPTY_DISTANCE]) <= float(merged[CONF_FULL_DISTANCE]):
        raise vol.Invalid("Empty distance must be greater than full distance")
    mode = str(merged.get(CONF_THRESHOLD_MODE, DEFAULT_THRESHOLD_MODE) or DEFAULT_THRESHOLD_MODE)
    on_th = float(merged[CONF_ON_THRESHOLD])
    off_th = float(merged[CONF_OFF_THRESHOLD])
    if mode == THRESHOLD_MODE_PERCENT:
        if not (0 <= on_th <= 100 and 0 <= off_th <= 100):
            raise vol.Invalid("Percent thresholds must be between 0 and 100")
        if on_th >= off_th:
            raise vol.Invalid(
                "In percent mode, on threshold must be less than off "
                "(e.g. turn on at 30%, turn off at 95%)"
            )
    else:
        if on_th <= off_th:
            raise vol.Invalid(
                "In distance mode, on threshold must be greater than off "
                "(ligar > desligar: higher distance = emptier)"
            )

    new_data = dict(entry.data)
    new_options = dict(entry.options)
    for key, value in updates.items():
        if key in DATA_KEYS:
            new_data[key] = value
        else:
            new_options[key] = value

    hass.config_entries.async_update_entry(entry, data=new_data, options=new_options)
    await hass.config_entries.async_reload(entry.entry_id)
    _LOGGER.info("Tankwise config updated (%s)", entry.entry_id)
    return hass.config_entries.async_get_entry(entry.entry_id) or entry


def get_controller(hass: HomeAssistant, entry: ConfigEntry):
    data = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if not data or "controller" not in data:
        return None
    return data["controller"]
