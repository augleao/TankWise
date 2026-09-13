# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/augleao/TankWise/releases/tag/v0.1.0
