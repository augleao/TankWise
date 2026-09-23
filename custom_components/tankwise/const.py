"""Constants for the Tankwise integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "tankwise"
MANUFACTURER: Final = "Tankwise"
MODEL: Final = "Well pump controller"

# Config entry data / options keys
CONF_PUMP_ENTITY: Final = "pump_entity"
CONF_DISTANCE_ENTITY: Final = "distance_entity"
CONF_FULL_DISTANCE: Final = "full_distance"
CONF_EMPTY_DISTANCE: Final = "empty_distance"
CONF_EXPOSE_PERCENTAGE: Final = "expose_percentage"

CONF_ON_THRESHOLD: Final = "on_threshold"
CONF_OFF_THRESHOLD: Final = "off_threshold"
CONF_THRESHOLD_MODE: Final = "threshold_mode"
THRESHOLD_MODE_DISTANCE: Final = "distance"
THRESHOLD_MODE_PERCENT: Final = "percent"
CONF_ON_HOLD_SECONDS: Final = "on_hold_seconds"
CONF_OFF_HOLD_SECONDS: Final = "off_hold_seconds"
CONF_MIN_AUTO_SWITCH_SECONDS: Final = "min_auto_switch_seconds"

CONF_RECONCILE_INTERVAL: Final = "reconcile_interval"
CONF_RECONCILE_RETRIES: Final = "reconcile_retries"
CONF_RECONCILE_ENABLED: Final = "reconcile_enabled"

CONF_WORK_MINUTES: Final = "work_minutes"
CONF_REST_MINUTES: Final = "rest_minutes"
CONF_FAILSAFE_MARGIN_MINUTES: Final = "failsafe_margin_minutes"

CONF_TOGGLE_ENTITIES: Final = "toggle_entities"
CONF_LED_ENTITIES: Final = "led_entities"
CONF_NOTIFY_SERVICE: Final = "notify_service"  # legacy single string
CONF_NOTIFY_SERVICES: Final = "notify_services"
CONF_LOW_LEVEL_PERCENT: Final = "low_level_percent"
CONF_CRITICAL_LEVEL_PERCENT: Final = "critical_level_percent"
CONF_LEVEL_NOTIFY_HOLD_SECONDS: Final = "level_notify_hold_seconds"

# Defaults inspired by the YAML automations this replaces
DEFAULT_FULL_DISTANCE: Final = 82.0
DEFAULT_EMPTY_DISTANCE: Final = 120.0
# Ultrasonic: higher distance = emptier. Turn ON when empty, OFF when full.
DEFAULT_ON_THRESHOLD: Final = 101.0
DEFAULT_OFF_THRESHOLD: Final = 84.0
DEFAULT_ON_HOLD_SECONDS: Final = 120
DEFAULT_OFF_HOLD_SECONDS: Final = 120
# Minimum gap between opposite automatic pump commands (ON↔OFF).
# Manual demand changes bypass this. Protects the well pump from short-cycling.
DEFAULT_MIN_AUTO_SWITCH_SECONDS: Final = 300
# Ignore pump state echoes right after we issue a command (Sonoff flicker).
PUMP_COMMAND_ECHO_GRACE_SECONDS: Final = 3
DEFAULT_RECONCILE_INTERVAL: Final = 120  # seconds (2 minutes)
DEFAULT_RECONCILE_RETRIES: Final = 3
DEFAULT_RECONCILE_ENABLED: Final = True
DEFAULT_WORK_MINUTES: Final = 0
DEFAULT_REST_MINUTES: Final = 0
DEFAULT_FAILSAFE_MARGIN_MINUTES: Final = 5
DEFAULT_LOW_LEVEL_PERCENT: Final = 60.0
DEFAULT_CRITICAL_LEVEL_PERCENT: Final = 25.0
DEFAULT_LEVEL_NOTIFY_HOLD_SECONDS: Final = 120
DEFAULT_EXPOSE_PERCENTAGE: Final = True
DEFAULT_THRESHOLD_MODE: Final = THRESHOLD_MODE_DISTANCE
DEFAULT_ON_PERCENT: Final = 30.0
DEFAULT_OFF_PERCENT: Final = 95.0

# Attributes / events
ATTR_REASON: Final = "reason"
ATTR_DISTANCE: Final = "distance"
ATTR_PERCENT: Final = "percent"
ATTR_CYCLE_PHASE: Final = "cycle_phase"
ATTR_ALLOWED: Final = "allowed"
ATTR_LAST_ERROR: Final = "last_error"
ATTR_ENABLED: Final = "enabled"

EVENT_DEMAND_CHANGED: Final = f"{DOMAIN}_demand_changed"
EVENT_RECONCILE: Final = f"{DOMAIN}_reconcile"
EVENT_FAULT: Final = f"{DOMAIN}_fault"
EVENT_ENABLED_CHANGED: Final = f"{DOMAIN}_enabled_changed"

# Services
SERVICE_TURN_ON_DEMAND: Final = "turn_on_demand"
SERVICE_TURN_OFF_DEMAND: Final = "turn_off_demand"
SERVICE_TOGGLE_DEMAND: Final = "toggle_demand"
SERVICE_RECONCILE_NOW: Final = "reconcile_now"
SERVICE_ENABLE_CONTROLLER: Final = "enable_controller"
SERVICE_DISABLE_CONTROLLER: Final = "disable_controller"

# Cycle phases
PHASE_IDLE: Final = "idle"
PHASE_WORKING: Final = "working"
PHASE_RESTING: Final = "resting"

# Storage
STORAGE_VERSION: Final = 1
STORAGE_KEY: Final = f"{DOMAIN}.demand"
LOG_STORAGE_VERSION: Final = 1
LOG_STORAGE_KEY: Final = f"{DOMAIN}.event_log"
LOG_RETENTION_DAYS: Final = 7
LOG_QUERY_MAX: Final = 2000

# Events that always record tank level (%) and ultrasonic distance
PUMP_RELATED_LOG_EVENTS: Final = frozenset(
    {
        "demand_changed",
        "blocked_full_level",
        "enabled_changed",
        "on_condition_armed",
        "on_condition_cleared",
        "off_condition_armed",
        "off_condition_cleared",
        "pump_command",
        "pump_command_blocked_cooldown",
        "pump_reconcile_ok",
        "pump_reconcile_failed",
        "safety_full_level",
        "cyclic_failsafe",
        "boot_recovery",
    }
)

# Level history chart ranges (UI + API)
LEVEL_HISTORY_RANGE_1H: Final = "1h"
LEVEL_HISTORY_RANGE_1D: Final = "1d"
LEVEL_HISTORY_RANGE_1W: Final = "1w"
LEVEL_HISTORY_RANGE_1M: Final = "1m"
LEVEL_HISTORY_RANGES: Final = (
    LEVEL_HISTORY_RANGE_1H,
    LEVEL_HISTORY_RANGE_1D,
    LEVEL_HISTORY_RANGE_1W,
    LEVEL_HISTORY_RANGE_1M,
)
LEVEL_HISTORY_MAX_POINTS: Final = 240
