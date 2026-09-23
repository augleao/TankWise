# Tankwise

**Tankwise** controla a bomba do poço artesiano a partir de uma **demanda desejada persistida** (não toggla o relé “no escuro”).

Há duas peças no mesmo repositório:

1. **Integração HACS** (`custom_components/tankwise`) — lógica da bomba, sensores e serviços  
2. **Add-on do Supervisor** (`tankwise/`) — painel web Ingress (estilo OneDrive Backup Machine)

## O que faz

- Mantém o switch **Demand** como fonte da verdade
- **Reconciliador** teimoso: a bomba física segue a demanda, com retries
- Histerese pelo sensor de **distância até a água** + tempos de hold
- Sensor de **nível %** (distância menor = tanque mais cheio)
- Ciclo trabalho/descanso, botões físicos, LEDs e notificações (opcional)
- Interface em **inglês ou português**, conforme o idioma do Home Assistant
- Histórico gráfico de nível/bomba e logs persistentes (7 dias)
- **Card Lovelace** para colocar os gráficos em qualquer dashboard do HA

## Como funciona

```
Sensor distância ──► histerese ──► Demanda desejada (persistida)
                                        │
UI / serviços / botões ─────────────────┘
                                        │
                                        ▼
                              Reconciliador
                                        │
                                        ▼
                              Switch da bomba
```

### Distância

- **Cheio** — valor menor (ex.: `82`)
- **Vazio** — valor maior (ex.: `120`)
- `%` = 100 no cheio, 0 no vazio

## Instalação recomendada (HA OS)

### 1) Integração (HACS)

1. HACS → Integrações → ⋮ → Repositórios personalizados  
2. URL: `https://github.com/augleao/TankWise` · categoria **Integration**  
3. Instale **Tankwise**, reinicie o HA  
4. Configurações → Dispositivos e serviços → **Adicionar integração** → Tankwise  

### 2) Add-on (painel web)

1. Configurações → Add-ons → Loja → ⋮ → **Repositórios**  
2. Adicione o **mesmo** URL: `https://github.com/augleao/TankWise`  
3. Atualize a loja → instale **TankWise** → **Iniciar**  
4. Abra pela barra lateral (**TankWise**) ou “Abrir IU web”

No painel você escolhe entidades, calibração, timers e demanda manual ON/OFF.

> Precisa da integração **0.4.0+** (API HTTP `/api/tankwise/...`) para o add-on funcionar.

Instalação só com pasta: copie `custom_components/tankwise` para `config/custom_components/` e reinicie.

## Painel lateral da integração (opcional)

A integração também registra um painel custom no sidebar. O add-on Ingress é a experiência principal em HA OS.

## Card nos dashboards do Home Assistant

A integração registra automaticamente o card **Tankwise history** (`custom:tankwise-history-card`).

1. Abra qualquer dashboard → **Editar** → **Adicionar cartão**
2. Procure por **Tankwise history** (ou use YAML abaixo)
3. Escolha a instalação (se houver mais de uma) e o período

```yaml
type: custom:tankwise-history-card
# entry_id: abc123   # opcional se só existir uma instalação
name: Caixa d'água
range: 1d            # 1h | 1d | 1w | 1m
show_range_tabs: true
refresh_seconds: 60
```

O card usa o mesmo histórico do painel (nível % + bomba ON/OFF). Após atualizar a integração, recarregue o frontend do HA (Ctrl+F5) se o card não aparecer na lista.

## Entidades

| Entidade | Função |
|----------|--------|
| `switch.*_controller` | Master — OFF desliga Tankwise e força bomba OFF |
| `switch.*_demand` | Demanda desejada persistida |
| `sensor.*_tank_level` | Nível % (opcional) |
| `sensor.*_tank_distance` | Distância |
| `sensor.*_cycle_phase` | `idle` / `working` / `resting` |
| `binary_sensor.*_pump_running` | Bomba física ON |
| `binary_sensor.*_reconcile_fault` | Falha de reconciliação |

## Serviços

`turn_on_demand`, `turn_off_demand`, `toggle_demand`, `reconcile_now`, `enable_controller`, `disable_controller`  
(campo opcional `entry_id` se houver várias instâncias)

## API HTTP (para o add-on)

- `GET /api/tankwise/entries`
- `GET /api/tankwise/entries/{id}`
- `POST /api/tankwise/entries/{id}/config`
- `POST /api/tankwise/entries/{id}/enabled`
- `POST /api/tankwise/entries/{id}/demand`
- `POST /api/tankwise/entries/{id}/reconcile`
- `GET /api/tankwise/entities`

## Requisitos

- Home Assistant **2024.8+**
- Add-on: Home Assistant OS / Supervised

## Licença

MIT — [LICENSE](LICENSE)

## Links

- Issues: https://github.com/augleao/TankWise/issues  
- Releases: https://github.com/augleao/TankWise/releases  
- Add-on docs: [tankwise/DOCS.md](tankwise/DOCS.md)
