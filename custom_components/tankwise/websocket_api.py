"""WebSocket API for the Tankwise configuration panel."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
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
    CONF_OFF_HOLD_SECONDS,
    CONF_OFF_THRESHOLD,
    CONF_ON_HOLD_SECONDS,
    CONF_ON_THRESHOLD,
    CONF_PUMP_ENTITY,
    CONF_RECONCILE_INTERVAL,
    CONF_RECONCILE_RETRIES,
    CONF_REST_MINUTES,
    CONF_TOGGLE_ENTITIES,
    CONF_WORK_MINUTES,
    DOMAIN,
)
from .helpers import merge_entry_config

_LOGGER = logging.getLogger(__name__)

DATA_KEYS = {
    CONF_PUMP_ENTITY,
    CONF_DISTANCE_ENTITY,
}

_UPDATE_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_PUMP_ENTITY): cv.entity_id,
        vol.Optional(CONF_DISTANCE_ENTITY): cv.entity_id,
        vol.Optional(CONF_FULL_DISTANCE): vol.Coerce(float),
        vol.Optional(CONF_EMPTY_DISTANCE): vol.Coerce(float),
        vol.Optional(CONF_EXPOSE_PERCENTAGE): cv.boolean,
        vol.Optional(CONF_ON_THRESHOLD): vol.Coerce(float),
        vol.Optional(CONF_OFF_THRESHOLD): vol.Coerce(float),
        vol.Optional(CONF_ON_HOLD_SECONDS): vol.Coerce(int),
        vol.Optional(CONF_OFF_HOLD_SECONDS): vol.Coerce(int),
        vol.Optional(CONF_RECONCILE_INTERVAL): vol.Coerce(int),
        vol.Optional(CONF_RECONCILE_RETRIES): vol.Coerce(int),
        vol.Optional(CONF_WORK_MINUTES): vol.Coerce(float),
        vol.Optional(CONF_REST_MINUTES): vol.Coerce(float),
        vol.Optional(CONF_FAILSAFE_MARGIN_MINUTES): vol.Coerce(float),
        vol.Optional(CONF_TOGGLE_ENTITIES): vol.All(cv.ensure_list, [cv.entity_id]),
        vol.Optional(CONF_LED_ENTITIES): vol.All(cv.ensure_list, [cv.entity_id]),
        vol.Optional(CONF_NOTIFY_SERVICE): cv.string,
        vol.Optional(CONF_LOW_LEVEL_PERCENT): vol.Coerce(float),
        vol.Optional(CONF_CRITICAL_LEVEL_PERCENT): vol.Coerce(float),
        vol.Optional(CONF_LEVEL_NOTIFY_HOLD_SECONDS): vol.Coerce(int),
    },
    extra=vol.PREVENT_EXTRA,
)


def _entries(hass: HomeAssistant) -> list[ConfigEntry]:
    return list(hass.config_entries.async_entries(DOMAIN))


def _resolve_entry(hass: HomeAssistant, entry_id: str | None) -> ConfigEntry | None:
    entries = _entries(hass)
    if entry_id:
        for entry in entries:
            if entry.entry_id == entry_id:
                return entry
        return None
    if len(entries) == 1:
        return entries[0]
    return None


def _entry_payload(hass: HomeAssistant, entry: ConfigEntry) -> dict[str, Any]:
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
            }
        )
    return {
        "entry_id": entry.entry_id,
        "title": entry.title,
        "config": config,
        "status": status,
    }


def _sanitize_updates(raw: dict[str, Any]) -> dict[str, Any]:
    """Drop nulls so optional clears do not fail entity_id validators."""
    cleaned: dict[str, Any] = {}
    for key, value in raw.items():
        if value is None:
            continue
        if key in (CONF_TOGGLE_ENTITIES, CONF_LED_ENTITIES) and value == "":
            cleaned[key] = []
            continue
        cleaned[key] = value
    return cleaned


@callback
def async_register_websockets(hass: HomeAssistant) -> None:
    """Register Tankwise websocket commands."""
    websocket_api.async_register_command(hass, websocket_list)
    websocket_api.async_register_command(hass, websocket_get_config)
    websocket_api.async_register_command(hass, websocket_update_config)
    websocket_api.async_register_command(hass, websocket_set_enabled)
    websocket_api.async_register_command(hass, websocket_set_demand)
    websocket_api.async_register_command(hass, websocket_reconcile)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list"})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_list(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    connection.send_result(
        msg["id"],
        {"entries": [_entry_payload(hass, entry) for entry in _entries(hass)]},
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/get_config",
        vol.Optional("entry_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_get_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    entry = _resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    connection.send_result(msg["id"], _entry_payload(hass, entry))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_config",
        vol.Optional("entry_id"): str,
        vol.Required("config"): dict,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_update_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    entry = _resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return

    try:
        updates = _UPDATE_SCHEMA(_sanitize_updates(msg["config"]))
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid_config", str(err))
        return

    current = merge_entry_config(dict(entry.data), dict(entry.options))
    merged = {**current, **updates}

    if float(merged[CONF_EMPTY_DISTANCE]) <= float(merged[CONF_FULL_DISTANCE]):
        connection.send_error(
            msg["id"],
            "invalid_config",
            "Empty distance must be greater than full distance",
        )
        return
    if float(merged[CONF_OFF_THRESHOLD]) <= float(merged[CONF_ON_THRESHOLD]):
        connection.send_error(
            msg["id"],
            "invalid_config",
            "Off threshold must be greater than on threshold",
        )
        return

    new_data = dict(entry.data)
    new_options = dict(entry.options)
    for key, value in updates.items():
        if key in DATA_KEYS:
            new_data[key] = value
        else:
            new_options[key] = value

    hass.config_entries.async_update_entry(entry, data=new_data, options=new_options)
    await hass.config_entries.async_reload(entry.entry_id)
    _LOGGER.info("Tankwise config updated from panel (%s)", entry.entry_id)
    entry = hass.config_entries.async_get_entry(entry.entry_id) or entry
    connection.send_result(msg["id"], _entry_payload(hass, entry))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_enabled",
        vol.Optional("entry_id"): str,
        vol.Required("enabled"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_set_enabled(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    entry = _resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    data = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if not data or "controller" not in data:
        connection.send_error(msg["id"], "not_ready", "Controller not ready")
        return
    await data["controller"].async_set_enabled(
        bool(msg["enabled"]), reason="panel_enable"
    )
    connection.send_result(msg["id"], _entry_payload(hass, entry))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_demand",
        vol.Optional("entry_id"): str,
        vol.Required("desired_on"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_set_demand(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    entry = _resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    data = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if not data or "controller" not in data:
        connection.send_error(msg["id"], "not_ready", "Controller not ready")
        return
    desired = bool(msg["desired_on"])
    await data["controller"].async_set_demand(
        desired, reason="panel_demand", force=not desired
    )
    connection.send_result(msg["id"], _entry_payload(hass, entry))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/reconcile",
        vol.Optional("entry_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_reconcile(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    entry = _resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    data = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if not data or "controller" not in data:
        connection.send_error(msg["id"], "not_ready", "Controller not ready")
        return
    await data["controller"].async_reconcile(reason="panel_reconcile")
    connection.send_result(msg["id"], _entry_payload(hass, entry))
