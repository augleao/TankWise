"""Config and options flows for Tankwise.

Install flow is intentionally minimal (plain voluptuous types) to avoid
Home Assistant frontend/API 400 errors seen with complex selectors/sections.
Day-to-day tuning is done in the Tankwise sidebar panel.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers import config_validation as cv

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

# Suggested meter-scale defaults (ultrasonic). Old cm-scale YAML used 82/120.
_DEFAULT_FULL = 0.25
_DEFAULT_EMPTY = 0.47


def _entry_defaults() -> dict[str, Any]:
    """Runtime defaults stored with the config entry."""
    full = _DEFAULT_FULL
    empty = _DEFAULT_EMPTY
    span = empty - full
    return {
        CONF_FULL_DISTANCE: full,
        CONF_EMPTY_DISTANCE: empty,
        CONF_EXPOSE_PERCENTAGE: DEFAULT_EXPOSE_PERCENTAGE,
        CONF_ON_THRESHOLD: round(full + span * 0.05, 3),
        CONF_OFF_THRESHOLD: round(full + span * 0.70, 3),
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


STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_NAME, default="Tankwise"): cv.string,
        vol.Required(CONF_PUMP_ENTITY): cv.entity_id,
        vol.Required(CONF_DISTANCE_ENTITY): cv.entity_id,
        vol.Required(CONF_FULL_DISTANCE, default=_DEFAULT_FULL): vol.Coerce(float),
        vol.Required(CONF_EMPTY_DISTANCE, default=_DEFAULT_EMPTY): vol.Coerce(float),
        vol.Required(
            CONF_EXPOSE_PERCENTAGE, default=DEFAULT_EXPOSE_PERCENTAGE
        ): cv.boolean,
    }
)


class TankwiseConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Minimal install flow — full UI is the sidebar panel."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Single setup step: name, pump, distance, basic calibration."""
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

                data = _entry_defaults()
                data.update(user_input)
                span = empty - full
                data[CONF_ON_THRESHOLD] = round(full + span * 0.05, 3)
                data[CONF_OFF_THRESHOLD] = round(full + span * 0.70, 3)

                title = data.pop(CONF_NAME, "Tankwise")
                return self.async_create_entry(title=title, data=data)

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_DATA_SCHEMA,
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> TankwiseOptionsFlow:
        return TankwiseOptionsFlow()


class TankwiseOptionsFlow(config_entries.OptionsFlow):
    """Simple options form (panel is preferred for day-to-day changes)."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        current = {**self.config_entry.data, **self.config_entry.options}

        if user_input is not None:
            full = float(user_input[CONF_FULL_DISTANCE])
            empty = float(user_input[CONF_EMPTY_DISTANCE])
            on_th = float(user_input[CONF_ON_THRESHOLD])
            off_th = float(user_input[CONF_OFF_THRESHOLD])
            errors: dict[str, str] = {}
            if empty <= full:
                errors["base"] = "empty_must_be_greater"
            elif off_th <= on_th:
                errors["base"] = "off_must_be_greater"
            if errors:
                return self.async_show_form(
                    step_id="init",
                    data_schema=self._schema(current),
                    errors=errors,
                )
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=self._schema(current),
        )

    @staticmethod
    def _schema(current: dict[str, Any]) -> vol.Schema:
        return vol.Schema(
            {
                vol.Required(
                    CONF_FULL_DISTANCE,
                    default=current.get(CONF_FULL_DISTANCE, _DEFAULT_FULL),
                ): vol.Coerce(float),
                vol.Required(
                    CONF_EMPTY_DISTANCE,
                    default=current.get(CONF_EMPTY_DISTANCE, _DEFAULT_EMPTY),
                ): vol.Coerce(float),
                vol.Required(
                    CONF_ON_THRESHOLD,
                    default=current.get(CONF_ON_THRESHOLD, DEFAULT_ON_THRESHOLD),
                ): vol.Coerce(float),
                vol.Required(
                    CONF_OFF_THRESHOLD,
                    default=current.get(CONF_OFF_THRESHOLD, DEFAULT_OFF_THRESHOLD),
                ): vol.Coerce(float),
                vol.Required(
                    CONF_ON_HOLD_SECONDS,
                    default=current.get(CONF_ON_HOLD_SECONDS, DEFAULT_ON_HOLD_SECONDS),
                ): vol.Coerce(int),
                vol.Required(
                    CONF_OFF_HOLD_SECONDS,
                    default=current.get(
                        CONF_OFF_HOLD_SECONDS, DEFAULT_OFF_HOLD_SECONDS
                    ),
                ): vol.Coerce(int),
                vol.Required(
                    CONF_RECONCILE_INTERVAL,
                    default=current.get(
                        CONF_RECONCILE_INTERVAL, DEFAULT_RECONCILE_INTERVAL
                    ),
                ): vol.Coerce(int),
                vol.Required(
                    CONF_WORK_MINUTES,
                    default=current.get(CONF_WORK_MINUTES, DEFAULT_WORK_MINUTES),
                ): vol.Coerce(float),
                vol.Required(
                    CONF_REST_MINUTES,
                    default=current.get(CONF_REST_MINUTES, DEFAULT_REST_MINUTES),
                ): vol.Coerce(float),
                vol.Optional(
                    CONF_NOTIFY_SERVICE,
                    default=current.get(CONF_NOTIFY_SERVICE, ""),
                ): cv.string,
            }
        )
