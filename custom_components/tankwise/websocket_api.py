"""WebSocket API for the Tankwise configuration panel."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from . import api_common
from . import level_history
from .const import DOMAIN, LEVEL_HISTORY_RANGES


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
        {
            "entries": [
                api_common.entry_payload(hass, entry)
                for entry in api_common.list_entries(hass)
            ]
        },
    )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/card_entries"})
@websocket_api.async_response
async def websocket_card_entries(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Lightweight installation list for Lovelace cards (no config secrets)."""
    connection.send_result(
        msg["id"],
        {
            "entries": [
                {"entry_id": entry.entry_id, "title": entry.title}
                for entry in api_common.list_entries(hass)
            ]
        },
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
    entry = api_common.resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    connection.send_result(msg["id"], api_common.entry_payload(hass, entry))


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
    entry = api_common.resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return

    try:
        entry = await api_common.apply_config_updates(hass, entry, msg["config"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid_config", str(err))
        return

    connection.send_result(msg["id"], api_common.entry_payload(hass, entry))


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
    entry = api_common.resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    controller = api_common.get_controller(hass, entry)
    if controller is None:
        connection.send_error(msg["id"], "not_ready", "Controller not ready")
        return
    await controller.async_set_enabled(bool(msg["enabled"]), reason="panel_enable")
    connection.send_result(msg["id"], api_common.entry_payload(hass, entry))


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
    entry = api_common.resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    controller = api_common.get_controller(hass, entry)
    if controller is None:
        connection.send_error(msg["id"], "not_ready", "Controller not ready")
        return
    desired = bool(msg["desired_on"])
    await controller.async_set_demand(
        desired, reason="panel_demand", force=not desired
    )
    connection.send_result(msg["id"], api_common.entry_payload(hass, entry))


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
    entry = api_common.resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    controller = api_common.get_controller(hass, entry)
    if controller is None:
        connection.send_error(msg["id"], "not_ready", "Controller not ready")
        return
    await controller.async_reconcile(reason="panel_reconcile")
    connection.send_result(msg["id"], api_common.entry_payload(hass, entry))




@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/logs",
        vol.Optional("entry_id"): str,
        vol.Optional("limit"): int,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_logs(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    entry = api_common.resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    controller = api_common.get_controller(hass, entry)
    if controller is None:
        connection.send_error(msg["id"], "not_ready", "Controller not ready")
        return
    limit = int(msg.get("limit") or 50)
    connection.send_result(
        msg["id"],
        {
            "entry_id": entry.entry_id,
            "logs": controller.recent_logs(limit),
            "status": api_common.entry_payload(hass, entry)["status"],
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/level_history",
        vol.Optional("entry_id"): str,
        vol.Optional("range"): vol.In(list(LEVEL_HISTORY_RANGES)),
    }
)
@websocket_api.async_response
async def websocket_level_history(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    entry = api_common.resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    controller = api_common.get_controller(hass, entry)
    if controller is None:
        connection.send_error(msg["id"], "not_ready", "Controller not ready")
        return
    payload = await level_history.async_level_history(
        hass,
        entry_id=entry.entry_id,
        distance_entity=controller.distance_entity,
        pump_entity=controller.pump_entity,
        full_distance=controller.full_distance,
        empty_distance=controller.empty_distance,
        range_key=msg.get("range") or "1d",
    )
    connection.send_result(msg["id"], payload)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/test_notify",
        vol.Optional("entry_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_test_notify(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    entry = api_common.resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Tankwise entry not found")
        return
    controller = api_common.get_controller(hass, entry)
    if controller is None:
        connection.send_error(msg["id"], "not_ready", "Controller not ready")
        return
    result = await controller.async_test_notify()
    if not result.get("ok"):
        connection.send_error(
            msg["id"],
            "no_notify",
            str(result.get("message") or "Nenhum serviço notify configurado."),
        )
        return
    connection.send_result(msg["id"], result)


def async_register_websockets(hass: HomeAssistant) -> None:
    """Register Tankwise websocket commands."""
    websocket_api.async_register_command(hass, websocket_list)
    websocket_api.async_register_command(hass, websocket_card_entries)
    websocket_api.async_register_command(hass, websocket_get_config)
    websocket_api.async_register_command(hass, websocket_update_config)
    websocket_api.async_register_command(hass, websocket_set_enabled)
    websocket_api.async_register_command(hass, websocket_set_demand)
    websocket_api.async_register_command(hass, websocket_reconcile)
    websocket_api.async_register_command(hass, websocket_logs)
    websocket_api.async_register_command(hass, websocket_level_history)
    websocket_api.async_register_command(hass, websocket_test_notify)
