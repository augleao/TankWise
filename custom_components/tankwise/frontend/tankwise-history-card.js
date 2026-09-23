import { t as i18nT, resolveLang } from "./i18n.js";

/**
 * Lovelace card: Tankwise level + pump history for any dashboard.
 *
 * Example YAML:
 *   type: custom:tankwise-history-card
 *   entry_id: <optional when only one installation exists>
 *   name: optional title
 *   range: 1h | 1d | 1w | 1m
 *   show_range_tabs: true
 *   refresh_seconds: 60
 */
const CARD_TYPE = "tankwise-history-card";
const RANGES = ["1h", "1d", "1w", "1m"];

const CARD_I18N = {
  en: {
    card_name: "Tankwise history",
    card_desc: "Tank level and pump on/off charts from Tankwise.",
    pick_entry: "Installation",
    auto_entry: "Automatic (single installation)",
    title: "Title (optional)",
    default_range: "Default range",
    show_tabs: "Show range tabs",
    refresh: "Refresh (seconds)",
    no_entry: "No Tankwise installation found. Configure the integration first.",
    need_admin:
      "Could not load history. Sign in as an administrator or check Tankwise setup.",
  },
  pt: {
    card_name: "Histórico Tankwise",
    card_desc: "Gráficos de nível da caixa e bomba ligada/desligada do Tankwise.",
    pick_entry: "Instalação",
    auto_entry: "Automática (uma instalação)",
    title: "Título (opcional)",
    default_range: "Período padrão",
    show_tabs: "Mostrar abas de período",
    refresh: "Atualizar (segundos)",
    no_entry: "Nenhuma instalação Tankwise encontrada. Configure a integração primeiro.",
    need_admin:
      "Não foi possível carregar o histórico. Entre como administrador ou verifique o Tankwise.",
  },
};

function cardT(lang, key) {
  const pack = CARD_I18N[lang] || CARD_I18N.en;
  return pack[key] || CARD_I18N.en[key] || key;
}

class TankwiseHistoryCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { type: `custom:${CARD_TYPE}`, range: "1d", show_range_tabs: true, refresh_seconds: 60 };
    this._entries = [];
    this._history = { loading: true, points: [], pump_points: [], message: null, available: false, range: "1d" };
    this._busy = false;
  }

  static getStubConfig() {
    return {
      type: `custom:${CARD_TYPE}`,
      range: "1d",
      show_range_tabs: true,
      refresh_seconds: 60,
    };
  }

  static getConfigElement() {
    return document.createElement("tankwise-history-card-editor");
  }

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Invalid configuration");
    }
    const range = RANGES.includes(config.range) ? config.range : "1d";
    const refresh = Math.max(15, Number(config.refresh_seconds) || 60);
    this._config = {
      type: `custom:${CARD_TYPE}`,
      entry_id: config.entry_id || "",
      name: config.name || "",
      range,
      show_range_tabs: config.show_range_tabs !== false,
      refresh_seconds: refresh,
    };
    this._history = { ...this._history, range };
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
    return 6;
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
    await this._loadHistory(this._config.range || "1d");
    if (this._poll) clearInterval(this._poll);
    this._poll = setInterval(() => {
      if (!this._hass || this._busy) return;
      this._loadHistory(this._history.range || this._config.range || "1d", { silent: true });
    }, (this._config.refresh_seconds || 60) * 1000);
  }

  _resolveEntryId() {
    if (this._config.entry_id) return this._config.entry_id;
    if (this._entries.length === 1) return this._entries[0].entry_id;
    if (this._entries.length > 1) return this._entries[0].entry_id;
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

  async _loadHistory(range, { silent = false } = {}) {
    if (!this._hass) return;
    const entryId = this._resolveEntryId();
    if (!entryId) {
      this._history = {
        loading: false,
        points: [],
        pump_points: [],
        message: this._ct("no_entry"),
        available: false,
        range,
      };
      this._render();
      return;
    }
    if (!silent) {
      this._history = { ...this._history, loading: true, range, message: null };
      this._render();
    }
    this._busy = true;
    try {
      const res = await this._ws("tankwise/level_history", {
        entry_id: entryId,
        range,
      });
      this._history = {
        range: res.range || range,
        points: res.points || [],
        pump_points: res.pump_points || [],
        loading: false,
        message: res.message || null,
        available: Boolean(res.available),
      };
    } catch (err) {
      this._history = {
        ...this._history,
        loading: false,
        points: [],
        pump_points: [],
        available: false,
        range,
        message: err.message || this._ct("need_admin"),
      };
    }
    this._busy = false;
    this._render();
  }

  _formatHistoryTick(ts, range) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    if (range === "1h" || range === "1d") {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  }

  _historyTimeWindow(levelPoints, pumpPoints) {
    const times = []
      .concat(levelPoints || [], pumpPoints || [])
      .map((p) => Date.parse(p.ts))
      .filter((t) => Number.isFinite(t));
    if (!times.length) return null;
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    return { t0, t1: t1 === t0 ? t0 + 1 : t1 };
  }

  _levelChartSvg(points, pumpPoints, range) {
    const W = 680;
    const H = 380;
    const pad = { t: 28, r: 18, b: 36, l: 52 };
    const gap = 18;
    const levelH = 220;
    const pumpH = 70;
    const iw = W - pad.l - pad.r;
    const levelTop = pad.t;
    const pumpTop = pad.t + levelH + gap;
    const window = this._historyTimeWindow(points, pumpPoints);
    const gid = `twfill-${Math.random().toString(36).slice(2, 9)}`;

    if (!window) {
      return `
        <svg class="level-chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${this._esc(this._t("chart_no_data"))}">
          <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="var(--secondary-background-color, #f7faf8)"/>
          <text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="var(--secondary-text-color, #5b6b63)" font-size="14">${this._esc(this._t("chart_no_data"))}</text>
        </svg>`;
    }

    const { t0, t1 } = window;
    const xAt = (ts) => pad.l + ((Date.parse(ts) - t0) / (t1 - t0)) * iw;
    const levelPts = points || [];
    const pumpPts = pumpPoints || [];

    let levelPath = "";
    let levelArea = "";
    let levelDot = "";
    let levelLabel = "";
    if (levelPts.length) {
      const xy = levelPts.map((p) => {
        const x = xAt(p.ts);
        const y =
          levelTop +
          (1 - Math.max(0, Math.min(100, Number(p.percent) || 0)) / 100) * levelH;
        return [x, y];
      });
      levelPath = xy
        .map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)} ${c[1].toFixed(1)}`)
        .join(" ");
      levelArea = `${levelPath} L${xy[xy.length - 1][0].toFixed(1)} ${(levelTop + levelH).toFixed(
        1
      )} L${xy[0][0].toFixed(1)} ${(levelTop + levelH).toFixed(1)} Z`;
      const last = levelPts[levelPts.length - 1];
      levelDot = `<circle cx="${xy[xy.length - 1][0].toFixed(1)}" cy="${xy[
        xy.length - 1
      ][1].toFixed(1)}" r="4.5" fill="#145c42"/>`;
      levelLabel = `<text x="${pad.l + iw}" y="${levelTop + 14}" text-anchor="end" font-size="12" font-weight="700" fill="#145c42">${Number(
        last.percent
      ).toFixed(0)}%</text>`;
    }

    const grid = [0, 25, 50, 75, 100]
      .map((pct) => {
        const y = levelTop + (1 - pct / 100) * levelH;
        return `
          <line x1="${pad.l}" y1="${y}" x2="${pad.l + iw}" y2="${y}" stroke="var(--divider-color, #d7e0db)" stroke-width="1" ${
            pct === 0 || pct === 100 ? "" : 'stroke-dasharray="4 4"'
          }/>
          <text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--secondary-text-color, #5b6b63)">${pct}%</text>`;
      })
      .join("");

    let pumpPath = "";
    let pumpBands = "";
    let pumpLabel = "";
    if (pumpPts.length) {
      const yOn = pumpTop + 14;
      const yOff = pumpTop + pumpH - 14;
      const segments = [];
      for (let i = 0; i < pumpPts.length; i++) {
        const x = xAt(pumpPts[i].ts);
        const y = pumpPts[i].on ? yOn : yOff;
        segments.push([x, y, Boolean(pumpPts[i].on)]);
      }
      const cmds = [];
      for (let i = 0; i < segments.length; i++) {
        const [x, y] = segments[i];
        if (i === 0) cmds.push(`M${x.toFixed(1)} ${y.toFixed(1)}`);
        else {
          const prevY = segments[i - 1][1];
          cmds.push(`L${x.toFixed(1)} ${prevY.toFixed(1)}`);
          cmds.push(`L${x.toFixed(1)} ${y.toFixed(1)}`);
        }
      }
      pumpPath = cmds.join(" ");
      const bands = [];
      for (let i = 0; i < pumpPts.length; i++) {
        if (!pumpPts[i].on) continue;
        const x1 = xAt(pumpPts[i].ts);
        const x2 = i + 1 < pumpPts.length ? xAt(pumpPts[i + 1].ts) : pad.l + iw;
        bands.push(
          `<rect x="${Math.min(x1, x2).toFixed(1)}" y="${pumpTop}" width="${Math.max(
            0,
            Math.abs(x2 - x1)
          ).toFixed(1)}" height="${pumpH}" fill="#fb8c00" opacity="0.16"/>`
        );
      }
      pumpBands = bands.join("");
      const lastPump = pumpPts[pumpPts.length - 1];
      pumpLabel = `<text x="${pad.l + iw}" y="${pumpTop + 14}" text-anchor="end" font-size="12" font-weight="700" fill="#ef6c00">${
        lastPump.on ? "ON" : "OFF"
      }</text>`;
    }

    const tickSources = levelPts.length ? levelPts : pumpPts;
    const tickIdx = [0, Math.floor((tickSources.length - 1) / 2), tickSources.length - 1].filter(
      (v, i, arr) => arr.indexOf(v) === i && tickSources[v]
    );
    const ticks = tickIdx
      .map((i) => {
        const x = xAt(tickSources[i].ts);
        return `<text x="${x}" y="${H - 12}" text-anchor="middle" font-size="11" fill="var(--secondary-text-color, #5b6b63)">${this._esc(
          this._formatHistoryTick(tickSources[i].ts, range)
        )}</text>`;
      })
      .join("");

    return `
      <svg class="level-chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${this._esc(this._t("history_title"))}">
        <defs>
          <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1b7f5a" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#1b7f5a" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="var(--secondary-background-color, #f7faf8)"/>
        <text x="${pad.l}" y="${levelTop - 8}" font-size="12" font-weight="700" fill="#145c42">${this._esc(this._t("level") || this._t("chart_level"))}</text>
        <g class="chart-legend" transform="translate(${pad.l + 54}, ${levelTop - 18})">
          <line x1="0" y1="8" x2="18" y2="8" stroke="#1b7f5a" stroke-width="2.5"/>
          <text x="24" y="12" font-size="11" fill="var(--secondary-text-color, #5b6b63)">${this._esc(this._t("chart_tank"))}</text>
          <line x1="120" y1="8" x2="138" y2="8" stroke="#ef6c00" stroke-width="2.5"/>
          <text x="144" y="12" font-size="11" fill="var(--secondary-text-color, #5b6b63)">${this._esc(this._t("chart_pump"))}</text>
        </g>
        ${grid}
        ${
          levelPts.length
            ? `<path d="${levelArea}" fill="url(#${gid})"/><path d="${levelPath}" fill="none" stroke="#1b7f5a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${levelDot}${levelLabel}`
            : `<text x="${pad.l + iw / 2}" y="${levelTop + levelH / 2}" text-anchor="middle" fill="var(--secondary-text-color, #5b6b63)" font-size="13">${this._esc(this._t("chart_no_level"))}</text>`
        }
        <text x="${pad.l}" y="${pumpTop - 8}" font-size="12" font-weight="700" fill="#ef6c00">${this._esc(this._t("chart_pump_label"))}</text>
        <rect x="${pad.l}" y="${pumpTop}" width="${iw}" height="${pumpH}" rx="8" fill="var(--card-background-color, #fff)" stroke="var(--divider-color, #d7e0db)"/>
        <text x="${pad.l - 8}" y="${pumpTop + 18}" text-anchor="end" font-size="10" fill="var(--secondary-text-color, #5b6b63)">ON</text>
        <text x="${pad.l - 8}" y="${pumpTop + pumpH - 8}" text-anchor="end" font-size="10" fill="var(--secondary-text-color, #5b6b63)">OFF</text>
        ${pumpBands}
        ${
          pumpPts.length
            ? `<path d="${pumpPath}" fill="none" stroke="#ef6c00" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${pumpLabel}`
            : `<text x="${pad.l + iw / 2}" y="${pumpTop + pumpH / 2 + 4}" text-anchor="middle" fill="var(--secondary-text-color, #5b6b63)" font-size="13">${this._esc(this._t("chart_no_pump"))}</text>`
        }
        ${ticks}
      </svg>`;
  }

  _bind() {
    const root = this.shadowRoot;
    if (!root) return;
    root.querySelectorAll("[data-history-range]").forEach((el) => {
      el.onclick = () => this._loadHistory(el.getAttribute("data-history-range") || "1d");
    });
  }

  _styles() {
    return `
      :host { display: block; }
      ha-card {
        overflow: hidden;
      }
      .wrap { padding: 12px 14px 16px; }
      .head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px; margin-bottom: 8px;
      }
      .title {
        margin: 0; font-size: 1.05rem; font-weight: 600;
        color: var(--primary-text-color);
      }
      .ranges { display: flex; flex-wrap: wrap; gap: 6px; }
      .tab {
        border: 1px solid var(--divider-color, #d7e0db);
        background: var(--secondary-background-color, #f7faf8);
        color: var(--primary-text-color);
        border-radius: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer;
      }
      .tab.active {
        background: #145c42; color: #fff; border-color: #145c42;
      }
      .hint {
        color: var(--secondary-text-color); font-size: 0.9rem; margin: 8px 0;
      }
      .level-chart { display: block; width: 100%; height: auto; }
      .loading { padding: 36px 8px; text-align: center; color: var(--secondary-text-color); }
    `;
  }

  _entryTitle() {
    if (this._config.name) return this._config.name;
    const id = this._resolveEntryId();
    const entry = this._entries.find((e) => e.entry_id === id);
    if (entry && (entry.title || entry.name)) return entry.title || entry.name;
    return this._t("history_title");
  }

  _render() {
    if (!this.shadowRoot) return;
    const hist = this._history || {};
    const range = hist.range || this._config.range || "1d";
    const ranges = [
      ["1h", this._t("range_1h")],
      ["1d", this._t("range_1d")],
      ["1w", this._t("range_1w")],
      ["1m", this._t("range_1m")],
    ];
    const tabs =
      this._config.show_range_tabs === false
        ? ""
        : `<div class="ranges">${ranges
            .map(
              ([key, label]) =>
                `<button type="button" class="tab ${range === key ? "active" : ""}" data-history-range="${key}">${this._esc(label)}</button>`
            )
            .join("")}</div>`;

    const body = hist.loading
      ? `<div class="loading">${this._esc(this._t("loading_history"))}</div>`
      : `${
          hist.message ? `<div class="hint">${this._esc(hist.message)}</div>` : ""
        }${this._levelChartSvg(hist.points, hist.pump_points, range)}`;

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        <div class="wrap">
          <div class="head">
            <h2 class="title">${this._esc(this._entryTitle())}</h2>
            ${tabs}
          </div>
          ${body}
        </div>
      </ha-card>
    `;
    this._bind();
  }
}

class TankwiseHistoryCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = TankwiseHistoryCard.getStubConfig();
    this._entries = [];
  }

  setConfig(config) {
    this._config = { ...TankwiseHistoryCard.getStubConfig(), ...(config || {}) };
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
    if (key === "refresh_seconds") value = Math.max(15, Number(value) || 60);
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
    const rangeOpts = RANGES.map((r) => {
      const labels = {
        "1h": this._t("range_1h"),
        "1d": this._t("range_1d"),
        "1w": this._t("range_1w"),
        "1m": this._t("range_1m"),
      };
      return `<option value="${r}" ${cfg.range === r ? "selected" : ""}>${this._esc(labels[r])}</option>`;
    }).join("");

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
          <input data-key="name" type="text" value="${this._esc(cfg.name || "")}" placeholder="${this._esc(this._t("history_title"))}"/>
        </label>
        <label>${this._esc(this._ct("default_range"))}
          <select data-key="range">${rangeOpts}</select>
        </label>
        <label class="row">
          <input data-key="show_range_tabs" type="checkbox" ${cfg.show_range_tabs !== false ? "checked" : ""}/>
          ${this._esc(this._ct("show_tabs"))}
        </label>
        <label>${this._esc(this._ct("refresh"))}
          <input data-key="refresh_seconds" type="number" min="15" step="5" value="${Number(cfg.refresh_seconds) || 60}"/>
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

  _esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

customElements.define(CARD_TYPE, TankwiseHistoryCard);
customElements.define("tankwise-history-card-editor", TankwiseHistoryCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TYPE,
  name: "Tankwise History",
  description: "Tank level and pump on/off charts from Tankwise",
  preview: true,
  documentationURL: "https://github.com/augleao/TankWise",
});
