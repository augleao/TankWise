"""The Tankwise Home Assistant integration."""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
import voluptuous as vol

from .const import (
    DOMAIN,
    SERVICE_DISABLE_CONTROLLER,
    SERVICE_ENABLE_CONTROLLER,
    SERVICE_RECONCILE_NOW,
    SERVICE_TOGGLE_DEMAND,
    SERVICE_TURN_OFF_DEMAND,
    SERVICE_TURN_ON_DEMAND,
)
from .controller import TankwiseController
from .helpers import merge_entry_config

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [
    Platform.SWITCH,
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Tankwise domain (services registered once)."""
    hass.data.setdefault(DOMAIN, {})

    async def _resolve_controller(call: ServiceCall) -> TankwiseController | None:
        entry_id = call.data.get("entry_id")
        controllers: dict[str, TankwiseController] = {
            eid: data["controller"]
            for eid, data in hass.data[DOMAIN].items()
            if isinstance(data, dict) and "controller" in data
        }
        if entry_id:
            return controllers.get(entry_id)
        if len(controllers) == 1:
            return next(iter(controllers.values()))
        _LOGGER.error(
            "Multiple Tankwise entries configured; pass entry_id to the service"
        )
        return None

    async def handle_turn_on(call: ServiceCall) -> None:
        controller = await _resolve_controller(call)
        if controller:
            await controller.async_set_demand(True, reason="service_turn_on")

    async def handle_turn_off(call: ServiceCall) -> None:
        controller = await _resolve_controller(call)
        if controller:
            await controller.async_set_demand(False, reason="service_turn_off", force=True)

    async def handle_toggle(call: ServiceCall) -> None:
        controller = await _resolve_controller(call)
        if controller:
            await controller.async_toggle_demand(reason="service_toggle")

    async def handle_reconcile(call: ServiceCall) -> None:
        controller = await _resolve_controller(call)
        if controller:
            await controller.async_reconcile(reason="service_reconcile")

    async def handle_enable(call: ServiceCall) -> None:
        controller = await _resolve_controller(call)
        if controller:
            await controller.async_set_enabled(True, reason="service_enable")

    async def handle_disable(call: ServiceCall) -> None:
        controller = await _resolve_controller(call)
        if controller:
            await controller.async_set_enabled(False, reason="service_disable")

    service_schema = vol.Schema({vol.Optional("entry_id"): cv.string})
    hass.services.async_register(
        DOMAIN, SERVICE_TURN_ON_DEMAND, handle_turn_on, schema=service_schema
    )
    hass.services.async_register(
        DOMAIN, SERVICE_TURN_OFF_DEMAND, handle_turn_off, schema=service_schema
    )
    hass.services.async_register(
        DOMAIN, SERVICE_TOGGLE_DEMAND, handle_toggle, schema=service_schema
    )
    hass.services.async_register(
        DOMAIN, SERVICE_RECONCILE_NOW, handle_reconcile, schema=service_schema
    )
    hass.services.async_register(
        DOMAIN, SERVICE_ENABLE_CONTROLLER, handle_enable, schema=service_schema
    )
    hass.services.async_register(
        DOMAIN, SERVICE_DISABLE_CONTROLLER, handle_disable, schema=service_schema
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Tankwise from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    config = merge_entry_config(dict(entry.data), dict(entry.options))
    controller = TankwiseController(hass, entry.entry_id, config)
    await controller.async_setup()

    hass.data[DOMAIN][entry.entry_id] = {"controller": controller}

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        data = hass.data[DOMAIN].pop(entry.entry_id, None)
        if data and "controller" in data:
            await data["controller"].async_unload()
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Handle options updates by reloading the entry."""
    await hass.config_entries.async_reload(entry.entry_id)


@callback
def get_controller(hass: HomeAssistant, entry_id: str) -> TankwiseController:
    """Return the controller for an entry."""
    return hass.data[DOMAIN][entry_id]["controller"]
