"""Switch platform for Tankwise — persisted desired demand."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import ATTR_REASON
from .entity import TankwiseEntity
from . import get_controller


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Tankwise demand switch."""
    controller = get_controller(hass, entry.entry_id)
    async_add_entities([TankwiseDemandSwitch(controller, entry.entry_id)])


class TankwiseDemandSwitch(TankwiseEntity, SwitchEntity):
    """Persisted desired pump demand (replacement for var.bomba)."""

    _attr_name = "Demand"
    _attr_translation_key = "demand"
    _attr_icon = "mdi:water-pump"

    def __init__(self, controller, entry_id: str) -> None:
        super().__init__(controller, entry_id)
        self._attr_unique_id = f"{entry_id}_demand"

    @property
    def is_on(self) -> bool:
        return self.controller.desired_on

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        snap = self.controller.snapshot()
        return {
            ATTR_REASON: snap.reason,
            "cycle_phase": snap.cycle_phase,
            "pump_allowed": snap.pump_allowed,
        }

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self.controller.async_set_demand(True, reason="ui_demand")

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self.controller.async_set_demand(False, reason="ui_demand", force=True)
