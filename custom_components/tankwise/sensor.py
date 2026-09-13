"""Sensor platform for Tankwise."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import PERCENTAGE, UnitOfLength
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_EXPOSE_PERCENTAGE, DEFAULT_EXPOSE_PERCENTAGE
from .entity import TankwiseEntity
from .helpers import merge_entry_config
from . import get_controller


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Tankwise sensors."""
    controller = get_controller(hass, entry.entry_id)
    config = merge_entry_config(dict(entry.data), dict(entry.options))
    entities: list[SensorEntity] = [
        TankwiseDistanceSensor(controller, entry.entry_id),
        TankwiseCyclePhaseSensor(controller, entry.entry_id),
    ]
    if config.get(CONF_EXPOSE_PERCENTAGE, DEFAULT_EXPOSE_PERCENTAGE):
        entities.insert(0, TankwiseLevelSensor(controller, entry.entry_id))
    async_add_entities(entities)


class TankwiseLevelSensor(TankwiseEntity, SensorEntity):
    """Calibrated tank fill percentage."""

    _attr_name = "Tank level"
    _attr_translation_key = "tank_level"
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:gauge"

    def __init__(self, controller, entry_id: str) -> None:
        super().__init__(controller, entry_id)
        self._attr_unique_id = f"{entry_id}_tank_level"

    @property
    def native_value(self) -> float | None:
        snap = self.controller.snapshot()
        if snap.percent is None:
            return None
        return round(snap.percent, 1)


class TankwiseDistanceSensor(TankwiseEntity, SensorEntity):
    """Passthrough helper for the configured distance reading."""

    _attr_name = "Tank distance"
    _attr_translation_key = "tank_distance"
    _attr_native_unit_of_measurement = UnitOfLength.CENTIMETERS
    _attr_device_class = SensorDeviceClass.DISTANCE
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:ruler"

    def __init__(self, controller, entry_id: str) -> None:
        super().__init__(controller, entry_id)
        self._attr_unique_id = f"{entry_id}_tank_distance"

    @property
    def native_value(self) -> float | None:
        snap = self.controller.snapshot()
        if snap.distance is None:
            return None
        return round(snap.distance, 2)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "source_entity": self.controller.distance_entity,
            "full_distance": self.controller.full_distance,
            "empty_distance": self.controller.empty_distance,
        }


class TankwiseCyclePhaseSensor(TankwiseEntity, SensorEntity):
    """Current work/rest cycle phase."""

    _attr_name = "Cycle phase"
    _attr_translation_key = "cycle_phase"
    _attr_icon = "mdi:timer-sand"

    def __init__(self, controller, entry_id: str) -> None:
        super().__init__(controller, entry_id)
        self._attr_unique_id = f"{entry_id}_cycle_phase"

    @property
    def native_value(self) -> str:
        return self.controller.cycle_phase
