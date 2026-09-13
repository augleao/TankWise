/**
 * Tankwise — painel lateral amigável (estilo dashboard de add-on).
 * Abra pela barra lateral: Tankwise
 */
class TankwisePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._entries = [];
    this._selected = null;
    this._config = null;
    this._status = null;
    this._entities = {
      switch: [],
      sensor: [],
      binary_sensor: [],
      light: [],
      input_boolean: [],
      input_number: [],
      number: [],
    };
    this._busy = false;
    this._msg = "";
    this._err = "";
    this._section = "monitor"; // monitor | config | cycle | alerts | logs
    this._version = "";
    this._logs = [];
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._booted) {
      this._booted = true;
      this._boot();
    } else if (this._selected) {
      // Soft refresh status from hass states when possible
      this._render();
    }
  }

  connectedCallback() {
    this._render();
  }

  async _boot() {
    await this._loadEntities();
    await this._refreshList();
  }

  async _ws(type, data = {}) {
    return this._hass.callWS({ type, ...data });
  }

  async _loadEntities() {
    const states = this._hass.states;
    const buckets = {
      switch: [],
      sensor: [],
      binary_sensor: [],
      light: [],
      input_boolean: [],
      input_number: [],
      number: [],
    };
    Object.keys(states)
      .sort()
      .forEach((eid) => {
        const domain = eid.split(".")[0];
        if (buckets[domain]) {
          const name = states[eid].attributes.friendly_name || eid;
          buckets[domain].push({ id: eid, name: `${name} (${eid})` });
        }
      });
    this._entities = buckets;
  }

  async _refreshList() {
    try {
      const res = await this._ws("tankwise/list");
      this._entries = res.entries || [];
      if (!this._selected && this._entries.length) {
        this._selected = this._entries[0].entry_id;
      }
      if (this._selected) {
        const still = this._entries.find((e) => e.entry_id === this._selected);
        if (still) {
          this._config = { ...still.config };
          this._status = still.status;
          this._version = still.version || this._version || "";
        } else {
          this._selected = this._entries[0]?.entry_id || null;
          if (this._selected) await this._loadConfig(this._selected);
        }
      }
      this._err = "";
    } catch (e) {
      this._err = e.message || String(e);
    }
    this._render();
  }


  async _loadLogs() {
    if (!this._selected) return;
    try {
      const res = await this._ws("tankwise/logs", {
        entry_id: this._selected,
        limit: 50,
      });
      this._logs = res.logs || [];
      if (res.status) this._status = res.status;
      this._err = "";
    } catch (e) {
      this._err = e.message || String(e);
    }
  }

  async _loadConfig(entryId) {
    const res = await this._ws("tankwise/get_config", { entry_id: entryId });
    this._config = { ...res.config };
    this._status = res.status;
    this._selected = entryId;
  }

  _val(key, fallback = "") {
    if (!this._config) return fallback;
    const v = this._config[key];
    return v === undefined || v === null ? fallback : v;
  }

  _bool(key, fallback = false) {
    return Boolean(this._val(key, fallback));
  }

  _list(key) {
    const v = this._val(key, []);
    return Array.isArray(v) ? v : [];
  }

  _num(key, fallback) {
    const n = Number(this._val(key, fallback));
    return Number.isFinite(n) ? n : fallback;
  }

  _onInput(key, ev) {
    if (!this._config) return;
    const el = ev.target;
    let value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.multiple)
      value = Array.from(el.selectedOptions).map((o) => o.value).filter(Boolean);
    else if (el.type === "number")
      value = el.value === "" ? null : Number(el.value);
    else value = el.value === "" ? null : el.value;
    this._config = { ...this._config, [key]: value };
  }

  async _save() {
    if (!this._selected || !this._config) return;
    this._busy = true;
    this._msg = "";
    this._err = "";
    this._render();
    try {
      const payload = {};
      for (const [key, value] of Object.entries(this._config)) {
        if (value === null || value === undefined) continue;
        payload[key] = value;
      }
      for (const key of ["toggle_entities", "led_entities"]) {
        if (!Array.isArray(payload[key])) payload[key] = [];
      }
      if (payload.notify_service == null) payload.notify_service = "";
      const res = await this._ws("tankwise/update_config", {
        entry_id: this._selected,
        config: payload,
      });
      this._config = { ...res.config };
      this._status = res.status;
      this._msg = "Configuração salva. O controlador já está usando os novos parâmetros.";
      await this._refreshList();
    } catch (e) {
      this._err = e.message || String(e);
    }
    this._busy = false;
    this._render();
  }

  async _setEnabled(enabled) {
    this._busy = true;
    this._render();
    try {
      const res = await this._ws("tankwise/set_enabled", {
        entry_id: this._selected,
        enabled,
      });
      this._config = { ...res.config };
      this._status = res.status;
      this._msg = enabled
        ? "Automação ligada."
        : "Automação desligada (bomba forçada OFF).";
    } catch (e) {
      this._err = e.message || String(e);
    }
    this._busy = false;
    this._render();
  }

  async _setDemand(desiredOn) {
    this._busy = true;
    this._render();
    try {
      const res = await this._ws("tankwise/set_demand", {
        entry_id: this._selected,
        desired_on: desiredOn,
      });
      this._config = { ...res.config };
      this._status = res.status;
      this._msg = desiredOn
        ? "Demanda manual ON (variável de ambiente = 1)."
        : "Demanda manual OFF (variável de ambiente = 0).";
    } catch (e) {
      this._err = e.message || String(e);
    }
    this._busy = false;
    this._render();
  }

  async _reconcile() {
    this._busy = true;
    this._render();
    try {
      const res = await this._ws("tankwise/reconcile", {
        entry_id: this._selected,
      });
      this._config = { ...res.config };
      this._status = res.status;
      this._msg = "Reconciliação executada.";
    } catch (e) {
      this._err = e.message || String(e);
    }
    this._busy = false;
    this._render();
  }

  _esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  _mergeDomains(domains) {
    const map = new Map();
    for (const d of domains) {
      for (const item of this._entities[d] || []) map.set(item.id, item);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  _options(domains, selected, { multiple = false } = {}) {
    const list = this._mergeDomains(domains);
    const selectedSet = new Set(
      multiple
        ? Array.isArray(selected)
          ? selected
          : []
        : selected
          ? [selected]
          : []
    );
    const opts = multiple ? [] : [`<option value="">— selecione —</option>`];
    for (const item of list) {
      const sel = selectedSet.has(item.id) ? " selected" : "";
      opts.push(
        `<option value="${this._esc(item.id)}"${sel}>${this._esc(item.name)}</option>`
      );
    }
    for (const sid of selectedSet) {
      if (sid && !list.some((x) => x.id === sid)) {
        opts.push(
          `<option value="${this._esc(sid)}" selected>${this._esc(sid)} (atual)</option>`
        );
      }
    }
    return opts.join("");
  }

  _percent() {
    const st = this._status || {};
    if (st.percent !== null && st.percent !== undefined && Number.isFinite(Number(st.percent))) {
      return Math.max(0, Math.min(100, Number(st.percent)));
    }
    // Derive from distance + calibration when percent missing
    const dist = st.distance;
    const full = this._num("full_distance", 0.25);
    const empty = this._num("empty_distance", 0.47);
    if (dist === null || dist === undefined || empty <= full) return null;
    const pct = ((empty - Number(dist)) / (empty - full)) * 100;
    if (!Number.isFinite(pct)) return null;
    return Math.max(0, Math.min(100, pct));
  }

  _tankSvg(pct) {
    const level = pct === null ? 0 : pct;
    const waterY = 20 + (100 - level) * 0.9; // 20..110
    const label = pct === null ? "—" : `${level.toFixed(0)}%`;
    const fill =
      level < 25 ? "#e53935" : level < 50 ? "#fb8c00" : "#1b7f5a";
    return `
      <svg class="tank-svg" viewBox="0 0 120 140" width="140" height="164" aria-label="Nível do tanque ${label}">
        <defs>
          <clipPath id="tankClip">
            <rect x="18" y="18" width="84" height="100" rx="6"/>
          </clipPath>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${fill}" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="${fill}" stop-opacity="1"/>
          </linearGradient>
        </defs>
        <rect x="14" y="14" width="92" height="108" rx="10" fill="#eef2f0" stroke="#2f5d4a" stroke-width="3"/>
        <g clip-path="url(#tankClip)">
          <rect class="water" x="18" y="${waterY}" width="84" height="${120 - waterY}" fill="url(#waterGrad)">
            ${pct !== null ? `<animate attributeName="y" values="${waterY};${waterY - 1.5};${waterY}" dur="2.4s" repeatCount="indefinite"/>` : ""}
          </rect>
        </g>
        <rect x="14" y="14" width="92" height="108" rx="10" fill="none" stroke="#2f5d4a" stroke-width="3"/>
        <text x="60" y="72" text-anchor="middle" font-size="22" font-weight="700" fill="#16382c">${label}</text>
        <text x="60" y="132" text-anchor="middle" font-size="11" fill="#5b6b63">CAIXA D'ÁGUA</text>
      </svg>`;
  }

  _pumpSvg(running) {
    const color = running ? "#1b7f5a" : "#9aa5a0";
    const spin = running
      ? `<animateTransform attributeName="transform" type="rotate" from="0 60 52" to="360 60 52" dur="1.2s" repeatCount="indefinite"/>`
      : "";
    return `
      <svg class="pump-svg" viewBox="0 0 120 120" width="120" height="120" aria-label="Bomba ${running ? "ligada" : "parada"}">
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

  _styles() {
    return `
      <style>
        :host {
          display: block;
          font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1c2b24;
          --tw-green: #1b7f5a;
          --tw-green-dark: #145c42;
          --tw-bg: #f3f6f4;
          --tw-card: #ffffff;
          --tw-border: #d7e0db;
          --tw-muted: #5b6b63;
          --tw-danger: #c62828;
          --tw-warn: #ef6c00;
        }
        .page {
          background: linear-gradient(180deg, #e8f0eb 0%, var(--tw-bg) 28%, #eef2f0 100%);
          min-height: 100%;
          padding: 20px 16px 40px;
        }
        .wrap { max-width: 1040px; margin: 0 auto; }
        .hero {
          background: var(--tw-card);
          border: 1px solid var(--tw-border);
          border-radius: 16px;
          padding: 20px 22px;
          margin-bottom: 14px;
          box-shadow: 0 8px 24px rgba(20, 60, 40, 0.06);
          display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center;
        }
        .hero h1 { margin: 0; font-size: 1.75rem; color: var(--tw-green-dark); letter-spacing: -0.02em; }
        .ver { font-size: 0.95rem; font-weight: 600; color: var(--tw-muted); margin-left: 6px; }
        .log-box { max-height: 420px; overflow: auto; border: 1px solid var(--tw-border); border-radius: 12px; background: #f7faf8; }
        .log-row { display: grid; grid-template-columns: 160px 160px 1fr; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--tw-border); font-size: 0.82rem; }
        .log-row:last-child { border-bottom: none; }
        .log-ts { color: var(--tw-muted); font-family: ui-monospace, monospace; }
        .log-ev { font-weight: 700; color: var(--tw-green-dark); }
        .log-extra { color: #31463c; word-break: break-word; }
        .hero p { margin: 4px 0 0; color: var(--tw-muted); font-size: 0.95rem; }
        .badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
          background: #e8eee9; color: var(--tw-muted);
        }
        .badge.ok { background: #e3f2eb; color: var(--tw-green-dark); }
        .badge.off { background: #fdecea; color: var(--tw-danger); }
        .card {
          background: var(--tw-card);
          border: 1px solid var(--tw-border);
          border-radius: 16px;
          padding: 18px 20px;
          margin-bottom: 14px;
          box-shadow: 0 6px 18px rgba(20, 60, 40, 0.05);
        }
        .card h2 {
          margin: 0 0 6px; font-size: 1.15rem; color: var(--tw-green-dark);
        }
        .card .desc { color: var(--tw-muted); font-size: 0.9rem; margin-bottom: 14px; }
        .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
        .tab {
          border: 1px solid var(--tw-border); background: #fff; color: var(--tw-muted);
          border-radius: 999px; padding: 8px 14px; cursor: pointer; font-weight: 600; font-size: 0.9rem;
        }
        .tab.active { background: var(--tw-green); color: #fff; border-color: var(--tw-green); }
        .visuals {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          align-items: center;
        }
        .visual {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 8px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
          margin-top: 8px;
        }
        .stat {
          background: #f7faf8; border: 1px solid var(--tw-border); border-radius: 12px; padding: 12px;
        }
        .stat .k { font-size: 0.72rem; text-transform: uppercase; letter-spacing: .04em; color: var(--tw-muted); }
        .stat .v { font-size: 1.2rem; font-weight: 700; margin-top: 4px; color: #16382c; }
        .stat.on .v { color: var(--tw-green); }
        .stat.off .v { color: var(--tw-danger); }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
        }
        label { display: block; font-size: 0.85rem; margin-bottom: 4px; color: #31463c; font-weight: 600; }
        select, input[type=number], input[type=text] {
          width: 100%; box-sizing: border-box; padding: 10px 12px;
          border-radius: 10px; border: 1px solid var(--tw-border);
          background: #fbfcfb; color: #1c2b24; font-size: 0.95rem;
        }
        select[multiple] { min-height: 108px; }
        .hint { font-size: 0.8rem; color: var(--tw-muted); margin-top: 4px; }
        .check { display: flex; align-items: center; gap: 8px; margin: 10px 0; color: #31463c; }
        .check input { width: auto; }
        .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
        button {
          border: none; border-radius: 10px; padding: 11px 16px; cursor: pointer;
          background: var(--tw-green); color: #fff; font-weight: 700; font-size: 0.92rem;
        }
        button:hover { background: var(--tw-green-dark); }
        button.secondary {
          background: #fff; color: var(--tw-green-dark);
          border: 1px solid var(--tw-green);
        }
        button.danger { background: #fff; color: var(--tw-danger); border: 1px solid var(--tw-danger); }
        button:disabled { opacity: 0.5; cursor: default; }
        .msg, .err {
          border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; font-weight: 600;
        }
        .msg { background: #e3f2eb; color: var(--tw-green-dark); }
        .err { background: #fdecea; color: var(--tw-danger); }
        .empty { text-align: center; padding: 48px 20px; color: var(--tw-muted); }
        .manual-box {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;
          background: #f7faf8; border: 1px dashed var(--tw-border); border-radius: 12px; padding: 14px;
        }
      </style>
    `;
  }

  _bind() {
    const root = this.shadowRoot;
    root.querySelectorAll("[data-key]").forEach((el) => {
      const key = el.getAttribute("data-key");
      const handler = (ev) => this._onInput(key, ev);
      el.onchange = handler;
      if (el.tagName === "INPUT" && el.type === "number") el.oninput = handler;
    });
    const timed = root.getElementById("timed_mode");
    if (timed) {
      timed.onchange = (ev) => {
        if (!this._config) return;
        if (ev.target.checked) {
          if (!this._num("work_minutes", 0)) this._config.work_minutes = 30;
          if (!this._num("rest_minutes", 0)) this._config.rest_minutes = 30;
        } else {
          this._config.work_minutes = 0;
          this._config.rest_minutes = 0;
        }
        this._render();
      };
    }
    const entrySel = root.getElementById("entry");
    if (entrySel) {
      entrySel.onchange = async (ev) => {
        this._selected = ev.target.value;
        await this._loadConfig(this._selected);
        this._render();
      };
    }
    root.querySelectorAll("[data-tab]").forEach((el) => {
      el.onclick = async () => {
        this._section = el.getAttribute("data-tab");
        if (this._section === "logs") await this._loadLogs();
        this._render();
      };
    });
    const btn = (id, fn) => {
      const el = root.getElementById(id);
      if (el) el.onclick = () => fn();
    };
    btn("save", () => this._save());
    btn("refresh", () => this._refreshList());
    btn("enable", () => this._setEnabled(true));
    btn("disable", () => this._setEnabled(false));
    btn("demand_on", () => this._setDemand(true));
    btn("demand_off", () => this._setDemand(false));
    btn("reconcile", () => this._reconcile());
    btn("refresh_logs", async () => {
      this._busy = true;
      this._render();
      await this._loadLogs();
      this._busy = false;
      this._render();
    });
  }

  _render() {
    if (!this.shadowRoot) return;
    const c = this._config || {};
    const st = this._status || {};
    const enabled = st.enabled !== false;
    const demand = !!st.desired_on;
    const pump = st.pump_on === true;
    const pct = this._percent();
    const dist =
      st.distance === null || st.distance === undefined
        ? "—"
        : `${Number(st.distance).toFixed(3)}`;
    const timed =
      this._num("work_minutes", 0) > 0 || this._num("rest_minutes", 0) > 0;
    const sec = this._section;

    this.shadowRoot.innerHTML = `
      ${this._styles()}
      <div class="page">
        <div class="wrap">
          <div class="hero">
            <div>
              <h1>Tankwise <span class="ver">${this._esc(this._version || "")}</span></h1>
              <p>Controle amigável da bomba artesiana e da caixa d'água.</p>
            </div>
            <span class="badge ${enabled ? "ok" : "off"}">${enabled ? "Automação ativa" : "Automação desligada"}</span>
          </div>

          ${this._err ? `<div class="err">${this._esc(this._err)}</div>` : ""}
          ${this._msg ? `<div class="msg">${this._esc(this._msg)}</div>` : ""}

          ${
            !this._entries.length
              ? `<div class="card empty">Nenhuma instalação Tankwise encontrada.<br/>Em Configurações → Dispositivos e serviços, adicione a integração Tankwise.</div>`
              : `
          <div class="card">
            <div class="grid">
              <div>
                <label for="entry">Instalação</label>
                <select id="entry">
                  ${this._entries
                    .map((e) => {
                      const on = e.status?.enabled !== false;
                      return `<option value="${this._esc(e.entry_id)}" ${
                        e.entry_id === this._selected ? "selected" : ""
                      }>${this._esc(e.title)}${on ? "" : " (OFF)"}</option>`;
                    })
                    .join("")}
                </select>
              </div>
            </div>
            <div class="tabs" style="margin-top:14px">
              <button class="tab ${sec === "monitor" ? "active" : ""}" data-tab="monitor" type="button">Monitor</button>
              <button class="tab ${sec === "config" ? "active" : ""}" data-tab="config" type="button">Entidades & calibração</button>
              <button class="tab ${sec === "cycle" ? "active" : ""}" data-tab="cycle" type="button">Temporização</button>
              <button class="tab ${sec === "alerts" ? "active" : ""}" data-tab="alerts" type="button">Alertas</button>
              <button class="tab ${sec === "logs" ? "active" : ""}" data-tab="logs" type="button">Logs</button>
            </div>
          </div>

          ${
            sec === "monitor"
              ? `
          <div class="card">
            <h2>Status ao vivo</h2>
            <div class="desc">Volume da caixa, estado da bomba e controle manual da demanda (variável de ambiente).</div>
            <div class="visuals">
              <div class="visual">${this._tankSvg(pct)}</div>
              <div class="visual">${this._pumpSvg(pump)}</div>
              <div class="visual" style="align-items:stretch; width:100%">
                <div class="stats">
                  <div class="stat ${enabled ? "on" : "off"}"><div class="k">Controlador</div><div class="v">${enabled ? "ON" : "OFF"}</div></div>
                  <div class="stat ${demand ? "on" : "off"}"><div class="k">Demanda</div><div class="v">${demand ? "1 / ON" : "0 / OFF"}</div></div>
                  <div class="stat ${pump ? "on" : "off"}"><div class="k">Bomba física</div><div class="v">${pump ? "Ligada" : "Parada"}</div></div>
                  <div class="stat"><div class="k">Distância</div><div class="v">${dist}</div></div>
                  <div class="stat"><div class="k">Nível</div><div class="v">${pct === null ? "—" : pct.toFixed(0) + "%"}</div></div>
                  <div class="stat"><div class="k">Fase</div><div class="v" style="font-size:1rem">${this._esc(st.cycle_phase || "idle")}</div></div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>Acionamento manual</h2>
            <div class="desc">Altera a demanda persistida (equivalente à variável de ambiente 1/0). O reconciliador aplica na bomba física.</div>
            <div class="manual-box">
              <div>
                <div class="hint" style="margin-bottom:8px">Automação (controller)</div>
                <div class="actions" style="margin:0">
                  <button id="enable" ${this._busy || enabled ? "disabled" : ""}>Ligar automação</button>
                  <button id="disable" class="danger" ${this._busy || !enabled ? "disabled" : ""}>Desligar automação</button>
                </div>
              </div>
              <div>
                <div class="hint" style="margin-bottom:8px">Demanda (variável ambiente)</div>
                <div class="actions" style="margin:0">
                  <button id="demand_on" ${this._busy ? "disabled" : ""}>Demanda = 1 (ON)</button>
                  <button id="demand_off" class="secondary" ${this._busy ? "disabled" : ""}>Demanda = 0 (OFF)</button>
                </div>
              </div>
              <div>
                <div class="hint" style="margin-bottom:8px">Manutenção</div>
                <div class="actions" style="margin:0">
                  <button id="reconcile" class="secondary" ${this._busy ? "disabled" : ""}>Reconciliar agora</button>
                  <button id="refresh" class="secondary" ${this._busy ? "disabled" : ""}>Atualizar</button>
                </div>
              </div>
            </div>
          </div>
          `
              : ""
          }

          ${
            sec === "config"
              ? `
          <div class="card">
            <h2>Entidades</h2>
            <div class="desc">Selecione o interruptor da bomba e o sensor de distância (como no painel do OneDrive Backup).</div>
            <div class="grid">
              <div>
                <label>Controle da bomba *</label>
                <select data-key="pump_entity">${this._options(
                  ["switch", "light", "input_boolean"],
                  c.pump_entity
                )}</select>
              </div>
              <div>
                <label>Sensor de distância *</label>
                <select data-key="distance_entity">${this._options(
                  ["sensor", "input_number", "number"],
                  c.distance_entity
                )}</select>
                <div class="hint">Preferir sensor em metros (ex.: sensor.cxdagua_distance), não o de %.</div>
              </div>
              <div>
                <label>Botões físicos (opcional)</label>
                <select data-key="toggle_entities" multiple>${this._options(
                  ["binary_sensor", "input_boolean", "switch"],
                  this._list("toggle_entities"),
                  { multiple: true }
                )}</select>
              </div>
              <div>
                <label>LEDs / feedback (opcional)</label>
                <select data-key="led_entities" multiple>${this._options(
                  ["light", "switch", "input_boolean"],
                  this._list("led_entities"),
                  { multiple: true }
                )}</select>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>Calibração da caixa</h2>
            <div class="desc">Menor distância = tanque mais cheio (ultrassônico).</div>
            <div class="grid">
              <div>
                <label>Distância cheio</label>
                <input type="number" step="any" data-key="full_distance" value="${this._esc(this._val("full_distance", 0.25))}">
              </div>
              <div>
                <label>Distância vazio</label>
                <input type="number" step="any" data-key="empty_distance" value="${this._esc(this._val("empty_distance", 0.47))}">
              </div>
              <div>
                <label>Limiar ligar demanda (distância ≥)</label>
                <input type="number" step="any" data-key="on_threshold" value="${this._esc(this._val("on_threshold", 0.4))}">
                <div class="hint">Liga quando a distância fica acima deste valor (caixa mais vazia). Deve ser maior que o limiar de desligar.</div>
              </div>
              <div>
                <label>Limiar desligar demanda (distância ≤)</label>
                <input type="number" step="any" data-key="off_threshold" value="${this._esc(this._val("off_threshold", 0.28))}">
                <div class="hint">Desliga quando a distância fica abaixo deste valor (caixa mais cheia).</div>
              </div>
              <div>
                <label>Hold ligar (s)</label>
                <input type="number" step="1" min="0" data-key="on_hold_seconds" value="${this._esc(this._val("on_hold_seconds", 120))}">
              </div>
              <div>
                <label>Hold desligar (s)</label>
                <input type="number" step="1" min="0" data-key="off_hold_seconds" value="${this._esc(this._val("off_hold_seconds", 120))}">
              </div>
            </div>
            <div class="check">
              <input type="checkbox" data-key="expose_percentage" ${this._bool("expose_percentage", true) ? "checked" : ""}>
              Expor sensor de nível (%)
            </div>
            <div class="actions">
              <button id="save" ${this._busy ? "disabled" : ""}>Salvar configuração</button>
            </div>
          </div>
          `
              : ""
          }

          ${
            sec === "cycle"
              ? `
          <div class="card">
            <h2>Acionamento temporizado</h2>
            <div class="desc">Quando ativo, a bomba trabalha em ciclos de trabalho/descanso. Desligado = contínuo enquanto houver demanda.</div>
            <div class="check">
              <input type="checkbox" id="timed_mode" ${timed ? "checked" : ""}>
              Usar temporização (trabalho / descanso)
            </div>
            <div class="grid">
              <div>
                <label>Período acionado (min)</label>
                <input type="number" step="0.5" min="0" data-key="work_minutes" value="${this._esc(this._val("work_minutes", timed ? 30 : 0))}" ${timed ? "" : "disabled"}>
              </div>
              <div>
                <label>Período desacionado (min)</label>
                <input type="number" step="0.5" min="0" data-key="rest_minutes" value="${this._esc(this._val("rest_minutes", timed ? 30 : 0))}" ${timed ? "" : "disabled"}>
              </div>
              <div>
                <label>Margem failsafe (min)</label>
                <input type="number" step="0.5" min="0" data-key="failsafe_margin_minutes" value="${this._esc(this._val("failsafe_margin_minutes", 5))}">
              </div>
              <div>
                <label>Intervalo reconcile (s)</label>
                <input type="number" step="1" min="15" data-key="reconcile_interval" value="${this._esc(this._val("reconcile_interval", 120))}">
              </div>
            </div>
            <div class="actions">
              <button id="save" ${this._busy ? "disabled" : ""}>Salvar temporização</button>
            </div>
          </div>
          `
              : ""
          }

          ${
            sec === "alerts"
              ? `
          <div class="card">
            <h2>Notificações de nível</h2>
            <div class="desc">Avisos quando a caixa estiver baixa ou crítica.</div>
            <div class="grid">
              <div>
                <label>Serviço notify</label>
                <input type="text" data-key="notify_service" value="${this._esc(this._val("notify_service", ""))}" placeholder="notify.mobile_app_seu_telefone">
              </div>
              <div>
                <label>Nível baixo (%)</label>
                <input type="number" step="1" min="0" max="100" data-key="low_level_percent" value="${this._esc(this._val("low_level_percent", 60))}">
              </div>
              <div>
                <label>Nível crítico (%)</label>
                <input type="number" step="1" min="0" max="100" data-key="critical_level_percent" value="${this._esc(this._val("critical_level_percent", 25))}">
              </div>
              <div>
                <label>Hold notificação (s)</label>
                <input type="number" step="1" min="0" data-key="level_notify_hold_seconds" value="${this._esc(this._val("level_notify_hold_seconds", 120))}">
              </div>
            </div>
            <div class="actions">
              <button id="save" ${this._busy ? "disabled" : ""}>Salvar alertas</button>
            </div>
          </div>
          `
              : ""
          }
          `
          }
        </div>
      </div>
    `;
    this._bind();
  }
}

customElements.define("tankwise-panel", TankwisePanel);
