/**
 * Tankwise sidebar panel — graphical configuration (add-on style dashboard).
 * Config keys match custom_components/tankwise/const.py
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
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._booted) {
      this._booted = true;
      this._boot();
    } else {
      this._render();
    }
  }

  connectedCallback() {
    this._render();
  }

  async _boot() {
    await this._loadEntities();
    await this._refreshList();
    this._render();
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
        } else {
          this._selected = this._entries[0]?.entry_id || null;
          if (this._selected) {
            await this._loadConfig(this._selected);
          }
        }
      }
      this._err = "";
    } catch (e) {
      this._err = e.message || String(e);
    }
    this._render();
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
    const v = this._val(key, fallback);
    return Boolean(v);
  }

  _list(key) {
    const v = this._val(key, []);
    return Array.isArray(v) ? v : [];
  }

  _onInput(key, ev) {
    if (!this._config) return;
    const el = ev.target;
    let value;
    if (el.type === "checkbox") {
      value = el.checked;
    } else if (el.multiple) {
      value = Array.from(el.selectedOptions).map((o) => o.value).filter(Boolean);
    } else if (el.type === "number") {
      value = el.value === "" ? null : Number(el.value);
    } else {
      value = el.value === "" ? null : el.value;
    }
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
      this._msg =
        "Configuração salva. O controlador recarregou com os novos parâmetros.";
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
        ? "Controlador ligado."
        : "Controlador desligado (bomba forçada OFF).";
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
      this._msg = desiredOn ? "Demanda ligada." : "Demanda desligada.";
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
      for (const item of this._entities[d] || []) {
        map.set(item.id, item);
      }
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
    const opts = multiple
      ? []
      : [`<option value="">— nenhum —</option>`];
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

  _bind() {
    const root = this.shadowRoot;
    root.querySelectorAll("[data-key]").forEach((el) => {
      const key = el.getAttribute("data-key");
      const handler = (ev) => this._onInput(key, ev);
      el.onchange = handler;
      if (el.tagName === "INPUT" && el.type === "number") {
        el.oninput = handler;
      }
    });
    const entrySel = root.getElementById("entry");
    if (entrySel) {
      entrySel.onchange = async (ev) => {
        this._selected = ev.target.value;
        await this._loadConfig(this._selected);
        this._render();
      };
    }
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
  }

  _render() {
    if (!this.shadowRoot) return;
    const c = this._config || {};
    const st = this._status || {};
    const enabled = st.enabled !== false;
    const demand = !!st.desired_on;
    const pump = st.pump_on === true;
    const pumpLabel =
      st.pump_on === null || st.pump_on === undefined
        ? "—"
        : st.pump_on
          ? "ON"
          : "OFF";
    const dist =
      st.distance === null || st.distance === undefined
        ? "—"
        : Number(st.distance).toFixed(3);
    const pct =
      st.percent === null || st.percent === undefined
        ? "—"
        : `${Number(st.percent).toFixed(0)}%`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif); color: var(--primary-text-color); }
        .wrap { max-width: 980px; margin: 0 auto; padding: 16px; }
        h1 { font-size: 1.6rem; margin: 0 0 4px; }
        .sub { opacity: .7; margin-bottom: 16px; }
        .row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom: 16px; }
        .card {
          background: var(--card-background-color, #fff);
          border-radius: 12px;
          padding: 14px 16px;
          box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0,0,0,.08));
          flex: 1 1 140px;
        }
        .card .label { font-size: .75rem; text-transform: uppercase; opacity: .65; letter-spacing: .04em; }
        .card .value { font-size: 1.25rem; font-weight: 600; margin-top: 4px; }
        .card.on .value { color: var(--success-color, #4caf50); }
        .card.off .value { color: var(--error-color, #f44336); }
        .panel {
          background: var(--card-background-color, #fff);
          border-radius: 12px;
          padding: 18px;
          margin-bottom: 16px;
          box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0,0,0,.08));
        }
        .panel h2 { margin: 0 0 12px; font-size: 1.1rem; }
        .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
        label { display:block; font-size: .85rem; margin-bottom: 4px; opacity: .85; }
        select, input[type=number], input[type=text] {
          width: 100%; box-sizing: border-box; padding: 8px 10px;
          border-radius: 8px; border: 1px solid var(--divider-color, #ccc);
          background: var(--primary-background-color, #fafafa);
          color: var(--primary-text-color); font-size: 0.95rem;
        }
        select[multiple] { min-height: 110px; }
        .check { display:flex; align-items:center; gap:8px; margin-top: 8px; }
        .check input { width:auto; }
        .actions { display:flex; gap:8px; flex-wrap:wrap; margin-top: 8px; }
        button {
          border: none; border-radius: 8px; padding: 10px 14px; cursor: pointer;
          background: var(--primary-color, #03a9f4); color: #fff; font-weight: 600;
        }
        button.secondary { background: var(--secondary-background-color, #eee); color: var(--primary-text-color); }
        button.danger { background: var(--error-color, #f44336); }
        button:disabled { opacity: .5; cursor: default; }
        .msg { padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; background: rgba(76,175,80,.15); }
        .err { padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; background: rgba(244,67,54,.15); }
        .hint { font-size: .8rem; opacity: .65; margin-top: 4px; }
        .empty { padding: 40px; text-align:center; opacity: .7; }
      </style>
      <div class="wrap">
        <h1>Tankwise</h1>
        <div class="sub">Painel gráfico para entidades e parâmetros da bomba artesiana.</div>

        ${this._err ? `<div class="err">${this._esc(this._err)}</div>` : ""}
        ${this._msg ? `<div class="msg">${this._esc(this._msg)}</div>` : ""}

        ${
          !this._entries.length
            ? `<div class="empty">Nenhuma instalação Tankwise encontrada.<br/>Adicione a integração em Configurações → Dispositivos e serviços.</div>`
            : `
        <div class="panel">
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
          <div class="actions" style="margin-top:12px">
            <button id="refresh" class="secondary" ${this._busy ? "disabled" : ""}>Atualizar</button>
            <button id="enable" ${this._busy || enabled ? "disabled" : ""}>Ligar controlador</button>
            <button id="disable" class="danger" ${this._busy || !enabled ? "disabled" : ""}>Desligar controlador</button>
            <button id="demand_on" class="secondary" ${this._busy ? "disabled" : ""}>Demanda ON</button>
            <button id="demand_off" class="secondary" ${this._busy ? "disabled" : ""}>Demanda OFF</button>
            <button id="reconcile" class="secondary" ${this._busy ? "disabled" : ""}>Reconciliar agora</button>
          </div>
        </div>

        <div class="row">
          <div class="card ${enabled ? "on" : "off"}"><div class="label">Controlador</div><div class="value">${enabled ? "ON" : "OFF"}</div></div>
          <div class="card ${demand ? "on" : "off"}"><div class="label">Demanda</div><div class="value">${demand ? "ON" : "OFF"}</div></div>
          <div class="card ${pump ? "on" : "off"}"><div class="label">Bomba física</div><div class="value">${pumpLabel}</div></div>
          <div class="card"><div class="label">Distância</div><div class="value">${dist}</div></div>
          <div class="card"><div class="label">Nível</div><div class="value">${pct}</div></div>
          <div class="card"><div class="label">Fase</div><div class="value" style="font-size:1rem">${this._esc(st.cycle_phase || "—")}</div></div>
        </div>

        <div class="panel">
          <h2>1. Entidades</h2>
          <div class="grid">
            <div>
              <label>Interruptor da bomba *</label>
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
              <div class="hint">Use o sensor em metros (ex.: sensor.cxdagua_distance)</div>
            </div>
            <div>
              <label>Toggles físicos (Ctrl/Cmd para vários)</label>
              <select data-key="toggle_entities" multiple>${this._options(
                ["binary_sensor", "input_boolean", "switch"],
                this._list("toggle_entities"),
                { multiple: true }
              )}</select>
            </div>
            <div>
              <label>LEDs / feedback (Ctrl/Cmd para vários)</label>
              <select data-key="led_entities" multiple>${this._options(
                ["light", "switch", "input_boolean"],
                this._list("led_entities"),
                { multiple: true }
              )}</select>
            </div>
          </div>
        </div>

        <div class="panel">
          <h2>2. Calibração do tanque</h2>
          <div class="grid">
            <div><label>Distância cheio (menor)</label><input type="number" step="any" data-key="full_distance" value="${this._esc(this._val("full_distance", 82))}"></div>
            <div><label>Distância vazio (maior)</label><input type="number" step="any" data-key="empty_distance" value="${this._esc(this._val("empty_distance", 120))}"></div>
          </div>
          <div class="check"><input type="checkbox" data-key="expose_percentage" ${this._bool("expose_percentage", true) ? "checked" : ""}> Expor sensor de nível (%)</div>
          <div class="hint">Mesma unidade do sensor. Em metros: ex. cheio 0.25 / vazio 0.47. Menor distância = mais cheio.</div>
        </div>

        <div class="panel">
          <h2>3. Histerese e reconciliador</h2>
          <div class="grid">
            <div><label>Limiar ligar demanda</label><input type="number" step="any" data-key="on_threshold" value="${this._esc(this._val("on_threshold", 82))}"></div>
            <div><label>Limiar desligar demanda</label><input type="number" step="any" data-key="off_threshold" value="${this._esc(this._val("off_threshold", 96))}"></div>
            <div><label>Hold ligar (s)</label><input type="number" step="1" min="0" data-key="on_hold_seconds" value="${this._esc(this._val("on_hold_seconds", 120))}"></div>
            <div><label>Hold desligar (s)</label><input type="number" step="1" min="0" data-key="off_hold_seconds" value="${this._esc(this._val("off_hold_seconds", 120))}"></div>
            <div><label>Intervalo reconcile (s)</label><input type="number" step="1" min="15" data-key="reconcile_interval" value="${this._esc(this._val("reconcile_interval", 120))}"></div>
            <div><label>Retries reconcile</label><input type="number" step="1" min="1" data-key="reconcile_retries" value="${this._esc(this._val("reconcile_retries", 3))}"></div>
          </div>
          <div class="hint">O limiar de desligar deve ser maior que o de ligar (faixa morta entre eles).</div>
        </div>

        <div class="panel">
          <h2>4. Ciclo trabalho / descanso</h2>
          <div class="hint">Rest = 0 → contínuo (sem descanso).</div>
          <div class="grid" style="margin-top:12px">
            <div><label>Trabalho (min)</label><input type="number" step="0.5" min="0" data-key="work_minutes" value="${this._esc(this._val("work_minutes", 0))}"></div>
            <div><label>Descanso (min)</label><input type="number" step="0.5" min="0" data-key="rest_minutes" value="${this._esc(this._val("rest_minutes", 0))}"></div>
            <div><label>Margem failsafe (min)</label><input type="number" step="0.5" min="0" data-key="failsafe_margin_minutes" value="${this._esc(this._val("failsafe_margin_minutes", 5))}"></div>
          </div>
        </div>

        <div class="panel">
          <h2>5. Notificações</h2>
          <div class="grid">
            <div><label>Serviço de notificação</label><input type="text" data-key="notify_service" value="${this._esc(this._val("notify_service", ""))}" placeholder="notify.mobile_app_..."></div>
            <div><label>Nível baixo (%)</label><input type="number" step="1" min="0" max="100" data-key="low_level_percent" value="${this._esc(this._val("low_level_percent", 60))}"></div>
            <div><label>Nível crítico (%)</label><input type="number" step="1" min="0" max="100" data-key="critical_level_percent" value="${this._esc(this._val("critical_level_percent", 25))}"></div>
            <div><label>Hold notificação (s)</label><input type="number" step="1" min="0" data-key="level_notify_hold_seconds" value="${this._esc(this._val("level_notify_hold_seconds", 120))}"></div>
          </div>
        </div>

        <div class="actions">
          <button id="save" ${this._busy ? "disabled" : ""}>Salvar configuração</button>
        </div>
        `
        }
      </div>
    `;
    this._bind();
  }
}

customElements.define("tankwise-panel", TankwisePanel);
