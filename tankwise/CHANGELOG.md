## 1.2.2

- Defaults de calibração/limiares em cm (alinhados à integração 0.6.4)

## 1.2.1

- Campo **intervalo mínimo automático ligar↔desligar** (`min_auto_switch_seconds`)

## 1.2.0

- Controle da bomba e sensor de distância: modal de busca (como botões/LEDs), com valor ao vivo ao lado
- Poll na aba de configuração não sobrescreve mais escolhas locais antes de salvar

## 1.1.1

- Logs legíveis no celular (detalhes em linha própria)

# Changelog — TankWise Add-on

## 1.1.0

- i18n EN/PT conforme o idioma do Home Assistant
- Histórico gráfico de nível e bomba (1h / 1d / 1 semana / 1 mês)
- Toggle único de automação e de demanda da bomba
- Reconciliação automática: intervalo em minutos + habilitar/desabilitar
- Botão Testar alertas
- Proxy `/api/language` para ler o idioma do HA

## 1.0.3

- Notificações multi-seleção (mesmo fluxo dos botões/LEDs)

## 1.0.2

- Seletor de limiares em distância ou %
- Conversão automática ao trocar a unidade

## 1.0.1

- Proxy de logs da integração
- Exibe versão no título
- Aba Logs

## 1.0.0

- Primeira versão: UI Ingress com monitor do tanque, pickers de entidades, ciclo e demanda manual
- Proxy para a API HTTP da integração (`/api/tankwise/...`)
