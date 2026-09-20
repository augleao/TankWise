# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.3] - 2026-09-20

### Fixed
- Aba Logs no celular: o layout em 3 colunas escondia nível, distância e demais detalhes. Agora cada evento mostra data/hora, nome e detalhes em linhas empilhadas.

## [0.5.2] - 2026-09-20

### Fixed
- Histórico do gráfico: compatibilidade com a API do Recorder (`state_changes_during_period` sem `significant_changes_only` em algumas versões do HA).

## [0.5.1] - 2026-09-20

### Fixed
- Sidebar panel blank screen: `async def _testNotify()` was invalid JavaScript (SyntaxError). Renamed to `async _testNotify()`.

## [0.5.0] - 2026-09-20

### Added
- **i18n EN/PT**: painel lateral, add-on e mensagens de notificação/histórico seguem o idioma do Home Assistant (`pt*` → português, demais → inglês).
- **Logs persistentes** (7 dias) no disco do HA, com nível (%) e distância nos eventos da bomba.
- **Histórico gráfico** de nível e bomba (1h / 1d / 1 semana / 1 mês) ao tocar no tanque ou no status da bomba.
- Botão **Testar alertas** para enviar notificação de teste aos destinos configurados.
- Tooltip explicando o seletor de **Instalação** quando há mais de uma entrada Tankwise.

### Changed
- Automação: um único toggle Ligar/Desligar no cabeçalho (substitui os dois botões).
- Demanda manual: um único toggle Ligar/Desligar bomba.
- Reconciliação na aba Entidades: intervalo em minutos + habilitar/desabilitar; removido “Reconciliar agora”.

## [0.4.6] - 2026-09-14

### Changed
- **Notificações de nível**: o campo único de serviço notify passou a usar o mesmo fluxo dos botões/LEDs — botão **Adicionar**, modal com busca, multi-seleção e × vermelho para remover (painel lateral + add-on).
- Configuração passa a gravar `notify_services` (lista). O valor antigo `notify_service` continua sendo lido e migrado automaticamente.

## [0.4.5] - 2026-09-14

### Added
- **Botões físicos** and **LEDs / feedback**: add via button → search modal (multi-select), then manage as a list with red × to remove (sidebar panel + add-on UI).

## [0.4.4] - 2026-09-14

### Fixed
- Demand hysteresis now re-evaluates every **5s**, not only on distance state changes or the reconcile interval. With a stable ultrasonic reading and hold=120s / reconcile=120s, demand could previously take ~240s (or never seem to fire).
- Logs tab now renders the event list (button existed, content section was missing).
- Monitor shows live hold progress (elapsed/target) while waiting to turn demand on/off.

## [0.4.3] - 2026-09-14

### Fixed
- Sidebar panel JS cache bust used a stale hardcoded `?v=0.3.1`, so browsers kept the old UI without the Distância / Porcentagem (%) toggle. Cache bust now follows `manifest.json` version (`?v=0.4.3`).

## [0.4.2] - 2026-03-22

### Added
- Threshold unit selector: configure demand hysteresis in **distance** or **percent (%)**
- UI converts values when switching units (panel + add-on)

### Changed
- Validation depends on mode: distance requires on > off; percent requires on% < off%

## [0.4.1] - 2026-03-22

### Fixed
- Ultrasonic hysteresis polarity: turn **ON** when distance stays above the on-threshold (emptier), turn **OFF** when below the off-threshold (fuller)
- Full-tank safety now uses low distance (`<= off`), not high distance
- Auto-migrate inverted thresholds (`on < off`) by swapping them on setup

### Added
- **Logs** tab in the sidebar panel / add-on UI (recent controller events)
- Version badge next to the Tankwise title
- Clearer calibration hints (ligar > desligar)

## [0.4.0] - 2026-03-22

### Added

- Supervisor **add-on** (`tankwise/`) with Ingress web UI (tank graphic, entity pickers, timers, manual demand)
- HTTP REST API under `/api/tankwise/...` for the add-on (list/update config, demand, enable, reconcile, entities)
- Shared `api_common` module used by websocket and HTTP views
- `repository.yaml` so the GitHub repo can be added as an add-on store repository

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
