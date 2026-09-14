"""Config flow for Tankwise — minimal schema to avoid HA flow 400/500 errors."""

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
    CONF_THRESHOLD_MODE,
    DEFAULT_THRESHOLD_MODE,
    CONF_PUMP_ENTITY,
    CONF_RECONCILE_INTERVAL,
    CONF_RECONCILE_RETRIES,
    CONF_REST_MINUTES,
    CONF_TOGGLE_ENTITIES,
    CONF_WORK_MINUTES,
    DEFAULT_CRITICAL_LEVEL_PERCENT,
    DEFAULT_EXPOSE_PERCENTAGE,
    DEFAULT_FAILSAFE_MARGIN_MINUTES,
    DEFAULT_LEVEL_NOTIFY_HOLD_SECONDS,
    DEFAULT_LOW_LEVEL_PERCENT,
    DEFAULT_OFF_HOLD_SECONDS,
    DEFAULT_ON_HOLD_SECONDS,
    DEFAULT_RECONCILE_INTERVAL,
    DEFAULT_RECONCILE_RETRIES,
    DEFAULT_REST_MINUTES,
    DEFAULT_WORK_MINUTES,
    DOMAIN,
)

_DEFAULT_FULL = 0.25
_DEFAULT_EMPTY = 0.47


def _defaults_from_calibration(full: float, empty: float) -> dict[str, Any]:
    span = max(empty - full, 0.001)
    return {
        CONF_FULL_DISTANCE: full,
        CONF_EMPTY_DISTANCE: empty,
        CONF_EXPOSE_PERCENTAGE: DEFAULT_EXPOSE_PERCENTAGE,
        CONF_THRESHOLD_MODE: DEFAULT_THRESHOLD_MODE,
        CONF_ON_THRESHOLD: round(full + span * 0.70, 3),
        CONF_OFF_THRESHOLD: round(full + span * 0.05, 3),
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


def _user_schema() -> vol.Schema:
    """Build schema with official selectors (serializes cleanly to the frontend)."""
    return vol.Schema(
        {
            vol.Required(CONF_NAME, default="Tankwise"): selector.TextSelector(),
            vol.Required(CONF_PUMP_ENTITY): selector.EntitySelector(
                selector.EntitySelectorConfig(
                    domain=["switch", "input_boolean", "light"]
                )
            ),
            vol.Required(CONF_DISTANCE_ENTITY): selector.EntitySelector(
                selector.EntitySelectorConfig(
                    domain=["sensor", "input_number", "number"]
                )
            ),
            vol.Required(
                CONF_FULL_DISTANCE, default=_DEFAULT_FULL
            ): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=0,
                    max=10000,
                    step=0.01,
                    mode=selector.NumberSelectorMode.BOX,
                )
            ),
            vol.Required(
                CONF_EMPTY_DISTANCE, default=_DEFAULT_EMPTY
            ): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=0,
                    max=10000,
                    step=0.01,
                    mode=selector.NumberSelectorMode.BOX,
                )
            ),
            vol.Required(
                CONF_EXPOSE_PERCENTAGE, default=DEFAULT_EXPOSE_PERCENTAGE
            ): selector.BooleanSelector(),
        }
    )


class TankwiseConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Single-step install flow."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        """Collect pump + distance + basic calibration."""
        errors: dict[str, str] = {}

        if user_input is not None:
            full = float(user_input[CONF_FULL_DISTANCE])
            empty = float(user_input[CONF_EMPTY_DISTANCE])
            if empty <= full:
                errors["base"] = "empty_must_be_greater"
            else:
                await self.async_set_unique_id(
                    f"{user_input[CONF_PUMP_ENTITY]}_{user_input[CONF_DISTANCE_ENTITY]}"
                )
                self._abort_if_unique_id_configured()

                data = _defaults_from_calibration(full, empty)
                data[CONF_PUMP_ENTITY] = user_input[CONF_PUMP_ENTITY]
                data[CONF_DISTANCE_ENTITY] = user_input[CONF_DISTANCE_ENTITY]
                data[CONF_EXPOSE_PERCENTAGE] = bool(
                    user_input.get(CONF_EXPOSE_PERCENTAGE, True)
                )
                title = user_input.get(CONF_NAME) or "Tankwise"
                return self.async_create_entry(title=title, data=data)

        return self.async_show_form(
            step_id="user",
            data_schema=_user_schema(),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        return TankwiseOptionsFlow()


class TankwiseOptionsFlow(config_entries.OptionsFlow):
    """Basic options — prefer the sidebar panel for full editing."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        current = {**self.config_entry.data, **self.config_entry.options}
        errors: dict[str, str] = {}

        if user_input is not None:
            full = float(user_input[CONF_FULL_DISTANCE])
            empty = float(user_input[CONF_EMPTY_DISTANCE])
            on_th = float(user_input[CONF_ON_THRESHOLD])
            off_th = float(user_input[CONF_OFF_THRESHOLD])
            if empty <= full:
                errors["base"] = "empty_must_be_greater"
            elif str(user_input.get(CONF_THRESHOLD_MODE, current.get(CONF_THRESHOLD_MODE, DEFAULT_THRESHOLD_MODE))) == "percent":
                if on_th >= off_th:
                    errors["base"] = "on_percent_must_be_less"
            elif on_th <= off_th:
                errors["base"] = "on_must_be_greater"
            else:
                return self.async_create_entry(title="", data=user_input)

        schema = vol.Schema(
            {
                vol.Required(
                    CONF_FULL_DISTANCE,
                    default=float(current.get(CONF_FULL_DISTANCE, _DEFAULT_FULL)),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=10000, step=0.01, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Required(
                    CONF_EMPTY_DISTANCE,
                    default=float(current.get(CONF_EMPTY_DISTANCE, _DEFAULT_EMPTY)),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=10000, step=0.01, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Required(
                    CONF_THRESHOLD_MODE,
                    default=str(current.get(CONF_THRESHOLD_MODE, DEFAULT_THRESHOLD_MODE)),
                ): selector.SelectSelector(
                    selector.SelectSelectorConfig(
                        options=[
                            {"value": "distance", "label": "Distance"},
                            {"value": "percent", "label": "Percent (%)"},
                        ],
                        mode=selector.SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Required(
                    CONF_ON_THRESHOLD,
                    default=float(current.get(CONF_ON_THRESHOLD, _DEFAULT_FULL)),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=10000, step=0.01, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Required(
                    CONF_OFF_THRESHOLD,
                    default=float(current.get(CONF_OFF_THRESHOLD, _DEFAULT_EMPTY)),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=10000, step=0.01, mode=selector.NumberSelectorMode.BOX
                    )
                ),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema, errors=errors)
