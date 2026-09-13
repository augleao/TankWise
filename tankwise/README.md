# TankWise

Add-on do Supervisor com painel web (Ingress) para o **TankWise**.

## O que faz

Dashboard local para:

- Ver o nível da caixa d’água e o estado da bomba
- Escolher entidades (bomba, distância, botões, LEDs)
- Ajustar calibração, histerese e ciclo trabalho/descanso
- Ligar/desligar automação e demanda manual (1/0)

A lógica da bomba continua na **integração** HACS (`custom_components/tankwise`). Este add-on é só a interface.

## Instalação rápida

1. HACS → instale a integração **Tankwise** e adicione em Dispositivos e serviços  
2. Add-on store → repositório `https://github.com/augleao/TankWise` → instale **TankWise**  
3. Inicie e abra pela barra lateral

Detalhes em [DOCS.md](DOCS.md).
