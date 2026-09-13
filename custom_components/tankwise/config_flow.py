"""Config and options flows for Tankwise."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
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

STEP_USER_DATA = vol.Schema(
    {
        vol.Required(CONF_NAME, default="Tankwise"): selector.TextSelector(),
        vol.Required(CONF_PUMP_ENTITY): selector.EntitySelector(
            selector.EntitySelectorConfig(domain=["switch", "input_boolean", "light"])
        ),
        vol.Required(CONF_DISTANCE_ENTITY): selector.EntitySelector(
            selector.EntitySelectorConfig(domain=["sensor", "input_number", "number"])
        ),
        vol.Required(
            CONF_FULL_DISTANCE, default=DEFAULT_FULL_DISTANCE
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=10000, step=0.1, mode=selector.NumberSelectorMode.BOX
            )
        ),
        vol.Required(
            CONF_EMPTY_DISTANCE, default=DEFAULT_EMPTY_DISTANCE
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=10000, step=0.1, mode=selector.NumberSelectorMode.BOX
            )
        ),
        vol.Required(
            CONF_EXPOSE_PERCENTAGE, default=DEFAULT_EXPOSE_PERCENTAGE
        ): selector.BooleanSelector(),
    }
)

STEP_HYSTERESIS = vol.Schema(
    {
        vol.Required(
            CONF_ON_THRESHOLD, default=DEFAULT_ON_THRESHOLD
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=10000, step=0.1, mode=selector.NumberSelectorMode.BOX
            )
        ),
        vol.Required(
            CONF_OFF_THRESHOLD, default=DEFAULT_OFF_THRESHOLD
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=10000, step=0.1, mode=selector.NumberSelectorMode.BOX
            )
        ),
        vol.Required(
            CONF_ON_HOLD_SECONDS, default=DEFAULT_ON_HOLD_SECONDS
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=86400, step=1, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="s"
            )
        ),
        vol.Required(
            CONF_OFF_HOLD_SECONDS, default=DEFAULT_OFF_HOLD_SECONDS
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=86400, step=1, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="s"
            )
        ),
        vol.Required(
            CONF_RECONCILE_INTERVAL, default=DEFAULT_RECONCILE_INTERVAL
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=15, max=3600, step=1, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="s"
            )
        ),
    }
)

STEP_OPTIONAL = vol.Schema(
    {
        vol.Optional(
            CONF_WORK_MINUTES, default=DEFAULT_WORK_MINUTES
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=1440, step=0.5, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="min"
            )
        ),
        vol.Optional(
            CONF_REST_MINUTES, default=DEFAULT_REST_MINUTES
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=1440, step=0.5, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="min"
            )
        ),
        vol.Optional(
            CONF_FAILSAFE_MARGIN_MINUTES, default=DEFAULT_FAILSAFE_MARGIN_MINUTES
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=120, step=0.5, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="min"
            )
        ),
        vol.Optional(CONF_TOGGLE_ENTITIES): selector.EntitySelector(
            selector.EntitySelectorConfig(
                domain=["binary_sensor", "input_boolean", "switch"],
                multiple=True,
            )
        ),
        vol.Optional(CONF_LED_ENTITIES): selector.EntitySelector(
            selector.EntitySelectorConfig(
                domain=["switch", "light", "input_boolean"],
                multiple=True,
            )
        ),
        vol.Optional(CONF_NOTIFY_SERVICE): selector.TextSelector(
            selector.TextSelectorConfig(type=selector.TextSelectorType.TEXT)
        ),
        vol.Optional(
            CONF_LOW_LEVEL_PERCENT, default=DEFAULT_LOW_LEVEL_PERCENT
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=100, step=1, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="%"
            )
        ),
        vol.Optional(
            CONF_CRITICAL_LEVEL_PERCENT, default=DEFAULT_CRITICAL_LEVEL_PERCENT
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=100, step=1, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="%"
            )
        ),
        vol.Optional(
            CONF_LEVEL_NOTIFY_HOLD_SECONDS, default=DEFAULT_LEVEL_NOTIFY_HOLD_SECONDS
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=86400, step=1, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="s"
            )
        ),
        vol.Optional(
            CONF_RECONCILE_RETRIES, default=DEFAULT_RECONCILE_RETRIES
        ): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=1, max=10, step=1, mode=selector.NumberSelectorMode.BOX
            )
        ),
    }
)


def _validate_distances(
    full: float, empty: float, errors: dict[str, str]
) -> None:
    if empty <= full:
        errors["base"] = "empty_must_be_greater"
        errors[CONF_EMPTY_DISTANCE] = "empty_must_be_greater"


class TankwiseConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Tankwise."""

    VERSION = 1

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Initial setup: entities + calibration."""
        errors: dict[str, str] = {}
        if user_input is not None:
            _validate_distances(
                float(user_input[CONF_FULL_DISTANCE]),
                float(user_input[CONF_EMPTY_DISTANCE]),
                errors,
            )
            if not errors:
                # One entry per pump+distance pair
                await self.async_set_unique_id(
                    f"{user_input[CONF_PUMP_ENTITY]}_{user_input[CONF_DISTANCE_ENTITY]}"
                )
                self._abort_if_unique_id_configured()
                self._data.update(user_input)
                return await self.async_step_hysteresis()

        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_DATA, errors=errors
        )

    async def async_step_hysteresis(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Hysteresis thresholds and reconcile interval."""
        errors: dict[str, str] = {}
        if user_input is not None:
            on_th = float(user_input[CONF_ON_THRESHOLD])
            off_th = float(user_input[CONF_OFF_THRESHOLD])
            if off_th <= on_th:
                errors["base"] = "off_must_be_greater"
            else:
                self._data.update(user_input)
                return await self.async_step_optional()

        return self.async_show_form(
            step_id="hysteresis", data_schema=STEP_HYSTERESIS, errors=errors
        )

    async def async_step_optional(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Optional cycle, toggles, LEDs, notifications."""
        if user_input is not None:
            cleaned = {k: v for k, v in user_input.items() if v not in (None, "", [])}
            self._data.update(cleaned)
            title = self._data.pop(CONF_NAME, "Tankwise")
            return self.async_create_entry(title=title, data=self._data)

        return self.async_show_form(step_id="optional", data_schema=STEP_OPTIONAL)

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> TankwiseOptionsFlow:
        return TankwiseOptionsFlow()


class TankwiseOptionsFlow(config_entries.OptionsFlow):
    """Handle options for an existing Tankwise entry."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Manage Tankwise options."""
        errors: dict[str, str] = {}
        current = {**self.config_entry.data, **self.config_entry.options}

        if user_input is not None:
            _validate_distances(
                float(user_input[CONF_FULL_DISTANCE]),
                float(user_input[CONF_EMPTY_DISTANCE]),
                errors,
            )
            on_th = float(user_input[CONF_ON_THRESHOLD])
            off_th = float(user_input[CONF_OFF_THRESHOLD])
            if off_th <= on_th:
                errors["base"] = "off_must_be_greater"
            if not errors:
                cleaned = {
                    k: v for k, v in user_input.items() if v not in (None, "")
                }
                return self.async_create_entry(title="", data=cleaned)

        schema = vol.Schema(
            {
                vol.Required(
                    CONF_FULL_DISTANCE,
                    default=current.get(CONF_FULL_DISTANCE, DEFAULT_FULL_DISTANCE),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=10000, step=0.1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Required(
                    CONF_EMPTY_DISTANCE,
                    default=current.get(CONF_EMPTY_DISTANCE, DEFAULT_EMPTY_DISTANCE),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=10000, step=0.1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Required(
                    CONF_EXPOSE_PERCENTAGE,
                    default=current.get(
                        CONF_EXPOSE_PERCENTAGE, DEFAULT_EXPOSE_PERCENTAGE
                    ),
                ): selector.BooleanSelector(),
                vol.Required(
                    CONF_ON_THRESHOLD,
                    default=current.get(CONF_ON_THRESHOLD, DEFAULT_ON_THRESHOLD),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=10000, step=0.1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Required(
                    CONF_OFF_THRESHOLD,
                    default=current.get(CONF_OFF_THRESHOLD, DEFAULT_OFF_THRESHOLD),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=10000, step=0.1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Required(
                    CONF_ON_HOLD_SECONDS,
                    default=current.get(CONF_ON_HOLD_SECONDS, DEFAULT_ON_HOLD_SECONDS),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=86400, step=1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Required(
                    CONF_OFF_HOLD_SECONDS,
                    default=current.get(
                        CONF_OFF_HOLD_SECONDS, DEFAULT_OFF_HOLD_SECONDS
                    ),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=86400, step=1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Required(
                    CONF_RECONCILE_INTERVAL,
                    default=current.get(
                        CONF_RECONCILE_INTERVAL, DEFAULT_RECONCILE_INTERVAL
                    ),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=15, max=3600, step=1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Optional(
                    CONF_WORK_MINUTES,
                    default=current.get(CONF_WORK_MINUTES, DEFAULT_WORK_MINUTES),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=1440, step=0.5, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Optional(
                    CONF_REST_MINUTES,
                    default=current.get(CONF_REST_MINUTES, DEFAULT_REST_MINUTES),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=1440, step=0.5, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Optional(
                    CONF_FAILSAFE_MARGIN_MINUTES,
                    default=current.get(
                        CONF_FAILSAFE_MARGIN_MINUTES, DEFAULT_FAILSAFE_MARGIN_MINUTES
                    ),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=120, step=0.5, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Optional(
                    CONF_TOGGLE_ENTITIES,
                    default=current.get(CONF_TOGGLE_ENTITIES, []),
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain=["binary_sensor", "input_boolean", "switch"],
                        multiple=True,
                    )
                ),
                vol.Optional(
                    CONF_LED_ENTITIES,
                    default=current.get(CONF_LED_ENTITIES, []),
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain=["switch", "light", "input_boolean"],
                        multiple=True,
                    )
                ),
                vol.Optional(
                    CONF_NOTIFY_SERVICE,
                    default=current.get(CONF_NOTIFY_SERVICE, ""),
                ): selector.TextSelector(),
                vol.Optional(
                    CONF_LOW_LEVEL_PERCENT,
                    default=current.get(
                        CONF_LOW_LEVEL_PERCENT, DEFAULT_LOW_LEVEL_PERCENT
                    ),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=100, step=1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Optional(
                    CONF_CRITICAL_LEVEL_PERCENT,
                    default=current.get(
                        CONF_CRITICAL_LEVEL_PERCENT, DEFAULT_CRITICAL_LEVEL_PERCENT
                    ),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=100, step=1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Optional(
                    CONF_LEVEL_NOTIFY_HOLD_SECONDS,
                    default=current.get(
                        CONF_LEVEL_NOTIFY_HOLD_SECONDS,
                        DEFAULT_LEVEL_NOTIFY_HOLD_SECONDS,
                    ),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=86400, step=1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Optional(
                    CONF_RECONCILE_RETRIES,
                    default=current.get(
                        CONF_RECONCILE_RETRIES, DEFAULT_RECONCILE_RETRIES
                    ),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=1, max=10, step=1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
            }
        )
        return self.async_show_form(
            step_id="init", data_schema=schema, errors=errors
        )
