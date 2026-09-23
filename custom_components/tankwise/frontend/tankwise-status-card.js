import { t as i18nT, resolveLang } from "./i18n.js";

/**
 * Lovelace card: Tankwise live status tiles (controller, demand, pump, distance, level, phase).
 *
 * Example YAML:
 *   type: custom:tankwise-status-card
 *   entry_id: <optional when only one installation exists>
 *   name: optional title
 *   show_title: true
 *   show_holds: true
 *   refresh_seconds: 5
 */
const CARD_TYPE = "tankwise-status-card";

const CARD_I18N = {
  en: {
    card_name: "Tankwise status",
    card_desc: "Live status tiles: controller, demand, pump, distance, level and phase.",
    pick_entry: "Installation",
    auto_entry: "Automatic (single installation)",
    title: "Title (optional)",
    show_title: "Show title",
    show_holds: "Show hysteresis hold progress",
    refresh: "Refresh (seconds)",
    no_entry: "No Tankwise installation found. Configure the integration first.",
    load_error: "Could not load Tankwise status.",
    loading: "Loading status…",
  },
  pt: {
    card_name: "Status Tankwise",
    card_desc: "Quadro ao vivo: controlador, demanda, bomba, distância, nível e fase.",
    pick_entry: "Instalação",
    auto_entry: "Automática (uma instalação)",
    title: "Título (opcional)",
    show_title: "Mostrar título",
    show_holds: "Mostrar progresso do hold de histerese",
    refresh: "Atualizar (segundos)",
    no_entry: "Nenhuma instalação Tankwise encontrada. Configure a integração primeiro.",
    load_error: "Não foi possível carregar o status do Tankwise.",
    loading: "Carregando status…",
  },
};

function cardT(lang, key) {
  const pack = CARD_I18N[lang] || CARD_I18N.en;
  return pack[key] || CARD_I18N.en[key] || key;
}

class TankwiseStatusCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {
      type: `custom:${CARD_TYPE}`,
      show_title: true,
      show_holds: true,
      refresh_seconds: 5,
    };
    this._entries = [];
    this._status = null;
    this._title = "";
    this._loading = true;
    this._error = "";
    this._busy = false;
  }

  static getStubConfig() {
    return {
      type: `custom:${CARD_TYPE}`,
      show_title: true,
      show_holds: true,
      refresh_seconds: 5,
    };
  }

  static getConfigElement() {
    return document.createElement("tankwise-status-card-editor");
  }

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Invalid configuration");
    }
    const refresh = Math.max(3, Number(config.refresh_seconds) || 5);
    this._config = {
      type: `custom:${CARD_TYPE}`,
      entry_id: config.entry_id || "",
      name: config.name || "",
      show_title: config.show_title !== false,
      show_holds: config.show_holds !== false,
      refresh_seconds: refresh,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const lang = this._lang();
    if (!this._booted) {
      this._booted = true;
      this._lastLang = lang;
      this._boot();
    } else if (this._lastLang !== lang) {
      this._lastLang = lang;
      this._render();
    }
  }

  getCardSize() {
    return this._config.show_title === false ? 3 : 4;
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    if (this._poll) {
      clearInterval(this._poll);
      this._poll = null;
    }
  }

  _lang() {
    const raw =
      (this._hass && (this._hass.language || (this._hass.locale && this._hass.locale.language))) ||
      "en";
    return resolveLang(raw);
  }

  _t(key, vars) {
    return i18nT(this._lang(), key, vars);
  }

  _ct(key) {
    return cardT(this._lang(), key);
  }

  _esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async _ws(type, data = {}) {
    return this._hass.callWS({ type, ...data });
  }

  async _boot() {
    await this._refreshEntries();
    await this._loadStatus();
    if (this._poll) clearInterval(this._poll);
    this._poll = setInterval(() => {
      if (!this._hass || this._busy) return;
      this._loadStatus({ silent: true });
    }, (this._config.refresh_seconds || 5) * 1000);
  }

  _resolveEntryId() {
    if (this._config.entry_id) return this._config.entry_id;
    if (this._entries.length) return this._entries[0].entry_id;
    return null;
  }

  async _refreshEntries() {
    if (!this._hass) return;
    try {
      const res = await this._ws("tankwise/card_entries");
      this._entries = (res && res.entries) || [];
    } catch (_err) {
      this._entries = [];
    }
  }

  async _loadStatus({ silent = false } = {}) {
    if (!this._hass) return;
    const entryId = this._resolveEntryId();
    if (!entryId) {
      this._loading = false;
      this._status = null;
      this._error = this._ct("no_entry");
      this._render();
      return;
    }
    if (!silent) {
      this._loading = true;
      this._error = "";
      this._render();
    }
    this._busy = true;
    try {
      const res = await this._ws("tankwise/card_status", { entry_id: entryId });
      this._status = (res && res.status) || null;
      this._title = (res && res.title) || "";
      this._loading = false;
      this._error = "";
    } catch (err) {
      this._loading = false;
      this._status = null;
      this._error = err.message || this._ct("load_error");
    }
    this._busy = false;
    this._render();
  }

  _cardTitle() {
    if (this._config.name) return this._config.name;
    if (this._title) return this._title;
    return this._t("live_status");
  }

  _styles() {
    return `
      :host { display: block; }
      ha-card { overflow: hidden; }
      .wrap { padding: 12px 14px 16px; }
      .title {
        margin: 0 0 10px; font-size: 1.05rem; font-weight: 600;
        color: var(--primary-text-color);
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      @media (max-width: 420px) {
        .stats { grid-template-columns: 1fr; }
      }
      .stat {
        background: var(--secondary-background-color, #f7faf8);
        border: 1px solid var(--divider-color, #d7e0db);
        border-radius: 12px;
        padding: 12px;
      }
      .stat .k {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: .04em;
        color: var(--secondary-text-color, #5b6b63);
      }
      .stat .v {
        font-size: 1.2rem;
        font-weight: 700;
        margin-top: 4px;
        color: var(--primary-text-color, #16382c);
        word-break: break-word;
      }
      .stat.on .v { color: var(--success-color, #1b7f5a); }
      .stat.off .v { color: var(--error-color, #c62828); }
      .stat.phase .v { font-size: 1rem; }
      .hint {
        color: var(--secondary-text-color);
        font-size: 0.9rem;
        margin-top: 10px;
      }
      .loading, .error {
        padding: 20px 4px;
        text-align: center;
        color: var(--secondary-text-color);
      }
      .error { color: var(--error-color, #c62828); }
    `;
  }

  _tilesHtml(st) {
    const enabled = st.enabled !== false;
    const demand = !!st.desired_on;
    const pump = st.pump_on === true;
    const dist =
      st.distance === null || st.distance === undefined
        ? "—"
        : `${Number(st.distance).toFixed(3)}`;
    const pct =
      st.percent === null || st.percent === undefined
        ? "—"
        : `${Number(st.percent).toFixed(0)}%`;
    const phase = st.cycle_phase || "idle";

    const holds = [];
    if (this._config.show_holds !== false) {
      if (st.on_hold_elapsed != null && !demand) {
        holds.push(
          this._t("hold_on", {
            elapsed: Number(st.on_hold_elapsed).toFixed(0),
            target: Number(st.on_hold_seconds || 120),
          })
        );
      }
      if (st.off_hold_elapsed != null && demand) {
        holds.push(
          this._t("hold_off", {
            elapsed: Number(st.off_hold_elapsed).toFixed(0),
            target: Number(st.off_hold_seconds || 120),
          })
        );
      }
    }

    return `
      <div class="stats">
        <div class="stat ${enabled ? "on" : "off"}">
          <div class="k">${this._esc(this._t("controller"))}</div>
          <div class="v">${enabled ? "ON" : "OFF"}</div>
        </div>
        <div class="stat ${demand ? "on" : "off"}">
          <div class="k">${this._esc(this._t("demand"))}</div>
          <div class="v">${demand ? "1 / ON" : "0 / OFF"}</div>
        </div>
        <div class="stat ${pump ? "on" : "off"}">
          <div class="k">${this._esc(this._t("physical_pump"))}</div>
          <div class="v">${pump ? this._esc(this._t("status_on")) : this._esc(this._t("status_off"))}</div>
        </div>
        <div class="stat">
          <div class="k">${this._esc(this._t("distance"))}</div>
          <div class="v">${this._esc(dist)}</div>
        </div>
        <div class="stat">
          <div class="k">${this._esc(this._t("level"))}</div>
          <div class="v">${this._esc(pct)}</div>
        </div>
        <div class="stat phase">
          <div class="k">${this._esc(this._t("phase"))}</div>
          <div class="v">${this._esc(phase)}</div>
        </div>
      </div>
      ${holds.map((h) => `<div class="hint">${this._esc(h)}</div>`).join("")}
    `;
  }

  _render() {
    if (!this.shadowRoot) return;
    let body;
    if (this._loading && !this._status) {
      body = `<div class="loading">${this._esc(this._ct("loading"))}</div>`;
    } else if (this._error && !this._status) {
      body = `<div class="error">${this._esc(this._error)}</div>`;
    } else if (!this._status) {
      body = `<div class="error">${this._esc(this._ct("no_entry"))}</div>`;
    } else {
      body = this._tilesHtml(this._status);
    }

    const title =
      this._config.show_title === false
        ? ""
        : `<h2 class="title">${this._esc(this._cardTitle())}</h2>`;

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        <div class="wrap">
          ${title}
          ${body}
        </div>
      </ha-card>
    `;
  }
}

class TankwiseStatusCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = TankwiseStatusCard.getStubConfig();
    this._entries = [];
  }

  setConfig(config) {
    this._config = { ...TankwiseStatusCard.getStubConfig(), ...(config || {}) };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._loadedEntries) {
      this._loadedEntries = true;
      this._loadEntries().then(() => this._render());
    } else {
      this._render();
    }
  }

  _lang() {
    const raw =
      (this._hass && (this._hass.language || (this._hass.locale && this._hass.locale.language))) ||
      "en";
    return resolveLang(raw);
  }

  _ct(key) {
    return cardT(this._lang(), key);
  }

  _t(key) {
    return i18nT(this._lang(), key);
  }

  _esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async _loadEntries() {
    if (!this._hass) return;
    try {
      const res = await this._hass.callWS({ type: "tankwise/card_entries" });
      this._entries = (res && res.entries) || [];
    } catch (_err) {
      this._entries = [];
    }
  }

  _fire() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _onChange(ev) {
    const el = ev.target;
    const key = el.getAttribute("data-key");
    if (!key) return;
    let value = el.type === "checkbox" ? el.checked : el.value;
    if (key === "refresh_seconds") value = Math.max(3, Number(value) || 5);
    if (key === "entry_id" && !value) value = "";
    this._config = { ...this._config, [key]: value };
    this._fire();
  }

  _render() {
    if (!this.shadowRoot) return;
    const cfg = this._config;
    const options = [
      `<option value="">${this._esc(this._ct("auto_entry"))}</option>`,
      ...this._entries.map((e) => {
        const label = e.title || e.name || e.entry_id;
        const selected = cfg.entry_id === e.entry_id ? "selected" : "";
        return `<option value="${this._esc(e.entry_id)}" ${selected}>${this._esc(label)}</option>`;
      }),
    ].join("");

    this.shadowRoot.innerHTML = `
      <style>
        .form { display: grid; gap: 12px; padding: 4px 0; }
        label { display: grid; gap: 4px; font-size: 0.9rem; color: var(--primary-text-color); }
        input, select {
          padding: 8px 10px; border-radius: 8px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .row { display: flex; align-items: center; gap: 8px; }
      </style>
      <div class="form">
        <label>${this._esc(this._ct("pick_entry"))}
          <select data-key="entry_id">${options}</select>
        </label>
        <label>${this._esc(this._ct("title"))}
          <input data-key="name" type="text" value="${this._esc(cfg.name || "")}" placeholder="${this._esc(this._t("live_status"))}"/>
        </label>
        <label class="row">
          <input data-key="show_title" type="checkbox" ${cfg.show_title !== false ? "checked" : ""}/>
          ${this._esc(this._ct("show_title"))}
        </label>
        <label class="row">
          <input data-key="show_holds" type="checkbox" ${cfg.show_holds !== false ? "checked" : ""}/>
          ${this._esc(this._ct("show_holds"))}
        </label>
        <label>${this._esc(this._ct("refresh"))}
          <input data-key="refresh_seconds" type="number" min="3" step="1" value="${Number(cfg.refresh_seconds) || 5}"/>
        </label>
      </div>
    `;
    this.shadowRoot.querySelectorAll("[data-key]").forEach((el) => {
      el.onchange = (ev) => this._onChange(ev);
      if (el.tagName === "INPUT" && el.type === "text") {
        el.oninput = (ev) => this._onChange(ev);
      }
    });
  }
}

customElements.define(CARD_TYPE, TankwiseStatusCard);
customElements.define("tankwise-status-card-editor", TankwiseStatusCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TYPE,
  name: "Tankwise Status",
  description: "Live status tiles: controller, demand, pump, distance, level and phase",
  preview: true,
  documentationURL: "https://github.com/augleao/TankWise",
});
