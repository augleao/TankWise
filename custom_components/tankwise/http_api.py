"""HTTP REST API for the Tankwise Supervisor add-on and other clients."""

from __future__ import annotations

import logging
from http import HTTPStatus
from typing import Any

import voluptuous as vol
from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant, callback

from . import api_common

_LOGGER = logging.getLogger(__name__)


class TankwiseEntriesView(HomeAssistantView):
    """List Tankwise config entries with live status."""

    url = "/api/tankwise/entries"
    name = "api:tankwise:entries"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        return self.json(
            {
                "entries": [
                    api_common.entry_payload(hass, entry)
                    for entry in api_common.list_entries(hass)
                ]
            }
        )


class TankwiseEntryView(HomeAssistantView):
    """Get one Tankwise entry."""

    url = "/api/tankwise/entries/{entry_id}"
    name = "api:tankwise:entry"
    requires_auth = True

    async def get(self, request: web.Request, entry_id: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        entry = api_common.resolve_entry(hass, entry_id)
        if entry is None:
            return self.json_message("Tankwise entry not found", HTTPStatus.NOT_FOUND)
        return self.json(api_common.entry_payload(hass, entry))


class TankwiseConfigView(HomeAssistantView):
    """Update Tankwise configuration."""

    url = "/api/tankwise/entries/{entry_id}/config"
    name = "api:tankwise:config"
    requires_auth = True

    async def post(self, request: web.Request, entry_id: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        entry = api_common.resolve_entry(hass, entry_id)
        if entry is None:
            return self.json_message("Tankwise entry not found", HTTPStatus.NOT_FOUND)
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            return self.json_message("Invalid JSON body", HTTPStatus.BAD_REQUEST)
        if not isinstance(body, dict):
            return self.json_message("Body must be an object", HTTPStatus.BAD_REQUEST)
        config = body.get("config", body)
        if not isinstance(config, dict):
            return self.json_message("config must be an object", HTTPStatus.BAD_REQUEST)
        try:
            entry = await api_common.apply_config_updates(hass, entry, config)
        except vol.Invalid as err:
            return self.json_message(str(err), HTTPStatus.BAD_REQUEST)
        return self.json(api_common.entry_payload(hass, entry))


class TankwiseEnabledView(HomeAssistantView):
    """Enable or disable the controller."""

    url = "/api/tankwise/entries/{entry_id}/enabled"
    name = "api:tankwise:enabled"
    requires_auth = True

    async def post(self, request: web.Request, entry_id: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        entry = api_common.resolve_entry(hass, entry_id)
        if entry is None:
            return self.json_message("Tankwise entry not found", HTTPStatus.NOT_FOUND)
        controller = api_common.get_controller(hass, entry)
        if controller is None:
            return self.json_message("Controller not ready", HTTPStatus.SERVICE_UNAVAILABLE)
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            return self.json_message("Invalid JSON body", HTTPStatus.BAD_REQUEST)
        enabled = bool(body.get("enabled"))
        await controller.async_set_enabled(enabled, reason="http_enable")
        return self.json(api_common.entry_payload(hass, entry))


class TankwiseDemandView(HomeAssistantView):
    """Set desired demand ON/OFF."""

    url = "/api/tankwise/entries/{entry_id}/demand"
    name = "api:tankwise:demand"
    requires_auth = True

    async def post(self, request: web.Request, entry_id: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        entry = api_common.resolve_entry(hass, entry_id)
        if entry is None:
            return self.json_message("Tankwise entry not found", HTTPStatus.NOT_FOUND)
        controller = api_common.get_controller(hass, entry)
        if controller is None:
            return self.json_message("Controller not ready", HTTPStatus.SERVICE_UNAVAILABLE)
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            return self.json_message("Invalid JSON body", HTTPStatus.BAD_REQUEST)
        desired = bool(body.get("desired_on"))
        await controller.async_set_demand(
            desired, reason="http_demand", force=not desired
        )
        return self.json(api_common.entry_payload(hass, entry))


class TankwiseReconcileView(HomeAssistantView):
    """Force an immediate reconcile."""

    url = "/api/tankwise/entries/{entry_id}/reconcile"
    name = "api:tankwise:reconcile"
    requires_auth = True

    async def post(self, request: web.Request, entry_id: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        entry = api_common.resolve_entry(hass, entry_id)
        if entry is None:
            return self.json_message("Tankwise entry not found", HTTPStatus.NOT_FOUND)
        controller = api_common.get_controller(hass, entry)
        if controller is None:
            return self.json_message("Controller not ready", HTTPStatus.SERVICE_UNAVAILABLE)
        await controller.async_reconcile(reason="http_reconcile")
        return self.json(api_common.entry_payload(hass, entry))


class TankwiseEntitiesView(HomeAssistantView):
    """List entities useful for Tankwise pickers."""

    url = "/api/tankwise/entities"
    name = "api:tankwise:entities"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        return self.json({"entities": api_common.list_picker_entities(hass)})




class TankwiseLogsView(HomeAssistantView):
    """Return recent controller event logs."""

    url = "/api/tankwise/entries/{entry_id}/logs"
    name = "api:tankwise:logs"
    requires_auth = True

    async def get(self, request: web.Request, entry_id: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        entry = api_common.resolve_entry(hass, entry_id)
        if entry is None:
            return self.json_message("Tankwise entry not found", HTTPStatus.NOT_FOUND)
        controller = api_common.get_controller(hass, entry)
        if controller is None:
            return self.json_message("Controller not ready", HTTPStatus.SERVICE_UNAVAILABLE)
        try:
            limit = int(request.query.get("limit", "50"))
        except ValueError:
            limit = 50
        return self.json(
            {
                "entry_id": entry.entry_id,
                "logs": controller.recent_logs(limit),
                "status": api_common.entry_payload(hass, entry)["status"],
            }
        )


@callback
def async_register_http(hass: HomeAssistant) -> None:
    """Register Tankwise HTTP views."""
    hass.http.register_view(TankwiseEntriesView)
    hass.http.register_view(TankwiseEntryView)
    hass.http.register_view(TankwiseConfigView)
    hass.http.register_view(TankwiseEnabledView)
    hass.http.register_view(TankwiseDemandView)
    hass.http.register_view(TankwiseReconcileView)
    hass.http.register_view(TankwiseEntitiesView)
    hass.http.register_view(TankwiseLogsView)
    _LOGGER.debug("Tankwise HTTP API registered")
