"""Binary sensor platform for Tankwise."""

from __future__ import annotations

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .entity import TankwiseEntity
from . import get_controller


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Tankwise binary sensors."""
    controller = get_controller(hass, entry.entry_id)
    async_add_entities(
        [
            TankwisePumpRunningBinarySensor(controller, entry.entry_id),
            TankwiseReconcileFaultBinarySensor(controller, entry.entry_id),
        ]
    )


class TankwisePumpRunningBinarySensor(TankwiseEntity, BinarySensorEntity):
    """Mirrors whether the physical pump switch is currently ON."""

    _attr_name = "Pump running"
    _attr_translation_key = "pump_running"
    _attr_device_class = BinarySensorDeviceClass.RUNNING
    _attr_icon = "mdi:pump"

    def __init__(self, controller, entry_id: str) -> None:
        super().__init__(controller, entry_id)
        self._attr_unique_id = f"{entry_id}_pump_running"

    @property
    def is_on(self) -> bool | None:
        return self.controller.snapshot().pump_on


class TankwiseReconcileFaultBinarySensor(TankwiseEntity, BinarySensorEntity):
    """Problem sensor: ON when reconcile failed or pump unavailable."""

    _attr_name = "Reconcile fault"
    _attr_translation_key = "reconcile_fault"
    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_icon = "mdi:heart-pulse"

    def __init__(self, controller, entry_id: str) -> None:
        super().__init__(controller, entry_id)
        self._attr_unique_id = f"{entry_id}_reconcile_fault"

    @property
    def is_on(self) -> bool:
        # PROBLEM device class: on = problem present
        return not self.controller.reconcile_healthy

    @property
    def extra_state_attributes(self) -> dict:
        return {"last_error": self.controller.last_error}
