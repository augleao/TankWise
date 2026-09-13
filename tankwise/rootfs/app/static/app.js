(() => {
  const state = {
    entries: [],
    selected: null,
    config: null,
    status: null,
    entities: {},
    busy: false,
    tab: "monitor",
    pollTimer: null,
  };

  const $ = (id) => document.getElementById(id);

  function showAlert(message, kind = "ok") {
    const el = $("alert");
    if (!message) {
      el.className = "alert hidden";
      el.textContent = "";
      return;
    }
    el.className = `alert ${kind}`;
    el.textContent = message;
  }

  async function api(path, options = {}) {
    const res = await fetch(`api${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg =
        (data && (data.message || data.error)) || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function num(key, fallback) {
    const n = Number(state.config?.[key] ?? fallback);
    return Number.isFinite(n) ? n : fallback;
  }

  function percent() {
    const st = state.status || {};
    if (st.percent != null && Number.isFinite(Number(st.percent))) {
      return Math.max(0, Math.min(100, Number(st.percent)));
    }
    const dist = st.distance;
    const full = num("full_distance", 82);
    const empty = num("empty_distance", 120);
    if (dist == null || empty <= full) return null;
    const pct = ((empty - Number(dist)) / (empty - full)) * 100;
    if (!Number.isFinite(pct)) return null;
    return Math.max(0, Math.min(100, pct));
  }

  function tankSvg(pct) {
    const level = pct === null ? 0 : pct;
    const waterY = 20 + (100 - level) * 0.9;
    const label = pct === null ? "—" : `${level.toFixed(0)}%`;
    const fill = level < 25 ? "#e53935" : level < 50 ? "#fb8c00" : "#1b7f5a";
    return `
      <svg viewBox="0 0 120 140" width="140" height="164" aria-label="Nível ${label}">
        <defs>
          <clipPath id="tankClip"><rect x="18" y="18" width="84" height="100" rx="6"/></clipPath>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${fill}" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="${fill}"/>
          </linearGradient>
        </defs>
        <rect x="14" y="14" width="92" height="108" rx="10" fill="#eef2f0" stroke="#2f5d4a" stroke-width="3"/>
        <g clip-path="url(#tankClip)">
          <rect x="18" y="${waterY}" width="84" height="${120 - waterY}" fill="url(#waterGrad)">
            ${pct != null ? `<animate attributeName="y" values="${waterY};${waterY - 1.5};${waterY}" dur="2.4s" repeatCount="indefinite"/>` : ""}
          </rect>
        </g>
        <rect x="14" y="14" width="92" height="108" rx="10" fill="none" stroke="#2f5d4a" stroke-width="3"/>
        <text x="60" y="72" text-anchor="middle" font-size="22" font-weight="700" fill="#16382c">${label}</text>
        <text x="60" y="132" text-anchor="middle" font-size="11" fill="#5b6b63">CAIXA D'ÁGUA</text>
      </svg>`;
  }

  function pumpSvg(running) {
    const color = running ? "#1b7f5a" : "#9aa5a0";
    const spin = running
      ? `<animateTransform attributeName="transform" type="rotate" from="0 60 52" to="360 60 52" dur="1.2s" repeatCount="indefinite"/>`
      : "";
    return `
      <svg viewBox="0 0 120 120" width="120" height="120" aria-label="Bomba ${running ? "ligada" : "parada"}">
        <circle cx="60" cy="52" r="28" fill="#eef2f0" stroke="${color}" stroke-width="3"/>
        <g>
          <path d="M60 30 L66 52 L60 74 L54 52 Z" fill="${color}"/>
          <path d="M38 52 L60 46 L82 52 L60 58 Z" fill="${color}" opacity="0.7"/>
          ${spin}
        </g>
        <rect x="48" y="80" width="24" height="18" rx="3" fill="${color}"/>
        <text x="60" y="112" text-anchor="middle" font-size="11" fill="#5b6b63">${running ? "BOMBA ON" : "BOMBA OFF"}</text>
      </svg>`;
  }

  function fmt(v, suffix = "") {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "boolean") return v ? "ON" : "OFF";
    if (typeof v === "number") return `${Number.isInteger(v) ? v : v.toFixed(1)}${suffix}`;
    return `${v}${suffix}`;
  }

  function renderMonitor() {
    const st = state.status || {};
    const pct = percent();
    $("tank-visual").innerHTML = tankSvg(pct);
    $("pump-visual").innerHTML = pumpSvg(Boolean(st.pump_on));

    const rows = [
      ["Automação", st.enabled ? "ligada" : "desligada", st.enabled ? "on" : "off"],
      ["Demanda", st.desired_on ? "ON" : "OFF", st.desired_on ? "on" : "off"],
      ["Bomba", st.pump_on == null ? "—" : st.pump_on ? "ON" : "OFF", st.pump_on ? "on" : "off"],
      ["Distância", fmt(st.distance), ""],
      ["Nível", pct == null ? "—" : `${pct.toFixed(0)}%`, ""],
      ["Fase", fmt(st.cycle_phase), ""],
      ["Permitido", st.pump_allowed ? "sim" : "não", ""],
      ["Motivo", fmt(st.reason), ""],
    ];
    $("stats").innerHTML = rows
      .map(
        ([k, v, cls]) =>
          `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`
      )
      .join("");

    const badge = $("badge");
    if (!st.enabled) {
      badge.className = "badge off";
      badge.textContent = "automação OFF";
    } else if (st.desired_on) {
      badge.className = "badge ok";
      badge.textContent = "demanda ON";
    } else {
      badge.className = "badge";
      badge.textContent = "demanda OFF";
    }
  }

  function mergeDomains(domains) {
    const map = new Map();
    for (const d of domains) {
      for (const item of state.entities[d] || []) map.set(item.id, item);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function fillSelect(el, domains, selected, multiple = false) {
    const list = mergeDomains(domains);
    const selectedSet = new Set(
      multiple
        ? Array.isArray(selected)
          ? selected
          : []
        : selected
          ? [selected]
          : []
    );
    const opts = [];
    if (!multiple) opts.push(`<option value="">— selecione —</option>`);
    for (const item of list) {
      const sel = selectedSet.has(item.id) ? " selected" : "";
      opts.push(`<option value="${item.id}"${sel}>${item.name}</option>`);
    }
    for (const sid of selectedSet) {
      if (sid && !list.some((x) => x.id === sid)) {
        opts.push(`<option value="${sid}" selected>${sid} (atual)</option>`);
      }
    }
    el.innerHTML = opts.join("");
  }

  function bindConfigFields() {
    if (!state.config) return;
    const c = state.config;
    fillSelect($("pump_entity"), ["switch", "input_boolean"], c.pump_entity);
    fillSelect($("distance_entity"), ["sensor", "input_number", "number"], c.distance_entity);
    fillSelect($("toggle_entities"), ["binary_sensor", "input_boolean", "switch"], c.toggle_entities || [], true);
    fillSelect($("led_entities"), ["light", "switch", "input_boolean"], c.led_entities || [], true);

    const scalars = [
      "full_distance",
      "empty_distance",
      "on_threshold",
      "off_threshold",
      "on_hold_seconds",
      "off_hold_seconds",
      "reconcile_interval",
      "reconcile_retries",
      "work_minutes",
      "rest_minutes",
      "failsafe_margin_minutes",
      "notify_service",
      "low_level_percent",
      "critical_level_percent",
      "level_notify_hold_seconds",
    ];
    for (const key of scalars) {
      const el = $(key);
      if (!el) continue;
      const v = c[key];
      el.value = v == null ? "" : v;
    }
    $("expose_percentage").checked = Boolean(c.expose_percentage);
    const timed = Number(c.work_minutes) > 0 || Number(c.rest_minutes) > 0;
    $("timed_mode").checked = timed;
  }

  function readConfigFromForm() {
    const payload = { ...state.config };
    const get = (id) => $(id);

    payload.pump_entity = get("pump_entity").value || null;
    payload.distance_entity = get("distance_entity").value || null;
    payload.toggle_entities = Array.from(get("toggle_entities").selectedOptions).map((o) => o.value);
    payload.led_entities = Array.from(get("led_entities").selectedOptions).map((o) => o.value);
    payload.expose_percentage = get("expose_percentage").checked;

    const numberKeys = [
      "full_distance",
      "empty_distance",
      "on_threshold",
      "off_threshold",
      "on_hold_seconds",
      "off_hold_seconds",
      "reconcile_interval",
      "reconcile_retries",
      "work_minutes",
      "rest_minutes",
      "failsafe_margin_minutes",
      "low_level_percent",
      "critical_level_percent",
      "level_notify_hold_seconds",
    ];
    for (const key of numberKeys) {
      const el = get(key);
      if (!el) continue;
      payload[key] = el.value === "" ? null : Number(el.value);
    }
    payload.notify_service = get("notify_service").value || "";

    if (!$("timed_mode").checked) {
      payload.work_minutes = 0;
      payload.rest_minutes = 0;
    } else {
      if (!payload.work_minutes) payload.work_minutes = 30;
      if (!payload.rest_minutes) payload.rest_minutes = 30;
    }
    return payload;
  }

  function setBusy(busy) {
    state.busy = busy;
    document.querySelectorAll("button").forEach((b) => {
      if (b.classList.contains("tab")) return;
      b.disabled = busy;
    });
  }

  function applyEntry(entry) {
    state.selected = entry.entry_id;
    state.config = { ...entry.config };
    state.status = entry.status;
    $("empty-state").hidden = true;
    $("app").hidden = false;
    renderMonitor();
    bindConfigFields();
  }

  async function refresh() {
    try {
      const [list, ents] = await Promise.all([
        api("/entries"),
        api("/entities").catch(() => ({ entities: {} })),
      ]);
      state.entities = ents.entities || {};
      state.entries = list.entries || [];
      if (list.message && !state.entries.length) {
        showAlert(list.message, "err");
      }
      if (!state.entries.length) {
        $("empty-state").hidden = false;
        $("app").hidden = true;
        $("badge").className = "badge";
        $("badge").textContent = "sem integração";
        return;
      }
      let entry = state.entries.find((e) => e.entry_id === state.selected) || state.entries[0];
      applyEntry(entry);
      if (!list.message) showAlert("");
    } catch (err) {
      showAlert(err.message || String(err), "err");
      $("badge").className = "badge off";
      $("badge").textContent = "erro";
    }
  }

  async function saveConfig() {
    if (!state.selected) return;
    setBusy(true);
    try {
      const config = readConfigFromForm();
      const cleaned = {};
      for (const [k, v] of Object.entries(config)) {
        if (v === null || v === undefined) continue;
        cleaned[k] = v;
      }
      const res = await api(`/entries/${state.selected}/config`, {
        method: "POST",
        body: JSON.stringify({ config: cleaned }),
      });
      applyEntry(res);
      showAlert("Configuração salva. O controlador já usa os novos parâmetros.", "ok");
    } catch (err) {
      showAlert(err.message || String(err), "err");
    }
    setBusy(false);
  }

  async function setEnabled(enabled) {
    if (!state.selected) return;
    setBusy(true);
    try {
      const res = await api(`/entries/${state.selected}/enabled`, {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
      applyEntry(res);
      showAlert(enabled ? "Automação ligada." : "Automação desligada (bomba forçada OFF).", "ok");
    } catch (err) {
      showAlert(err.message || String(err), "err");
    }
    setBusy(false);
  }

  async function setDemand(desiredOn) {
    if (!state.selected) return;
    setBusy(true);
    try {
      const res = await api(`/entries/${state.selected}/demand`, {
        method: "POST",
        body: JSON.stringify({ desired_on: desiredOn }),
      });
      applyEntry(res);
      showAlert(
        desiredOn ? "Demanda manual ON (variável = 1)." : "Demanda manual OFF (variável = 0).",
        "ok"
      );
    } catch (err) {
      showAlert(err.message || String(err), "err");
    }
    setBusy(false);
  }

  async function reconcile() {
    if (!state.selected) return;
    setBusy(true);
    try {
      const res = await api(`/entries/${state.selected}/reconcile`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      applyEntry(res);
      showAlert("Reconciliação executada.", "ok");
    } catch (err) {
      showAlert(err.message || String(err), "err");
    }
    setBusy(false);
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".tab").forEach((el) => {
      el.classList.toggle("active", el.dataset.tab === tab);
    });
    document.querySelectorAll("[data-panel]").forEach((el) => {
      el.hidden = el.dataset.panel !== tab;
    });
  }

  function wire() {
    document.querySelectorAll(".tab").forEach((el) => {
      el.addEventListener("click", () => switchTab(el.dataset.tab));
    });
    $("btn-refresh").addEventListener("click", () => refresh());
    $("btn-save-config").addEventListener("click", () => saveConfig());
    $("btn-save-cycle").addEventListener("click", () => saveConfig());
    $("btn-save-alerts").addEventListener("click", () => saveConfig());
    $("btn-enable").addEventListener("click", () => setEnabled(true));
    $("btn-disable").addEventListener("click", () => setEnabled(false));
    $("btn-demand-on").addEventListener("click", () => setDemand(true));
    $("btn-demand-off").addEventListener("click", () => setDemand(false));
    $("btn-reconcile").addEventListener("click", () => reconcile());
    $("timed_mode").addEventListener("change", (ev) => {
      if (ev.target.checked) {
        if (!Number($("work_minutes").value)) $("work_minutes").value = "30";
        if (!Number($("rest_minutes").value)) $("rest_minutes").value = "30";
      } else {
        $("work_minutes").value = "0";
        $("rest_minutes").value = "0";
      }
    });
  }

  wire();
  refresh();
  state.pollTimer = setInterval(() => {
    if (!state.busy) refresh();
  }, 5000);
})();
