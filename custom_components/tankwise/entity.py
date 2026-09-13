"""Shared entity base for Tankwise."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import DOMAIN, MANUFACTURER, MODEL
from .controller import TankwiseController


class TankwiseEntity(Entity):
    """Base entity bound to a Tankwise controller."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, controller: TankwiseController, entry_id: str) -> None:
        self.controller = controller
        self._entry_id = entry_id
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry_id)},
            name="Tankwise",
            manufacturer=MANUFACTURER,
            model=MODEL,
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.controller.async_add_listener(self._handle_update))

    def _handle_update(self) -> None:
        self.async_write_ha_state()
