"""Tankwise controller: desired demand, hysteresis, cycle, and reconciler."""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, STATE_ON
from homeassistant.core import (
    CALLBACK_TYPE,
    Event,
    HomeAssistant,
    callback,
)
from homeassistant.helpers.event import (
    async_track_state_change_event,
    async_track_time_interval,
)
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_ALLOWED,
    ATTR_CYCLE_PHASE,
    ATTR_DISTANCE,
    ATTR_ENABLED,
    ATTR_LAST_ERROR,
    ATTR_PERCENT,
    ATTR_REASON,
    CONF_CRITICAL_LEVEL_PERCENT,
    CONF_DISTANCE_ENTITY,
    CONF_EMPTY_DISTANCE,
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
    EVENT_DEMAND_CHANGED,
    EVENT_ENABLED_CHANGED,
    EVENT_FAULT,
    EVENT_RECONCILE,
    PHASE_IDLE,
    PHASE_RESTING,
    PHASE_WORKING,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from .helpers import distance_to_percent, is_on_state, parse_float

_LOGGER = logging.getLogger(__name__)


@dataclass
class TankwiseSnapshot:
    """Public snapshot published to entities."""

    desired_on: bool = False
    enabled: bool = True
    pump_on: bool | None = None
    distance: float | None = None
    percent: float | None = None
    cycle_phase: str = PHASE_IDLE
    pump_allowed: bool = False
    reconcile_healthy: bool = True
    last_error: str | None = None
    reason: str = "init"
    attributes: dict[str, Any] = field(default_factory=dict)


class TankwiseController:
    """Owns desired demand and reconciles the physical pump switch."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry_id: str,
        config: dict[str, Any],
    ) -> None:
        """Initialize the controller."""
        self.hass = hass
        self.entry_id = entry_id
        self.config = config
        self._listeners: list[Callable[[], None]] = []
        self._unsubs: list[CALLBACK_TYPE] = []
        self._store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}_{entry_id}")

        self.desired_on: bool = False
        self.enabled: bool = True
        self.cycle_phase: str = PHASE_IDLE
        self.reconcile_healthy: bool = True
        self.last_error: str | None = None
        self.reason: str = "init"
        self._started: bool = False

        self._on_condition_since: datetime | None = None
        self._off_condition_since: datetime | None = None
        self._low_since: datetime | None = None
        self._critical_since: datetime | None = None
        self._low_notified: bool = False
        self._critical_notified: bool = False

        self._phase_started_at: datetime | None = None
        self._work_started_at: datetime | None = None
        self._failsafe_triggered: bool = False

        self._last_toggle_states: dict[str, str | None] = {}

    # ------------------------------------------------------------------ config
    def update_config(self, config: dict[str, Any]) -> None:
        """Replace runtime config (options flow)."""
        self.config = config

    @property
    def pump_entity(self) -> str:
        return self.config[CONF_PUMP_ENTITY]

    @property
    def distance_entity(self) -> str:
        return self.config[CONF_DISTANCE_ENTITY]

    @property
    def full_distance(self) -> float:
        return float(self.config[CONF_FULL_DISTANCE])

    @property
    def empty_distance(self) -> float:
        return float(self.config[CONF_EMPTY_DISTANCE])

    @property
    def on_threshold(self) -> float:
        return float(self.config.get(CONF_ON_THRESHOLD, DEFAULT_ON_THRESHOLD))

    @property
    def off_threshold(self) -> float:
        return float(self.config.get(CONF_OFF_THRESHOLD, DEFAULT_OFF_THRESHOLD))

    @property
    def on_hold(self) -> int:
        return int(self.config.get(CONF_ON_HOLD_SECONDS, DEFAULT_ON_HOLD_SECONDS))

    @property
    def off_hold(self) -> int:
        return int(self.config.get(CONF_OFF_HOLD_SECONDS, DEFAULT_OFF_HOLD_SECONDS))

    @property
    def reconcile_interval(self) -> int:
        return int(
            self.config.get(CONF_RECONCILE_INTERVAL, DEFAULT_RECONCILE_INTERVAL)
        )

    @property
    def reconcile_retries(self) -> int:
        return int(self.config.get(CONF_RECONCILE_RETRIES, DEFAULT_RECONCILE_RETRIES))

    @property
    def work_minutes(self) -> float:
        return float(self.config.get(CONF_WORK_MINUTES, DEFAULT_WORK_MINUTES))

    @property
    def rest_minutes(self) -> float:
        return float(self.config.get(CONF_REST_MINUTES, DEFAULT_REST_MINUTES))

    @property
    def failsafe_margin_minutes(self) -> float:
        return float(
            self.config.get(
                CONF_FAILSAFE_MARGIN_MINUTES, DEFAULT_FAILSAFE_MARGIN_MINUTES
            )
        )

    @property
    def cyclic_mode(self) -> bool:
        return self.rest_minutes > 0 and self.work_minutes > 0

    @property
    def toggle_entities(self) -> list[str]:
        raw = self.config.get(CONF_TOGGLE_ENTITIES) or []
        if isinstance(raw, str):
            return [e.strip() for e in raw.split(",") if e.strip()]
        return list(raw)

    @property
    def led_entities(self) -> list[str]:
        raw = self.config.get(CONF_LED_ENTITIES) or []
        if isinstance(raw, str):
            return [e.strip() for e in raw.split(",") if e.strip()]
        return list(raw)

    @property
    def notify_service(self) -> str | None:
        value = self.config.get(CONF_NOTIFY_SERVICE)
        if not value:
            return None
        return str(value)

    # ------------------------------------------------------------------ lifecycle
    async def async_setup(self) -> None:
        """Load persisted demand and attach listeners."""
        data = await self._store.async_load()
        if isinstance(data, dict):
            if "desired_on" in data:
                self.desired_on = bool(data["desired_on"])
                self.reason = str(data.get("reason", "restored"))
            if "enabled" in data:
                self.enabled = bool(data["enabled"])
            _LOGGER.info(
                "Restored Tankwise enabled=%s demand=%s reason=%s",
                self.enabled,
                self.desired_on,
                self.reason,
            )

        tracked = {
            self.pump_entity,
            self.distance_entity,
            *self.toggle_entities,
        }
        self._unsubs.append(
            async_track_state_change_event(
                self.hass, list(tracked), self._async_state_changed
            )
        )
        self._unsubs.append(
            async_track_time_interval(
                self.hass,
                self._async_interval,
                timedelta(seconds=max(15, self.reconcile_interval)),
            )
        )

        if self.hass.is_running:
            self.hass.async_create_task(self._async_boot_recover())
        else:
            self._unsubs.append(
                self.hass.bus.async_listen_once(
                    EVENT_HOMEASSISTANT_STARTED, self._async_on_ha_started
                )
            )

        for entity_id in self.toggle_entities:
            state = self.hass.states.get(entity_id)
            self._last_toggle_states[entity_id] = (
                state.state if state is not None else None
            )

        self._notify_listeners()

    async def async_unload(self) -> None:
        """Detach listeners."""
        while self._unsubs:
            unsub = self._unsubs.pop()
            unsub()

    def async_add_listener(self, update_callback: Callable[[], None]) -> Callable[[], None]:
        """Register an entity update callback; return unsubscribe."""
        self._listeners.append(update_callback)

        @callback
        def remove() -> None:
            if update_callback in self._listeners:
                self._listeners.remove(update_callback)

        return remove

    @callback
    def _notify_listeners(self) -> None:
        for listener in list(self._listeners):
            listener()

    # ------------------------------------------------------------------ snapshot
    def snapshot(self) -> TankwiseSnapshot:
        """Build the current public snapshot."""
        distance = parse_float(self.hass.states.get(self.distance_entity))
        percent = None
        if distance is not None:
            percent = distance_to_percent(
                distance, self.full_distance, self.empty_distance
            )
        pump = is_on_state(self.hass.states.get(self.pump_entity))
        allowed = self._pump_allowed(distance)
        return TankwiseSnapshot(
            desired_on=self.desired_on,
            enabled=self.enabled,
            pump_on=pump,
            distance=distance,
            percent=percent,
            cycle_phase=self.cycle_phase,
            pump_allowed=allowed,
            reconcile_healthy=self.reconcile_healthy,
            last_error=self.last_error,
            reason=self.reason,
            attributes={
                ATTR_REASON: self.reason,
                ATTR_DISTANCE: distance,
                ATTR_PERCENT: percent,
                ATTR_CYCLE_PHASE: self.cycle_phase,
                ATTR_ALLOWED: allowed,
                ATTR_LAST_ERROR: self.last_error,
                ATTR_ENABLED: self.enabled,
            },
        )

    # ------------------------------------------------------------------ demand API
    async def async_set_demand(
        self,
        desired_on: bool,
        *,
        reason: str,
        force: bool = False,
    ) -> None:
        """Set persisted desired demand and reconcile."""
        if desired_on and not self.enabled:
            _LOGGER.info(
                "Ignoring demand ON — Tankwise controller is disabled (%s)", reason
            )
            return

        if desired_on and not force:
            distance = parse_float(self.hass.states.get(self.distance_entity))
            if distance is not None and distance >= self.off_threshold:
                _LOGGER.info(
                    "Ignoring demand ON (tank high: distance=%.1f >= %.1f)",
                    distance,
                    self.off_threshold,
                )
                desired_on = False
                reason = "blocked_high_level"

        changed = desired_on != self.desired_on
        self.desired_on = desired_on
        self.reason = reason

        if not desired_on:
            self.cycle_phase = PHASE_IDLE
            self._phase_started_at = None
            self._work_started_at = None
            self._failsafe_triggered = False
        elif self.cyclic_mode and self.cycle_phase == PHASE_IDLE:
            self.cycle_phase = PHASE_WORKING
            now = dt_util.utcnow()
            self._phase_started_at = now
            self._work_started_at = now

        await self._async_persist()
        if changed:
            self.hass.bus.async_fire(
                EVENT_DEMAND_CHANGED,
                {
                    "entry_id": self.entry_id,
                    "desired_on": self.desired_on,
                    "reason": reason,
                },
            )
        await self.async_reconcile(reason=f"demand:{reason}")
        self._notify_listeners()

    async def async_toggle_demand(self, *, reason: str = "toggle") -> None:
        """Toggle desired demand."""
        await self.async_set_demand(not self.desired_on, reason=reason)

    async def async_set_enabled(self, enabled: bool, *, reason: str = "ui") -> None:
        """Enable or disable automatic pump control (master kill switch)."""
        if enabled == self.enabled:
            self._notify_listeners()
            return

        self.enabled = enabled
        self.reason = "controller_enabled" if enabled else "controller_disabled"
        await self._async_persist()
        self.hass.bus.async_fire(
            EVENT_ENABLED_CHANGED,
            {
                "entry_id": self.entry_id,
                "enabled": self.enabled,
                "reason": reason,
            },
        )
        _LOGGER.warning(
            "Tankwise controller %s (%s)",
            "ENABLED" if enabled else "DISABLED",
            reason,
        )
        # When disabled, force pump OFF immediately and freeze automation.
        await self.async_reconcile(reason=f"enabled:{reason}")
        self._notify_listeners()

    async def _async_persist(self) -> None:
        await self._store.async_save(
            {
                "desired_on": self.desired_on,
                "enabled": self.enabled,
                "reason": self.reason,
            }
        )

    # ------------------------------------------------------------------ events
    @callback
    def _async_on_ha_started(self, _event: Event) -> None:
        self.hass.async_create_task(self._async_boot_recover())

    async def _async_boot_recover(self) -> None:
        """Reconcile safely after Home Assistant start."""
        self._started = True
        distance = parse_float(self.hass.states.get(self.distance_entity))
        if distance is not None and distance >= self.off_threshold:
            await self.async_set_demand(False, reason="boot_high_level", force=True)
        else:
            await self.async_reconcile(reason="boot_recovery")
        self._notify_listeners()

    async def _async_interval(self, _now: datetime) -> None:
        await self._async_evaluate_level()
        await self._async_evaluate_cycle()
        await self.async_reconcile(reason="interval")
        self._notify_listeners()

    async def _async_state_changed(self, event: Event) -> None:
        entity_id = event.data["entity_id"]
        new_state = event.data.get("new_state")
        old_state = event.data.get("old_state")

        if entity_id in self.toggle_entities and new_state is not None:
            old = old_state.state if old_state is not None else self._last_toggle_states.get(
                entity_id
            )
            self._last_toggle_states[entity_id] = new_state.state
            if old != STATE_ON and new_state.state == STATE_ON:
                await self.async_toggle_demand(reason=f"physical_toggle:{entity_id}")
                return

        if entity_id == self.distance_entity:
            await self._async_evaluate_level()
            await self.async_reconcile(reason="distance_changed")
            self._notify_listeners()
            return

        if entity_id == self.pump_entity:
            await self.async_reconcile(reason="pump_changed")
            await self._async_sync_leds()
            self._notify_listeners()

    # ------------------------------------------------------------------ level / hysteresis
    async def _async_evaluate_level(self) -> None:
        if not self.enabled:
            self._on_condition_since = None
            self._off_condition_since = None
            return

        distance = parse_float(self.hass.states.get(self.distance_entity))
        if distance is None:
            self._on_condition_since = None
            self._off_condition_since = None
            return

        now = dt_util.utcnow()
        percent = distance_to_percent(
            distance, self.full_distance, self.empty_distance
        )

        # Turn-on hysteresis: distance stays below on threshold
        if distance < self.on_threshold:
            if self._on_condition_since is None:
                self._on_condition_since = now
            held = (now - self._on_condition_since).total_seconds()
            if held >= self.on_hold and not self.desired_on:
                await self.async_set_demand(True, reason="hysteresis_on")
        else:
            self._on_condition_since = None

        # Turn-off hysteresis: distance stays above off threshold
        if distance > self.off_threshold:
            if self._off_condition_since is None:
                self._off_condition_since = now
            held = (now - self._off_condition_since).total_seconds()
            if held >= self.off_hold and self.desired_on:
                await self.async_set_demand(False, reason="hysteresis_off", force=True)
        else:
            self._off_condition_since = None

        await self._async_level_notifications(percent)

    async def _async_level_notifications(self, percent: float | None) -> None:
        if percent is None or not self.notify_service:
            return
        now = dt_util.utcnow()
        hold = int(
            self.config.get(
                CONF_LEVEL_NOTIFY_HOLD_SECONDS, DEFAULT_LEVEL_NOTIFY_HOLD_SECONDS
            )
        )
        low = float(self.config.get(CONF_LOW_LEVEL_PERCENT, DEFAULT_LOW_LEVEL_PERCENT))
        critical = float(
            self.config.get(
                CONF_CRITICAL_LEVEL_PERCENT, DEFAULT_CRITICAL_LEVEL_PERCENT
            )
        )

        if percent <= critical:
            if self._critical_since is None:
                self._critical_since = now
            if (
                (now - self._critical_since).total_seconds() >= hold
                and not self._critical_notified
            ):
                await self._async_notify(
                    "Tankwise critical level",
                    f"Tank level is critically low ({percent:.0f}%).",
                )
                self._critical_notified = True
        else:
            self._critical_since = None
            self._critical_notified = False

        if percent <= low:
            if self._low_since is None:
                self._low_since = now
            if (
                (now - self._low_since).total_seconds() >= hold
                and not self._low_notified
                and not self._critical_notified
            ):
                await self._async_notify(
                    "Tankwise low level",
                    f"Tank level is low ({percent:.0f}%).",
                )
                self._low_notified = True
        else:
            self._low_since = None
            self._low_notified = False

    # ------------------------------------------------------------------ cycle
    async def _async_evaluate_cycle(self) -> None:
        if not self.desired_on:
            self.cycle_phase = PHASE_IDLE
            return
        if not self.cyclic_mode:
            self.cycle_phase = PHASE_WORKING if self.desired_on else PHASE_IDLE
            self._phase_started_at = self._phase_started_at or dt_util.utcnow()
            self._work_started_at = self._work_started_at or dt_util.utcnow()
            return

        now = dt_util.utcnow()
        if self._phase_started_at is None:
            self.cycle_phase = PHASE_WORKING
            self._phase_started_at = now
            self._work_started_at = now
            return

        elapsed = (now - self._phase_started_at).total_seconds() / 60.0
        if self.cycle_phase == PHASE_WORKING and elapsed >= self.work_minutes:
            self.cycle_phase = PHASE_RESTING
            self._phase_started_at = now
            _LOGGER.info("Tankwise entering rest phase")
        elif self.cycle_phase == PHASE_RESTING and elapsed >= self.rest_minutes:
            self.cycle_phase = PHASE_WORKING
            self._phase_started_at = now
            self._work_started_at = now
            _LOGGER.info("Tankwise entering work phase")

        # Cyclic failsafe
        if self._work_started_at is not None and self.cycle_phase == PHASE_WORKING:
            on_minutes = (now - self._work_started_at).total_seconds() / 60.0
            limit = self.work_minutes + self.failsafe_margin_minutes
            pump_on = is_on_state(self.hass.states.get(self.pump_entity))
            if pump_on and on_minutes > limit and not self._failsafe_triggered:
                self._failsafe_triggered = True
                self.reconcile_healthy = False
                self.last_error = "cyclic_failsafe"
                await self.async_set_demand(False, reason="cyclic_failsafe", force=True)
                await self._async_notify(
                    "Tankwise failsafe",
                    "Pump stayed ON longer than work+margin; demand forced OFF.",
                )
                self.hass.bus.async_fire(
                    EVENT_FAULT,
                    {
                        "entry_id": self.entry_id,
                        "error": "cyclic_failsafe",
                    },
                )

    def _pump_allowed(self, distance: float | None) -> bool:
        if not self.enabled:
            return False
        if not self.desired_on:
            return False
        if distance is not None and distance >= self.off_threshold:
            return False
        if self.cyclic_mode and self.cycle_phase == PHASE_RESTING:
            return False
        return True

    # ------------------------------------------------------------------ reconciler
    async def async_reconcile(self, *, reason: str = "manual") -> None:
        """Ensure the physical pump matches desired demand + safety."""
        distance = parse_float(self.hass.states.get(self.distance_entity))

        # High-level safety: force desired OFF and pump OFF when tank is full/high.
        if distance is not None and distance >= self.off_threshold:
            if self.desired_on:
                self.desired_on = False
                self.reason = "safety_high_level"
                self.cycle_phase = PHASE_IDLE
                self._phase_started_at = None
                self._work_started_at = None
                await self._async_persist()
                self._notify_listeners()
            pump_on = is_on_state(self.hass.states.get(self.pump_entity))
            if pump_on:
                await self._async_call_pump("turn_off")

        await self._async_evaluate_cycle()
        allowed = self._pump_allowed(distance)
        pump_state = self.hass.states.get(self.pump_entity)
        pump_on = is_on_state(pump_state)

        if pump_on is None:
            self.reconcile_healthy = False
            self.last_error = "pump_unavailable"
            self._notify_listeners()
            return

        target_on = allowed
        if pump_on == target_on:
            self.reconcile_healthy = True
            if self.last_error in ("pump_unavailable", "reconcile_failed"):
                self.last_error = None
            await self._async_sync_leds()
            self.hass.bus.async_fire(
                EVENT_RECONCILE,
                {
                    "entry_id": self.entry_id,
                    "matched": True,
                    "target_on": target_on,
                    "reason": reason,
                },
            )
            return

        service = "turn_on" if target_on else "turn_off"
        success = await self._async_call_pump(service)
        if success:
            # Verify
            pump_on = is_on_state(self.hass.states.get(self.pump_entity))
            success = pump_on == target_on

        if success:
            self.reconcile_healthy = True
            self.last_error = None
        else:
            self.reconcile_healthy = False
            self.last_error = "reconcile_failed"
            _LOGGER.error(
                "Tankwise failed to reconcile pump to %s (%s)",
                target_on,
                reason,
            )
            if self.notify_service:
                await self._async_notify(
                    "Tankwise reconcile fault",
                    f"Could not set {self.pump_entity} to {'ON' if target_on else 'OFF'}.",
                )

        await self._async_sync_leds()
        self.hass.bus.async_fire(
            EVENT_RECONCILE,
            {
                "entry_id": self.entry_id,
                "matched": success,
                "target_on": target_on,
                "reason": reason,
            },
        )
        self._notify_listeners()

    async def _async_call_pump(self, service: str) -> bool:
        """Call turn_on/turn_off on the pump entity with retries."""
        domain = self.pump_entity.split(".", 1)[0]
        for attempt in range(1, self.reconcile_retries + 1):
            try:
                await self.hass.services.async_call(
                    domain,
                    service,
                    {"entity_id": self.pump_entity},
                    blocking=True,
                )
                return True
            except Exception as err:  # noqa: BLE001 — stubborn executor retries
                _LOGGER.warning(
                    "Pump %s attempt %s/%s failed: %s",
                    service,
                    attempt,
                    self.reconcile_retries,
                    err,
                )
        return False

    async def _async_sync_leds(self) -> None:
        pump_on = is_on_state(self.hass.states.get(self.pump_entity))
        if pump_on is None:
            return
        service = "turn_on" if pump_on else "turn_off"
        for entity_id in self.led_entities:
            domain = entity_id.split(".", 1)[0]
            led_on = is_on_state(self.hass.states.get(entity_id))
            if led_on == pump_on:
                continue
            try:
                await self.hass.services.async_call(
                    domain,
                    service,
                    {"entity_id": entity_id},
                    blocking=False,
                )
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("LED sync failed for %s: %s", entity_id, err)

    async def _async_notify(self, title: str, message: str) -> None:
        if not self.notify_service:
            return
        service = self.notify_service
        if service.startswith("notify."):
            domain, name = service.split(".", 1)
        else:
            domain, name = "notify", service
        try:
            await self.hass.services.async_call(
                domain,
                name,
                {"title": title, "message": message},
                blocking=False,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Notify failed via %s: %s", self.notify_service, err)
