"""Friendly wizard-style config and options flows for Tankwise."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.data_entry_flow import section
from homeassistant.helpers import selector

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
    DEFAULT_CRITICAL_LEVEL_PERCENT,
    DEFAULT_EMPTY_DISTANCE,
    DEFAULT_EXPOSE_PERCENTAGE,
    DEFAULT_FAILSAFE_MARGIN_MINUTES,
    DEFAULT_FULL_DISTANCE,
    DEFAULT_LEVEL_NOTIFY_HOLD_SECONDS,
    DEFAULT_LOW_LEVEL_PERCENT,
    DEFAULT_OFF_HOLD_SECONDS,
    DEFAULT_OFF_THRESHOLD,
    DEFAULT_ON_HOLD_SECONDS,
    DEFAULT_ON_THRESHOLD,
    DEFAULT_RECONCILE_INTERVAL,
    DEFAULT_RECONCILE_RETRIES,
    DEFAULT_REST_MINUTES,
    DEFAULT_WORK_MINUTES,
    DOMAIN,
)

OPTIONS_MENU = [
    "calibration",
    "automation",
    "cycle",
    "hardware",
    "alerts",
]

ALL_OPTION_DEFAULTS: dict[str, Any] = {
    CONF_FULL_DISTANCE: DEFAULT_FULL_DISTANCE,
    CONF_EMPTY_DISTANCE: DEFAULT_EMPTY_DISTANCE,
    CONF_EXPOSE_PERCENTAGE: DEFAULT_EXPOSE_PERCENTAGE,
    CONF_ON_THRESHOLD: DEFAULT_ON_THRESHOLD,
    CONF_OFF_THRESHOLD: DEFAULT_OFF_THRESHOLD,
    CONF_ON_HOLD_SECONDS: DEFAULT_ON_HOLD_SECONDS,
    CONF_OFF_HOLD_SECONDS: DEFAULT_OFF_HOLD_SECONDS,
    CONF_RECONCILE_INTERVAL: DEFAULT_RECONCILE_INTERVAL,
    CONF_RECONCILE_RETRIES: DEFAULT_RECONCILE_RETRIES,
    CONF_WORK_MINUTES: DEFAULT_WORK_MINUTES,
    CONF_REST_MINUTES: DEFAULT_REST_MINUTES,
    CONF_FAILSAFE_MARGIN_MINUTES: DEFAULT_FAILSAFE_MARGIN_MINUTES,
    CONF_TOGGLE_ENTITIES: [],
    CONF_LED_ENTITIES: [],
    CONF_NOTIFY_SERVICE: "",
    CONF_LOW_LEVEL_PERCENT: DEFAULT_LOW_LEVEL_PERCENT,
    CONF_CRITICAL_LEVEL_PERCENT: DEFAULT_CRITICAL_LEVEL_PERCENT,
    CONF_LEVEL_NOTIFY_HOLD_SECONDS: DEFAULT_LEVEL_NOTIFY_HOLD_SECONDS,
}


def _number(
    *,
    min_value: float = 0,
    max_value: float = 10000,
    step: float = 0.1,
    unit: str | None = None,
) -> selector.NumberSelector:
    cfg = selector.NumberSelectorConfig(
        min=min_value,
        max=max_value,
        step=step,
        mode=selector.NumberSelectorMode.BOX,
        unit_of_measurement=unit,
    )
    return selector.NumberSelector(cfg)


def _validate_distances(full: float, empty: float, errors: dict[str, str]) -> None:
    if empty <= full:
        errors["base"] = "empty_must_be_greater"
        errors[CONF_EMPTY_DISTANCE] = "empty_must_be_greater"


def _validate_thresholds(on_th: float, off_th: float, errors: dict[str, str]) -> None:
    if off_th <= on_th:
        errors["base"] = "off_must_be_greater"
        errors[CONF_OFF_THRESHOLD] = "off_must_be_greater"


def _suggest_thresholds(full: float, empty: float) -> tuple[float, float]:
    """Suggest on/off thresholds from calibration (lower distance = fuller)."""
    span = empty - full
    if span <= 0:
        return DEFAULT_ON_THRESHOLD, DEFAULT_OFF_THRESHOLD
    if abs(full - 82.0) < 0.1 and abs(empty - 120.0) < 0.1:
        return 82.0, 96.0
    if empty < 5:
        # Meter-scale tanks (e.g. 0.25–0.47)
        return round(full + span * 0.05, 3), round(full + span * 0.70, 3)
    return round(full, 2), round(full + span * (14 / 38), 2)


def _flatten_sections(user_input: dict[str, Any]) -> dict[str, Any]:
    flat: dict[str, Any] = {}
    for key, value in user_input.items():
        if isinstance(value, dict):
            flat.update(value)
        else:
            flat[key] = value
    return flat


def _current(entry: config_entries.ConfigEntry) -> dict[str, Any]:
    return {**entry.data, **entry.options}


class TankwiseConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Wizard-style setup for Tankwise."""

    VERSION = 1

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Step 1 — pump + distance entities."""
        if user_input is not None:
            data = _flatten_sections(user_input)
            await self.async_set_unique_id(
                f"{data[CONF_PUMP_ENTITY]}_{data[CONF_DISTANCE_ENTITY]}"
            )
            self._abort_if_unique_id_configured()
            self._data.update(data)
            return await self.async_step_calibration()

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required("devices"): section(
                        vol.Schema(
                            {
                                vol.Required(
                                    CONF_NAME, default="Tankwise"
                                ): selector.TextSelector(),
                                vol.Required(
                                    CONF_PUMP_ENTITY
                                ): selector.EntitySelector(
                                    selector.EntitySelectorConfig(
                                        domain=["switch", "input_boolean", "light"]
                                    )
                                ),
                                vol.Required(
                                    CONF_DISTANCE_ENTITY
                                ): selector.EntitySelector(
                                    selector.EntitySelectorConfig(
                                        domain=["sensor", "input_number", "number"]
                                    )
                                ),
                            }
                        ),
                        {"collapsed": False},
                    ),
                }
            ),
            last_step=False,
        )

    async def async_step_calibration(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Step 2 — full/empty calibration."""
        errors: dict[str, str] = {}
        if user_input is not None:
            data = _flatten_sections(user_input)
            _validate_distances(
                float(data[CONF_FULL_DISTANCE]),
                float(data[CONF_EMPTY_DISTANCE]),
                errors,
            )
            if not errors:
                self._data.update(data)
                return await self.async_step_automation()

        return self.async_show_form(
            step_id="calibration",
            data_schema=vol.Schema(
                {
                    vol.Required("calibration"): section(
                        vol.Schema(
                            {
                                vol.Required(
                                    CONF_FULL_DISTANCE,
                                    default=DEFAULT_FULL_DISTANCE,
                                ): _number(step=0.01),
                                vol.Required(
                                    CONF_EMPTY_DISTANCE,
                                    default=DEFAULT_EMPTY_DISTANCE,
                                ): _number(step=0.01),
                                vol.Required(
                                    CONF_EXPOSE_PERCENTAGE,
                                    default=DEFAULT_EXPOSE_PERCENTAGE,
                                ): selector.BooleanSelector(),
                            }
                        ),
                        {"collapsed": False},
                    ),
                }
            ),
            errors=errors,
            last_step=False,
        )

    async def async_step_automation(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Step 3 — hysteresis + reconciler."""
        errors: dict[str, str] = {}
        full = float(self._data.get(CONF_FULL_DISTANCE, DEFAULT_FULL_DISTANCE))
        empty = float(self._data.get(CONF_EMPTY_DISTANCE, DEFAULT_EMPTY_DISTANCE))
        sug_on, sug_off = _suggest_thresholds(full, empty)

        if user_input is not None:
            data = _flatten_sections(user_input)
            _validate_thresholds(
                float(data[CONF_ON_THRESHOLD]),
                float(data[CONF_OFF_THRESHOLD]),
                errors,
            )
            if not errors:
                self._data.update(data)
                return await self.async_step_extras()

        return self.async_show_form(
            step_id="automation",
            data_schema=vol.Schema(
                {
                    vol.Required("hysteresis"): section(
                        vol.Schema(
                            {
                                vol.Required(
                                    CONF_ON_THRESHOLD, default=sug_on
                                ): _number(step=0.01),
                                vol.Required(
                                    CONF_OFF_THRESHOLD, default=sug_off
                                ): _number(step=0.01),
                                vol.Required(
                                    CONF_ON_HOLD_SECONDS,
                                    default=DEFAULT_ON_HOLD_SECONDS,
                                ): _number(max_value=86400, step=1, unit="s"),
                                vol.Required(
                                    CONF_OFF_HOLD_SECONDS,
                                    default=DEFAULT_OFF_HOLD_SECONDS,
                                ): _number(max_value=86400, step=1, unit="s"),
                            }
                        ),
                        {"collapsed": False},
                    ),
                    vol.Required("reconciler"): section(
                        vol.Schema(
                            {
                                vol.Required(
                                    CONF_RECONCILE_INTERVAL,
                                    default=DEFAULT_RECONCILE_INTERVAL,
                                ): _number(
                                    min_value=15, max_value=3600, step=1, unit="s"
                                ),
                                vol.Required(
                                    CONF_RECONCILE_RETRIES,
                                    default=DEFAULT_RECONCILE_RETRIES,
                                ): _number(min_value=1, max_value=10, step=1),
                            }
                        ),
                        {"collapsed": False},
                    ),
                }
            ),
            errors=errors,
            description_placeholders={
                "full": str(full),
                "empty": str(empty),
                "sug_on": str(sug_on),
                "sug_off": str(sug_off),
            },
            last_step=False,
        )

    async def async_step_extras(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Step 4 — optional cycle / hardware / alerts."""
        if user_input is not None:
            data = _flatten_sections(user_input)
            cleaned = {k: v for k, v in data.items() if v not in (None, "", [])}
            self._data.update(cleaned)
            title = self._data.pop(CONF_NAME, "Tankwise")
            return self.async_create_entry(title=title, data=self._data)

        return self.async_show_form(
            step_id="extras",
            data_schema=vol.Schema(
                {
                    vol.Required("cycle"): section(
                        vol.Schema(
                            {
                                vol.Optional(
                                    CONF_WORK_MINUTES, default=DEFAULT_WORK_MINUTES
                                ): _number(max_value=1440, step=0.5, unit="min"),
                                vol.Optional(
                                    CONF_REST_MINUTES, default=DEFAULT_REST_MINUTES
                                ): _number(max_value=1440, step=0.5, unit="min"),
                                vol.Optional(
                                    CONF_FAILSAFE_MARGIN_MINUTES,
                                    default=DEFAULT_FAILSAFE_MARGIN_MINUTES,
                                ): _number(max_value=120, step=0.5, unit="min"),
                            }
                        ),
                        {"collapsed": True},
                    ),
                    vol.Required("hardware"): section(
                        vol.Schema(
                            {
                                vol.Optional(
                                    CONF_TOGGLE_ENTITIES
                                ): selector.EntitySelector(
                                    selector.EntitySelectorConfig(
                                        domain=[
                                            "binary_sensor",
                                            "input_boolean",
                                            "switch",
                                        ],
                                        multiple=True,
                                    )
                                ),
                                vol.Optional(
                                    CONF_LED_ENTITIES
                                ): selector.EntitySelector(
                                    selector.EntitySelectorConfig(
                                        domain=["switch", "light", "input_boolean"],
                                        multiple=True,
                                    )
                                ),
                            }
                        ),
                        {"collapsed": True},
                    ),
                    vol.Required("alerts"): section(
                        vol.Schema(
                            {
                                vol.Optional(
                                    CONF_NOTIFY_SERVICE
                                ): selector.TextSelector(),
                                vol.Optional(
                                    CONF_LOW_LEVEL_PERCENT,
                                    default=DEFAULT_LOW_LEVEL_PERCENT,
                                ): _number(max_value=100, step=1, unit="%"),
                                vol.Optional(
                                    CONF_CRITICAL_LEVEL_PERCENT,
                                    default=DEFAULT_CRITICAL_LEVEL_PERCENT,
                                ): _number(max_value=100, step=1, unit="%"),
                                vol.Optional(
                                    CONF_LEVEL_NOTIFY_HOLD_SECONDS,
                                    default=DEFAULT_LEVEL_NOTIFY_HOLD_SECONDS,
                                ): _number(max_value=86400, step=1, unit="s"),
                            }
                        ),
                        {"collapsed": True},
                    ),
                }
            ),
            last_step=True,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> TankwiseOptionsFlow:
        return TankwiseOptionsFlow()


class TankwiseOptionsFlow(config_entries.OptionsFlow):
    """Menu-based options dashboard."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        return self.async_show_menu(step_id="init", menu_options=OPTIONS_MENU)

    async def async_step_calibration(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        return await self._async_edit(
            "calibration",
            user_input,
            {
                CONF_FULL_DISTANCE: (_number(step=0.01), DEFAULT_FULL_DISTANCE),
                CONF_EMPTY_DISTANCE: (_number(step=0.01), DEFAULT_EMPTY_DISTANCE),
                CONF_EXPOSE_PERCENTAGE: (
                    selector.BooleanSelector(),
                    DEFAULT_EXPOSE_PERCENTAGE,
                ),
            },
            validate_distances=True,
        )

    async def async_step_automation(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        return await self._async_edit(
            "automation",
            user_input,
            {
                CONF_ON_THRESHOLD: (_number(step=0.01), DEFAULT_ON_THRESHOLD),
                CONF_OFF_THRESHOLD: (_number(step=0.01), DEFAULT_OFF_THRESHOLD),
                CONF_ON_HOLD_SECONDS: (
                    _number(max_value=86400, step=1, unit="s"),
                    DEFAULT_ON_HOLD_SECONDS,
                ),
                CONF_OFF_HOLD_SECONDS: (
                    _number(max_value=86400, step=1, unit="s"),
                    DEFAULT_OFF_HOLD_SECONDS,
                ),
                CONF_RECONCILE_INTERVAL: (
                    _number(min_value=15, max_value=3600, step=1, unit="s"),
                    DEFAULT_RECONCILE_INTERVAL,
                ),
                CONF_RECONCILE_RETRIES: (
                    _number(min_value=1, max_value=10, step=1),
                    DEFAULT_RECONCILE_RETRIES,
                ),
            },
            validate_thresholds=True,
        )

    async def async_step_cycle(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        return await self._async_edit(
            "cycle",
            user_input,
            {
                CONF_WORK_MINUTES: (
                    _number(max_value=1440, step=0.5, unit="min"),
                    DEFAULT_WORK_MINUTES,
                ),
                CONF_REST_MINUTES: (
                    _number(max_value=1440, step=0.5, unit="min"),
                    DEFAULT_REST_MINUTES,
                ),
                CONF_FAILSAFE_MARGIN_MINUTES: (
                    _number(max_value=120, step=0.5, unit="min"),
                    DEFAULT_FAILSAFE_MARGIN_MINUTES,
                ),
            },
        )

    async def async_step_hardware(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        return await self._async_edit(
            "hardware",
            user_input,
            {
                CONF_TOGGLE_ENTITIES: (
                    selector.EntitySelector(
                        selector.EntitySelectorConfig(
                            domain=["binary_sensor", "input_boolean", "switch"],
                            multiple=True,
                        )
                    ),
                    [],
                ),
                CONF_LED_ENTITIES: (
                    selector.EntitySelector(
                        selector.EntitySelectorConfig(
                            domain=["switch", "light", "input_boolean"],
                            multiple=True,
                        )
                    ),
                    [],
                ),
            },
        )

    async def async_step_alerts(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        return await self._async_edit(
            "alerts",
            user_input,
            {
                CONF_NOTIFY_SERVICE: (selector.TextSelector(), ""),
                CONF_LOW_LEVEL_PERCENT: (
                    _number(max_value=100, step=1, unit="%"),
                    DEFAULT_LOW_LEVEL_PERCENT,
                ),
                CONF_CRITICAL_LEVEL_PERCENT: (
                    _number(max_value=100, step=1, unit="%"),
                    DEFAULT_CRITICAL_LEVEL_PERCENT,
                ),
                CONF_LEVEL_NOTIFY_HOLD_SECONDS: (
                    _number(max_value=86400, step=1, unit="s"),
                    DEFAULT_LEVEL_NOTIFY_HOLD_SECONDS,
                ),
            },
        )

    async def _async_edit(
        self,
        step_id: str,
        user_input: dict[str, Any] | None,
        fields: dict[str, tuple[Any, Any]],
        *,
        validate_distances: bool = False,
        validate_thresholds: bool = False,
    ) -> config_entries.ConfigFlowResult:
        errors: dict[str, str] = {}
        current = _current(self.config_entry)

        if user_input is not None:
            data = _flatten_sections(user_input)
            if validate_distances:
                _validate_distances(
                    float(data[CONF_FULL_DISTANCE]),
                    float(data[CONF_EMPTY_DISTANCE]),
                    errors,
                )
            if validate_thresholds:
                _validate_thresholds(
                    float(data[CONF_ON_THRESHOLD]),
                    float(data[CONF_OFF_THRESHOLD]),
                    errors,
                )
            if not errors:
                merged = {
                    key: current.get(key, default)
                    for key, default in ALL_OPTION_DEFAULTS.items()
                }
                merged.update({k: v for k, v in data.items() if v is not None})
                return self.async_create_entry(title="", data=merged)

        schema_fields: dict[Any, Any] = {}
        for key, (field_selector, default) in fields.items():
            schema_fields[
                vol.Required(key, default=current.get(key, default))
            ] = field_selector

        return self.async_show_form(
            step_id=step_id,
            data_schema=vol.Schema(
                {
                    vol.Required("settings"): section(
                        vol.Schema(schema_fields),
                        {"collapsed": False},
                    )
                }
            ),
            errors=errors,
        )
