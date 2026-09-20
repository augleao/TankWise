# TankWise Add-on

Painel web do **TankWise** no Supervisor (estilo Ingress), para configurar e monitorar a bomba/caixa d’água.

## Requisitos

1. Home Assistant OS / Supervised
2. Integração **Tankwise** instalada via HACS (mesma pasta `custom_components/tankwise` deste repositório) e adicionada em **Dispositivos e serviços**

O add-on **não** substitui a lógica da bomba — ele fala com a integração via API do Home Assistant (`SUPERVISOR_TOKEN`).

## Instalação

1. Em **Configurações → Add-ons → Add-on store → ⋮ → Repositórios**
2. Adicione: `https://github.com/augleao/TankWise`
3. Atualize a loja, instale **TankWise**, inicie
4. Abra o painel pela barra lateral (**TankWise**) ou **Abrir IU web**

## Uso

- **Monitor** — nível do tanque, demanda, bomba, ligar/desligar automação; toque no tanque/bomba para ver o histórico
- **Entidades** — switch da bomba, sensor de distância, calibração e reconciliação automática
- **Ciclo / histerese** — limiares, holds, trabalho/descanso
- **Alertas** — notify opcional + teste de alerta
- **Logs** — eventos persistidos (7 dias)
- Idioma da UI: inglês ou português, conforme o Home Assistant

## Desenvolvimento local

```bash
export SUPERVISOR_TOKEN=seu_token_long_lived
export HA_URL=http://homeassistant.local:8123
cd tankwise/rootfs/app
python3 main.py
```

Abra `http://127.0.0.1:8099`.
