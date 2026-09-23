/**
 * Tankwise UI i18n — English + Portuguese.
 * Language follows Home Assistant (pt* → Portuguese, otherwise English).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.TankwiseI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STRINGS = {
    en: {
      brand_sub: "Friendly control for the well pump and water tank.",
      automation_on: "Automation active",
      automation_off: "Automation off",
      enable_automation: "Enable automation",
      disable_automation: "Disable automation",
      no_install:
        "No Tankwise installation found.<br/>In Settings → Devices & services, add the Tankwise integration.",
      installation: "Installation",
      installation_tip:
        "Select which Tankwise installation you are controlling in this panel. Home Assistant allows adding the integration more than once (e.g. two homes or two wells). Each option shows the installation name; if automation is off, it shows the (OFF) suffix. This is not an entity list — these are Tankwise installations configured under Devices & services.",
      tab_monitor: "Monitor",
      tab_config: "Entities & calibration",
      tab_cycle: "Timing",
      tab_alerts: "Alerts",
      tab_logs: "Logs",
      live_status: "Live status",
      live_status_desc:
        "Tank volume, pump state and manual demand control (environment variable).",
      controller: "Controller",
      demand: "Demand",
      physical_pump: "Physical pump",
      distance: "Distance",
      level: "Level",
      phase: "Phase",
      hold_on:
        "Hold to turn on: {elapsed}s / {target}s (level ≤ on threshold)",
      hold_off:
        "Hold to turn off: {elapsed}s / {target}s (level ≥ off threshold)",
      tank_hint: "tap to view chart",
      tank_aria: "Open tank level and pump chart",
      tank_label: "WATER TANK",
      pump_on: "PUMP ON",
      pump_off: "PUMP OFF",
      manual_title: "Manual control",
      manual_desc:
        "Turn the pump on or off via persisted demand. The reconciler applies it to the physical pump.",
      pump_section: "Pump (persisted demand)",
      turn_pump_on: "Turn pump on",
      turn_pump_off: "Turn pump off",
      maintenance: "Maintenance",
      refresh: "Refresh",
      entities_title: "Entities",
      entities_desc:
        "Select the pump switch and the distance sensor (as in the OneDrive Backup panel).",
      pump_control: "Pump control *",
      distance_sensor: "Distance sensor *",
      distance_hint:
        "Prefer a meter sensor (e.g. sensor.tank_distance), not the % one.",
      physical_buttons: "Physical buttons (optional)",
      no_buttons: "No buttons added.",
      add_buttons: "Add buttons",
      buttons_hint:
        "Each button toggles pump demand (0↔1). You can add several.",
      leds_title: "LEDs / feedback (optional)",
      no_leds: "No LED/feedback added.",
      add_leds: "Add LEDs",
      leds_hint: "Devices that show pump status. You can add several.",
      choose_pump: "Choose pump",
      change_pump: "Change pump",
      choose_distance: "Choose distance sensor",
      change_distance: "Change distance sensor",
      no_pump_entity: "No pump control selected.",
      no_distance_entity: "No distance sensor selected.",
      modal_pump_title: "Choose pump control",
      modal_pump_hint:
        "Search and select the switch that controls the physical pump (one only).",
      modal_distance_title: "Choose distance sensor",
      modal_distance_hint:
        "Search and select the tank distance sensor (one only). Prefer a meter reading, not the % one.",
      select_entity: "Select",
      live_unavailable: "—",
      live_on: "ON",
      live_off: "OFF",
      calibration_title: "Tank calibration",
      calibration_desc:
        "Lower distance = fuller tank (ultrasonic).",
      full_distance: "Full distance",
      empty_distance: "Empty distance",
      threshold_unit: "Threshold unit",
      unit_distance: "Distance",
      unit_percent: "Percent (%)",
      threshold_unit_hint:
        "Choose whether on/off thresholds use sensor distance or tank level %.",
      on_below_percent: "Turn demand on below (%)",
      on_below_percent_hint:
        "Turns on when level is ≤ this %. Must be lower than the off threshold (e.g. 30).",
      off_above_percent: "Turn demand off above (%)",
      off_above_percent_hint:
        "Turns off when level is ≥ this % (e.g. 95).",
      on_threshold_distance: "On threshold (distance ≥)",
      on_threshold_distance_hint:
        "Turns on when distance rises above this value (emptier tank). Must be greater than the off threshold.",
      off_threshold_distance: "Off threshold (distance ≤)",
      off_threshold_distance_hint:
        "Turns off when distance falls below this value (fuller tank).",
      hold_on_s: "On hold (s)",
      hold_off_s: "Off hold (s)",
      min_auto_switch_s: "Min. auto ON↔OFF interval (s)",
      min_auto_switch_hint:
        "Minimum gap between opposite automatic pump commands. Manual demand bypasses this. Default 300s (5 min).",
      expose_percent: "Expose level sensor (%)",
      save_config: "Save configuration",
      reconcile_title: "Reconciliation",
      reconcile_desc:
        "Reconciliation compares desired demand with the real pump state and fixes differences (turns the physical pump on/off when needed, respecting safety rules).",
      reconcile_interval: "Automatic interval (minutes)",
      reconcile_interval_hint:
        "How often the system checks and aligns the pump when automatic reconciliation is enabled.",
      enable_reconcile: "Enable automatic reconciliation",
      disable_reconcile: "Disable automatic reconciliation",
      save_interval: "Save interval",
      cycle_title: "Timed operation",
      cycle_desc:
        "When enabled, the pump runs in work/rest cycles. Off = continuous while demand is on.",
      use_timing: "Use timing (work / rest)",
      work_period: "On period (min)",
      rest_period: "Off period (min)",
      failsafe_margin: "Failsafe margin (min)",
      save_timing: "Save timing",
      alerts_title: "Level notifications",
      alerts_desc: "Alerts when the tank is low or critical.",
      notify_services: "Notify services",
      no_notify: "No notify service added.",
      add_notify: "Add notify",
      notify_hint:
        "You can add several targets (phone, Telegram, etc.). Each alert is sent to all.",
      low_level: "Low level (%)",
      critical_level: "Critical level (%)",
      notify_hold: "Notification hold (s)",
      save_alerts: "Save alerts",
      test_alerts: "Test alerts",
      logs_title: "Controller logs",
      logs_desc:
        "Events persisted on Home Assistant disk (last 7 days). Pump-related events include level (%) and distance.",
      refresh_logs: "Refresh logs",
      no_events:
        "No events yet. Change demand, wait for threshold hold, or use a physical button, then refresh.",
      history_title: "Level and pump",
      range_1h: "1 hour",
      range_1d: "1 day",
      range_1w: "1 week",
      range_1m: "1 month",
      loading_history: "Loading history…",
      chart_level: "Level",
      chart_tank: "water tank",
      chart_pump: "pump",
      chart_pump_label: "Pump",
      chart_no_data: "No data in this period",
      chart_no_level: "No level data",
      chart_no_pump: "No pump data",
      close: "Close",
      cancel: "Cancel",
      add_selected: "Add selected",
      search_entity: "Search entity…",
      search_notify: "Search notify service…",
      none_found_entity: "No entity found.",
      none_found_notify: "No notify service found.",
      remove: "Remove",
      modal_buttons_title: "Add physical buttons",
      modal_buttons_hint:
        "Search and select one or more buttons/switches that toggle demand.",
      modal_leds_title: "Add LEDs / feedback",
      modal_leds_hint:
        "Search and select one or more devices that show pump status.",
      modal_notify_title: "Add notify services",
      modal_notify_hint:
        "Search and select one or more targets (e.g. notify.mobile_app_your_phone).",
      msg_saved: "Configuration saved. The controller is already using the new settings.",
      msg_automation_on: "Automation enabled.",
      msg_automation_off: "Automation disabled (pump forced OFF).",
      msg_demand_on: "Manual demand ON (environment variable = 1).",
      msg_demand_off: "Manual demand OFF (environment variable = 0).",
      msg_reconcile_on: "Automatic reconciliation enabled.",
      msg_reconcile_off: "Automatic reconciliation disabled.",
      msg_test_sent: "Test notification sent.",
      addon_sub: "Pump control by water tank level",
      loading: "loading…",
      automation_badge_off: "automation OFF",
      demand_badge_on: "demand ON",
      demand_badge_off: "demand OFF",
      status_automation: "Automation",
      status_on: "on",
      status_off: "off",
      status_allowed: "Allowed",
      status_yes: "yes",
      status_no: "no",
      status_reason: "Reason",
      empty_title: "Integration not configured yet",
      empty_steps:
        "1. Install <strong>Tankwise</strong> via HACS<br />2. In <em>Devices & services</em>, add the Tankwise integration<br />3. Come back here and refresh",
      entities_addon_desc: "Select pump, distance sensor and optionals.",
      pump_switch: "Pump switch",
      buttons_optional: "Physical buttons (optional)",
      leds_optional: "LEDs / indicators (optional)",
      full_hint: "Lower value = fuller tank",
      cycle_tab: "Cycle / hysteresis",
      cycle_hysteresis_title: "Hysteresis and work/rest cycle",
      cycle_addon_desc: "Choose thresholds in distance or level %.",
      threshold_mode: "Threshold unit",
      on_threshold: "On threshold",
      off_threshold: "Off threshold",
      on_below_short: "Turn on below (%)",
      off_above_short: "Turn off above (%)",
      hold_on_label: "On hold (s)",
      hold_off_label: "Off hold (s)",
      min_auto_switch_s: "Min. auto ON↔OFF interval (s)",
      min_auto_switch_hint:
        "Minimum gap between opposite automatic pump commands. Manual demand bypasses this. Default 300s (5 min).",
      retries: "Command retries",
      cyclic_mode: "Cyclic mode (work / rest)",
      work_minutes: "Work minutes",
      rest_minutes: "Rest minutes",
      save: "Save",
      alerts_addon_desc: "Optional — notify when level is low.",
      alert_low: "Low alert (%)",
      alert_critical: "Critical alert (%)",
      pump_title: "Pump",
      pump_hint:
        "Toggles persisted demand — the reconciler applies it to the physical pump.",
      live_addon_desc: "Tank level, desired demand and pump state.",
      reconcile_interval_saved: "Reconciliation interval saved.",
      select_option: "— select —",
      current_entity: "(current)",
      no_integration: "no integration",
      error_badge: "error",
      http_error: "HTTP error {status}",
      invalid_json: "Invalid JSON",
      cannot_list_entities: "Could not list entities",
      integration_missing:
        "Tankwise integration not found. Install via HACS and add it under Devices & services.",
      ok: "OK",
      err: "Error",
      add: "Add",
      physical_pump_short: "Pump",
    },
    pt: {
      brand_sub: "Controle amigável da bomba artesiana e da caixa d'água.",
      automation_on: "Automação ativa",
      automation_off: "Automação desligada",
      enable_automation: "Ligar automação",
      disable_automation: "Desligar automação",
      no_install:
        "Nenhuma instalação Tankwise encontrada.<br/>Em Configurações → Dispositivos e serviços, adicione a integração Tankwise.",
      installation: "Instalação",
      installation_tip:
        "Escolhe qual instalação do Tankwise você está controlando neste painel. O Home Assistant permite adicionar a integração mais de uma vez (ex.: duas casas ou dois poços). Cada opção mostra o nome da instalação; se a automação estiver desligada, aparece o sufixo (OFF). Não é uma lista de entidades — são as instalações Tankwise configuradas em Dispositivos e serviços.",
      tab_monitor: "Monitor",
      tab_config: "Entidades & calibração",
      tab_cycle: "Temporização",
      tab_alerts: "Alertas",
      tab_logs: "Logs",
      live_status: "Status ao vivo",
      live_status_desc:
        "Volume da caixa, estado da bomba e controle manual da demanda (variável de ambiente).",
      controller: "Controlador",
      demand: "Demanda",
      physical_pump: "Bomba física",
      distance: "Distância",
      level: "Nível",
      phase: "Fase",
      hold_on:
        "Hold para ligar: {elapsed}s / {target}s (nível ≤ limiar de ligar)",
      hold_off:
        "Hold para desligar: {elapsed}s / {target}s (nível ≥ limiar de desligar)",
      tank_hint: "toque para ver o gráfico",
      tank_aria: "Abrir gráfico do nível e da bomba",
      tank_label: "CAIXA D'ÁGUA",
      pump_on: "BOMBA ON",
      pump_off: "BOMBA OFF",
      manual_title: "Acionamento manual",
      manual_desc:
        "Liga ou desliga a bomba pela demanda persistida. O reconciliador aplica na bomba física.",
      pump_section: "Bomba (demanda persistida)",
      turn_pump_on: "Ligar bomba",
      turn_pump_off: "Desligar bomba",
      maintenance: "Manutenção",
      refresh: "Atualizar",
      entities_title: "Entidades",
      entities_desc:
        "Selecione o interruptor da bomba e o sensor de distância (como no painel do OneDrive Backup).",
      pump_control: "Controle da bomba *",
      distance_sensor: "Sensor de distância *",
      distance_hint:
        "Preferir sensor em metros (ex.: sensor.cxdagua_distance), não o de %.",
      physical_buttons: "Botões físicos (opcional)",
      no_buttons: "Nenhum botão adicionado.",
      add_buttons: "Adicionar botões",
      buttons_hint:
        "Cada botão alterna a demanda da bomba (0↔1). Pode adicionar vários.",
      leds_title: "LEDs / feedback (opcional)",
      no_leds: "Nenhum LED/feedback adicionado.",
      add_leds: "Adicionar LEDs",
      leds_hint: "Dispositivos que mostram o status da bomba. Pode adicionar vários.",
      choose_pump: "Escolher bomba",
      change_pump: "Trocar bomba",
      choose_distance: "Escolher sensor de distância",
      change_distance: "Trocar sensor de distância",
      no_pump_entity: "Nenhum controle da bomba selecionado.",
      no_distance_entity: "Nenhum sensor de distância selecionado.",
      modal_pump_title: "Escolher controle da bomba",
      modal_pump_hint:
        "Pesquise e selecione o interruptor que controla a bomba física (apenas um).",
      modal_distance_title: "Escolher sensor de distância",
      modal_distance_hint:
        "Pesquise e selecione o sensor de distância da caixa (apenas um). Preferir leitura em metros, não o de %.",
      select_entity: "Selecionar",
      live_unavailable: "—",
      live_on: "ON",
      live_off: "OFF",
      calibration_title: "Calibração da caixa",
      calibration_desc: "Menor distância = tanque mais cheio (ultrassônico).",
      full_distance: "Distância cheio",
      empty_distance: "Distância vazio",
      threshold_unit: "Unidade dos limiares",
      unit_distance: "Distância",
      unit_percent: "Porcentagem (%)",
      threshold_unit_hint:
        "Escolha se os limiares de ligar/desligar são em distância do sensor ou em % do nível da caixa.",
      on_below_percent: "Ligar demanda abaixo de (%)",
      on_below_percent_hint:
        "Liga quando o nível fica ≤ este %. Deve ser menor que o limiar de desligar (ex.: 30).",
      off_above_percent: "Desligar demanda acima de (%)",
      off_above_percent_hint:
        "Desliga quando o nível fica ≥ este % (ex.: 95).",
      on_threshold_distance: "Limiar ligar (distância ≥)",
      on_threshold_distance_hint:
        "Liga quando a distância fica acima deste valor (caixa mais vazia). Deve ser maior que o limiar de desligar.",
      off_threshold_distance: "Limiar desligar (distância ≤)",
      off_threshold_distance_hint:
        "Desliga quando a distância fica abaixo deste valor (caixa mais cheia).",
      hold_on_s: "Hold ligar (s)",
      hold_off_s: "Hold desligar (s)",
      min_auto_switch_s: "Intervalo mín. auto ligar↔desligar (s)",
      min_auto_switch_hint:
        "Tempo mínimo entre comandos automáticos opostos da bomba. Demanda manual ignora esta proteção. Padrão 300s (5 min).",
      expose_percent: "Expor sensor de nível (%)",
      save_config: "Salvar configuração",
      reconcile_title: "Reconciliação",
      reconcile_desc:
        "A reconciliação compara a demanda desejada com o estado real da bomba e corrige diferenças (liga/desliga a bomba física quando necessário, respeitando as regras de segurança).",
      reconcile_interval: "Intervalo automático (minutos)",
      reconcile_interval_hint:
        "De quanto em quanto tempo o sistema verifica e alinha a bomba, se a reconciliação automática estiver habilitada.",
      enable_reconcile: "Habilitar reconciliação automática",
      disable_reconcile: "Desabilitar reconciliação automática",
      save_interval: "Salvar intervalo",
      cycle_title: "Acionamento temporizado",
      cycle_desc:
        "Quando ativo, a bomba trabalha em ciclos de trabalho/descanso. Desligado = contínuo enquanto houver demanda.",
      use_timing: "Usar temporização (trabalho / descanso)",
      work_period: "Período acionado (min)",
      rest_period: "Período desacionado (min)",
      failsafe_margin: "Margem failsafe (min)",
      save_timing: "Salvar temporização",
      alerts_title: "Notificações de nível",
      alerts_desc: "Avisos quando a caixa estiver baixa ou crítica.",
      notify_services: "Serviços notify",
      no_notify: "Nenhum serviço notify adicionado.",
      add_notify: "Adicionar notify",
      notify_hint:
        "Pode adicionar vários destinos (celular, Telegram, etc.). Cada alerta é enviado a todos.",
      low_level: "Nível baixo (%)",
      critical_level: "Nível crítico (%)",
      notify_hold: "Hold notificação (s)",
      save_alerts: "Salvar alertas",
      test_alerts: "Testar alertas",
      logs_title: "Logs do controlador",
      logs_desc:
        "Eventos persistidos no disco do Home Assistant (últimos 7 dias). Eventos da bomba incluem nível (%) e distância.",
      refresh_logs: "Atualizar logs",
      no_events:
        "Nenhum evento ainda. Altere a demanda, aguarde o hold dos limiares ou use um botão físico e atualize.",
      history_title: "Nível e bomba",
      range_1h: "1 hora",
      range_1d: "1 dia",
      range_1w: "1 semana",
      range_1m: "1 mês",
      loading_history: "Carregando histórico…",
      chart_level: "Nível",
      chart_tank: "caixa d'água",
      chart_pump: "bomba",
      chart_pump_label: "Bomba",
      chart_no_data: "Sem dados neste período",
      chart_no_level: "Sem dados de nível",
      chart_no_pump: "Sem dados da bomba",
      close: "Fechar",
      cancel: "Cancelar",
      add_selected: "Adicionar selecionados",
      search_entity: "Pesquisar entidade…",
      search_notify: "Pesquisar serviço notify…",
      none_found_entity: "Nenhuma entidade encontrada.",
      none_found_notify: "Nenhum serviço notify encontrado.",
      remove: "Remover",
      modal_buttons_title: "Adicionar botões físicos",
      modal_buttons_hint:
        "Pesquise e marque um ou mais botões/interruptores que alternam a demanda.",
      modal_leds_title: "Adicionar LEDs / feedback",
      modal_leds_hint:
        "Pesquise e marque um ou mais dispositivos que mostram o status da bomba.",
      modal_notify_title: "Adicionar serviços notify",
      modal_notify_hint:
        "Pesquise e marque um ou mais destinos (ex.: notify.mobile_app_seu_telefone).",
      msg_saved:
        "Configuração salva. O controlador já está usando os novos parâmetros.",
      msg_automation_on: "Automação ligada.",
      msg_automation_off: "Automação desligada (bomba forçada OFF).",
      msg_demand_on: "Demanda manual ON (variável de ambiente = 1).",
      msg_demand_off: "Demanda manual OFF (variável de ambiente = 0).",
      msg_reconcile_on: "Reconciliação automática habilitada.",
      msg_reconcile_off: "Reconciliação automática desabilitada.",
      msg_test_sent: "Notificação de teste enviada.",
      addon_sub: "Controle da bomba pelo nível da caixa d’água",
      loading: "carregando…",
      automation_badge_off: "automação OFF",
      demand_badge_on: "demanda ON",
      demand_badge_off: "demanda OFF",
      status_automation: "Automação",
      status_on: "ligada",
      status_off: "desligada",
      status_allowed: "Permitido",
      status_yes: "sim",
      status_no: "não",
      status_reason: "Motivo",
      empty_title: "Integração ainda não configurada",
      empty_steps:
        "1. Instale <strong>Tankwise</strong> pelo HACS<br />2. Em <em>Dispositivos e serviços</em>, adicione a integração Tankwise<br />3. Volte aqui e atualize",
      entities_addon_desc: "Selecione bomba, sensor de distância e opcionais.",
      pump_switch: "Switch da bomba",
      buttons_optional: "Botões físicos (opcional)",
      leds_optional: "LEDs / indicadores (opcional)",
      full_hint: "Menor valor = tanque mais cheio",
      cycle_tab: "Ciclo / histerese",
      cycle_hysteresis_title: "Histerese e ciclo trabalho/descanso",
      cycle_addon_desc: "Escolha limiares em distância ou em % do nível.",
      threshold_mode: "Unidade dos limiares",
      on_threshold: "Limiar ligar",
      off_threshold: "Limiar desligar",
      on_below_short: "Ligar abaixo de (%)",
      off_above_short: "Desligar acima de (%)",
      hold_on_label: "Hold para ligar (s)",
      hold_off_label: "Hold para desligar (s)",
      min_auto_switch_s: "Intervalo mín. auto ligar↔desligar (s)",
      min_auto_switch_hint:
        "Tempo mínimo entre comandos automáticos opostos da bomba. Demanda manual ignora esta proteção. Padrão 300s (5 min).",
      retries: "Tentativas de comando",
      cyclic_mode: "Modo cíclico (trabalho / descanso)",
      work_minutes: "Minutos trabalhando",
      rest_minutes: "Minutos descanso",
      save: "Salvar",
      alerts_addon_desc: "Opcional — avisa quando o nível fica baixo.",
      alert_low: "Alerta baixo (%)",
      alert_critical: "Alerta crítico (%)",
      pump_title: "Bomba",
      pump_hint:
        "Alterna a demanda persistida — o reconciliador aplica na bomba física.",
      live_addon_desc: "Nível do tanque, demanda desejada e estado da bomba.",
      reconcile_interval_saved: "Intervalo de reconciliação salvo.",
      select_option: "— selecione —",
      current_entity: "(atual)",
      no_integration: "sem integração",
      error_badge: "erro",
      http_error: "Erro HTTP {status}",
      invalid_json: "JSON inválido",
      cannot_list_entities: "Não foi possível listar entidades",
      integration_missing:
        "Integração Tankwise não encontrada. Instale via HACS e adicione em Dispositivos e serviços.",
      ok: "OK",
      err: "Erro",
      add: "Adicionar",
      physical_pump_short: "Bomba",
    },
  };

  function resolveLang(raw) {
    const text = String(raw || "en").toLowerCase();
    return text.startsWith("pt") ? "pt" : "en";
  }

  function t(lang, key, vars) {
    const code = resolveLang(lang);
    const dict = STRINGS[code] || STRINGS.en;
    let out = dict[key];
    if (out == null) out = STRINGS.en[key];
    if (out == null) return key;
    if (vars && typeof vars === "object") {
      for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(`{${k}}`, String(v));
      }
    }
    return out;
  }

  function applyDom(lang, root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const html = el.hasAttribute("data-i18n-html");
      const value = t(lang, key);
      if (html) el.innerHTML = value;
      else el.textContent = value;
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(lang, key));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key) el.setAttribute("title", t(lang, key));
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key) el.setAttribute("aria-label", t(lang, key));
    });
  }

  return { STRINGS, resolveLang, t, applyDom };
});

export const resolveLang = globalThis.TankwiseI18n.resolveLang;
export const t = globalThis.TankwiseI18n.t;
export const applyDom = globalThis.TankwiseI18n.applyDom;
export const STRINGS = globalThis.TankwiseI18n.STRINGS;
