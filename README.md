# Tankwise

**Tankwise** is a Home Assistant custom integration that manages an artesian-well (or similar) pump from a **persisted desired demand**, not by blindly toggling a relay.

This is **local pump/tank control logic** inside Home Assistant. It is **not** a cloud water utility service, Supervisor add-on, or companion API.

## What it does

- Keeps a persisted **Demand** switch as the source of truth (replacement for `var.bomba`-style helpers)
- Runs a **reconciler** (“stubborn executor”) so the physical pump switch matches demand, with retries
- Optionally drives demand from a **distance-to-water** sensor using **hysteresis** and hold times
- Exposes a calibrated **tank level %** sensor (lower distance = fuller tank)
- Optional **work/rest** cycling, physical toggle inputs, LED mirrors, notifications, and boot recovery

## What it does not do

- No Supervisor add-on / Docker runtime
- No external companion service
- No COPASA valve interlocking, LCD publishing, or camera automations (documented as out of scope for v1)

## How it works

```
Distance sensor ──► hysteresis ──► Desired Demand (persisted)
                                        │
UI / services / physical toggles ───────┘
                                        │
                                        ▼
                              Reconciler (interval + events)
                                        │
                                        ▼
                              Pump switch entity (user-selected)
```

1. **Desired demand** is what you (or automation) set.
2. The **reconciler** is the only path that turns the physical pump on/off.
3. High tank level (`distance >= off threshold`) forces demand OFF and pump OFF.
4. In cyclic mode, rest phases keep the pump OFF even when demand is ON.

### Distance semantics

Your sensor reports **distance to water**. A **lower** reading means a **fuller** tank.

- **Full distance** — smaller number (e.g. `82`)
- **Empty distance** — larger number (e.g. `120`)
- Percentage: `100%` at full, `0%` at empty, clamped to 0–100

## Install (HACS)

1. HACS → **Integrations** → **⋮** → **Custom repositories**
2. Add `https://github.com/augleao/TankWise` as category **Integration**
3. Install **Tankwise**, then restart Home Assistant
4. Settings → Devices & services → **Add integration** → **Tankwise**

Or copy `custom_components/tankwise` into your HA `config/custom_components/` folder and restart.

## Config flow overview

| Step | What you configure |
|------|--------------------|
| Setup | Pump switch, distance sensor, full/empty calibration, % sensor |
| Hysteresis | On/off thresholds + hold times, reconcile interval |
| Optional | Work/rest minutes, toggles, LEDs, notify service, level alerts |

Defaults are inspired by a typical setup (on `< 82` for 2 min, off `> 96` for 2 min) but **nothing is hardcoded** — every entity and threshold is selected in the UI. Change thresholds later via **Configure** (options flow).

## Entities (v1)

| Entity | Role |
|--------|------|
| `switch.*_demand` | Persisted desired demand |
| `sensor.*_tank_level` | Fill percentage (optional) |
| `sensor.*_tank_distance` | Distance helper |
| `sensor.*_cycle_phase` | `idle` / `working` / `resting` |
| `binary_sensor.*_pump_running` | Physical pump ON |
| `binary_sensor.*_reconcile_fault` | Reconcile/problem flag |

## Services

- `tankwise.turn_on_demand`
- `tankwise.turn_off_demand`
- `tankwise.toggle_demand`
- `tankwise.reconcile_now`

Optional `entry_id` when multiple Tankwise instances exist.

## Migrating from YAML automations

| Old concept | Tankwise |
|-------------|----------|
| `var.bomba` / helper demand | `switch.tankwise_*_demand` |
| Direct `switch.turn_on` on the pump from many automations | Let the reconciler own the pump |
| `timer.timer_bomba` / `timer.timer_descanso` | Built-in work/rest (`rest=0` = continuous) |
| Physical button automations | Toggle entities in config |
| LED automations | LED entity list (mirrors real pump state) |
| Notify automations | Optional notify service + low/critical % |

Disable or remove the old pump automations after Tankwise is configured so they do not fight the reconciler.

## IoT class

`calculated` — Tankwise does not talk to hardware itself. It reads user-selected Home Assistant entities, computes demand/level/cycle state, and calls services on those entities.

## Requirements

- Home Assistant **2024.8+**
- No extra Python packages (`requirements: []`)

## License

MIT — see [LICENSE](LICENSE).

## Links

- Issues: https://github.com/augleao/TankWise/issues
- Releases: https://github.com/augleao/TankWise/releases
