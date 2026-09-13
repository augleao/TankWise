# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-03-22

### Fixed

- Sidebar panel registration so **Tankwise** appears in the left menu (not only the device page)
- Hard-depend on `frontend` / `panel_custom` and retry panel setup on config entry load
- Use `frontend.async_register_built_in_panel` with keyword args for newer Home Assistant cores

## [0.3.0] - 2026-03-22

### Added

- Friendly sidebar dashboard (OneDrive Backup Machine style) with:
  - live tank level graphic and pump status
  - entity pickers for pump / distance / toggles / LEDs
  - timed work/rest controls
  - manual demand ON/OFF (environment variable 1/0)
  - calibration, hysteresis and notification settings

## [0.2.2] - 2026-03-22

### Fixed

- Config flow HTTP 500 on install: lazy-load panel/websockets so package import cannot crash the flow
- Hardened panel static-path registration for older Home Assistant cores
- Install form uses official entity/number selectors (reliable frontend serialization)

## [0.2.1] - 2026-03-22

### Fixed

- Config flow HTTP 400 on install by using a minimal single-step flow (plain entity IDs / numbers)
- Sidebar panel registration no longer blocks integration setup if it fails

## [0.2.0] - 2026-03-22

### Added

- Sidebar **Tankwise** panel (add-on style UI) to pick entities and tune all parameters graphically
- WebSocket API for the panel: list / get_config / update_config / set_enabled / set_demand / reconcile

### Fixed

- Config flow HTTP 400 on setup by removing nested `section()` schemas (flat multi-step forms)
- Synced strings/translations with the actual setup steps

## [0.1.1] - 2026-03-22

### Added

- Master **Controller** switch to enable/disable Tankwise control (forces pump OFF when disabled)
- Services `tankwise.enable_controller` / `tankwise.disable_controller`
- Friendlier multi-step config wizard with grouped sections and options menu

## [0.1.0] - 2026-03-22

### Added

- HACS-ready custom integration `tankwise` with UI config flow and options flow
- Persisted **Demand** switch as desired-state source of truth
- Stubborn reconciler with retries, interval + state-change triggers, and boot recovery
- Distance-sensor hysteresis (configurable on/off thresholds and hold times)
- Optional tank level percentage sensor and distance helper
- Optional work/rest cycling (`rest=0` continuous) with cyclic failsafe
- Optional physical toggle inputs, LED feedback mirrors, and notify service
- Low / critical level notifications with hold time
- Services: `turn_on_demand`, `turn_off_demand`, `toggle_demand`, `reconcile_now`
- Pump running and reconcile fault binary sensors
- GitHub Actions for HACS validation and hassfest

[0.2.0]: https://github.com/augleao/TankWise/releases/tag/v0.2.0
[0.1.1]: https://github.com/augleao/TankWise/releases/tag/v0.1.1
[0.1.0]: https://github.com/augleao/TankWise/releases/tag/v0.1.0
