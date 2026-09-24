import { t as i18nT, resolveLang } from "./i18n.js";

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
      notify: [],
    };
    this._busy = false;
    this._msg = "";
    this._err = "";
    this._section = "monitor"; // monitor | config | cycle | alerts | logs
    this._version = "";
    this._logs = [];
    this._entityModal = null; // { key, domains, title, hint, query, draft: string[] }
    this._historyModal = null; // { range, points, loading, message, available }
  }

  set hass(hass) {
    this._hass = hass;
    const lang = this._lang();
    if (!this._booted) {
      this._booted = true;
      this._lastLang = lang;
      this._boot();
    } else if (this._entityModal || this._historyModal) {
      // Keep modal interaction stable — page refresh was closing entity selects.
      this._lastLang = lang;
    } else if (this._selected || this._lastLang !== lang) {
      this._lastLang = lang;
      this._render();
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

  connectedCallback() {
    this._render();
  }

  async _boot() {
    await this._loadEntities();
    await this._refreshList();
    if (this._poll) clearInterval(this._poll);
    this._poll = setInterval(() => {
      if (!this._hass || this._busy) return;
      if (this._section === "monitor" || this._section === "logs") {
        this._refreshList();
        if (this._section === "logs") this._loadLogs().then(() => this._render());
      }
    }, 5000);
  }

  disconnectedCallback() {
    if (this._poll) {
      clearInterval(this._poll);
      this._poll = null;
    }
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
      notify: [],
    };
    Object.keys(states)
      .sort()
      .forEach((eid) => {
        const domain = eid.split(".")[0];
        if (buckets[domain] && domain !== "notify") {
          const name = states[eid].attributes.friendly_name || eid;
          buckets[domain].push({ id: eid, name: `${name} (${eid})` });
        }
      });
    const notifyMap = new Map();
    const notifyServices = (this._hass.services && this._hass.services.notify) || {};
    Object.keys(notifyServices)
      .sort()
      .forEach((name) => {
        const id = `notify.${name}`;
        notifyMap.set(id, { id, name: id });
      });
    Object.keys(states)
      .sort()
      .forEach((eid) => {
        if (!eid.startsWith("notify.")) return;
        const label = states[eid].attributes.friendly_name || eid;
        notifyMap.set(eid, { id: eid, name: `${label} (${eid})` });
      });
    buckets.notify = Array.from(notifyMap.values());
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
          if (!Array.isArray(this._config.notify_services)) {
            const legacy = this._config.notify_service;
            this._config.notify_services =
              typeof legacy === "string" && legacy.trim() ? [legacy.trim()] : [];
          }
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
        limit: 200,
      });
      this._logs = res.logs || [];
      if (res.status) this._status = res.status;
      this._err = "";
    } catch (e) {
      this._err = e.message || String(e);
    }
  }

  _formatLogTs(raw) {
    const text = String(raw || "");
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    return text.replace("T", " ").replace(/\.\d+/, "").replace("Z", "").replace(/\+00:00$/, "");
  }

  _formatLogValue(key, value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "ON" : "OFF";
    if (key === "percent" && Number.isFinite(Number(value))) {
      return `${Number(value).toFixed(0)}%`;
    }
    if (key === "distance" && Number.isFinite(Number(value))) {
      return Number(value).toFixed(3);
    }
    return String(value);
  }

  _logRowHtml(row) {
    const ts = this._formatLogTs(row.ts);
    const ev = row.event || "";
    const preferred = ["percent", "distance", "reason", "desired_on", "enabled", "target_on", "service"];
    const keys = [
      ...preferred.filter((k) => k in row),
      ...Object.keys(row).filter((k) => !["ts", "event", ...preferred].includes(k)),
    ];
    const extra = keys.length
      ? keys.map((k) => `${k}=${this._formatLogValue(k, row[k])}`).join(" · ")
      : "—";
    return `<div class="log-row"><div class="log-head"><span class="log-ts">${this._esc(ts)}</span><span class="log-ev">${this._esc(ev)}</span></div><div class="log-extra">${this._esc(extra)}</div></div>`;
  }

  async _loadConfig(entryId) {
    const res = await this._ws("tankwise/get_config", { entry_id: entryId });
    this._config = { ...res.config };
    if (!Array.isArray(this._config.notify_services)) {
      const legacy = this._config.notify_service;
      this._config.notify_services =
        typeof legacy === "string" && legacy.trim() ? [legacy.trim()] : [];
    }
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
    if (key === "reconcile_interval_minutes" && value != null) {
      this._config = {
        ...this._config,
        reconcile_interval: Math.max(1, Math.round(Number(value))) * 60,
      };
      return;
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
      for (const key of ["toggle_entities", "led_entities", "notify_services"]) {
        if (!Array.isArray(payload[key])) payload[key] = [];
      }
      delete payload.notify_service;
      const res = await this._ws("tankwise/update_config", {
        entry_id: this._selected,
        config: payload,
      });
      this._config = { ...res.config };
      this._status = res.status;
      this._msg = this._t("msg_saved");
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
        ? this._t("msg_automation_on")
        : this._t("msg_automation_off");
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
        ? this._t("msg_demand_on")
        : this._t("msg_demand_off");
    } catch (e) {
      this._err = e.message || String(e);
    }
    this._busy = false;
    this._render();
  }

  async _testNotify() {
    if (!this._selected) return;
    this._busy = true;
    this._msg = "";
    this._err = "";
    this._render();
    try {
      const res = await this._ws("tankwise/test_notify", {
        entry_id: this._selected,
      });
      this._msg = res.message || this._t("msg_test_sent");
    } catch (e) {
      this._err = e.message || String(e);
    }
    this._busy = false;
    this._render();
  }

  async _toggleReconcileEnabled() {
    if (!this._selected || !this._config) return;
    const current = this._config.reconcile_enabled !== false;
    this._busy = true;
    this._msg = "";
    this._err = "";
    this._render();
    try {
      const res = await this._ws("tankwise/update_config", {
        entry_id: this._selected,
        config: { reconcile_enabled: !current },
      });
      this._config = { ...res.config };
      this._status = res.status;
      this._msg = !current
        ? this._t("msg_reconcile_on")
        : this._t("msg_reconcile_off");
      await this._refreshList();
    } catch (e) {
      this._err = e.message || String(e);
    }
    this._busy = false;
    this._render();
  }

  _reconcileIntervalMinutes() {
    return Math.max(1, Math.round(this._num("reconcile_interval", 120) / 60));
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



  _entityItems(domains, selectedIds) {
    const list = this._mergeDomains(domains);
    const selectedSet = new Set(selectedIds || []);
    const items = list.map((item) => ({ ...item, selected: selectedSet.has(item.id) }));
    for (const sid of selectedSet) {
      if (sid && !list.some((x) => x.id === sid)) {
        items.unshift({ id: sid, name: `${sid} (atual)`, selected: true });
      }
    }
    return items;
  }

  _filterEntities(items, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
    );
  }

  _removeEntity(key, entityId) {
    if (!this._config || !entityId) return;
    if (key === "pump_entity" || key === "distance_entity") {
      this._config = { ...this._config, [key]: "" };
      return;
    }
    this._config = {
      ...this._config,
      [key]: this._list(key).filter((id) => id !== entityId),
    };
  }

  _openEntityModal(key, domains, title, hint, { mode = "multi" } = {}) {
    let draft = [];
    if (mode === "single") {
      const current = this._val(key, "");
      draft = current ? [String(current)] : [];
    } else {
      draft = [...this._list(key)];
    }
    this._entityModal = {
      key,
      domains,
      title,
      hint,
      query: "",
      mode,
      draft,
    };
    this._render();
  }

  _closeEntityModal() {
    this._entityModal = null;
    this._render();
  }

  _confirmEntityModal() {
    if (!this._config || !this._entityModal) return;
    const { key, draft, mode } = this._entityModal;
    if (mode === "single") {
      this._config = {
        ...this._config,
        [key]: draft && draft.length ? draft[0] : "",
      };
    } else {
      this._config = { ...this._config, [key]: [...draft] };
    }
    this._entityModal = null;
    this._render();
  }

  _toggleModalDraft(entityId, selected) {
    if (!this._entityModal || !entityId) return;
    if (this._entityModal.mode === "single") {
      this._entityModal = {
        ...this._entityModal,
        draft: selected ? [entityId] : [],
      };
      return;
    }
    const set = new Set(this._entityModal.draft || []);
    if (selected) set.add(entityId);
    else set.delete(entityId);
    this._entityModal = { ...this._entityModal, draft: Array.from(set) };
  }

  _formatEntityLive(entityId) {
    if (!entityId || !this._hass || !this._hass.states) {
      return this._t("live_unavailable");
    }
    const st = this._hass.states[entityId];
    if (!st || st.state === "unavailable" || st.state === "unknown") {
      return this._t("live_unavailable");
    }
    const raw = String(st.state);
    const lower = raw.toLowerCase();
    if (lower === "on" || lower === "open" || lower === "true") return this._t("live_on");
    if (lower === "off" || lower === "closed" || lower === "false") return this._t("live_off");
    const num = Number(raw);
    const unit = (st.attributes && st.attributes.unit_of_measurement) || "";
    if (Number.isFinite(num)) {
      const abs = Math.abs(num);
      const formatted =
        abs >= 100 ? num.toFixed(0) : abs >= 10 ? num.toFixed(2) : num.toFixed(3);
      return unit ? `${formatted} ${unit}` : formatted;
    }
    return unit ? `${raw} ${unit}` : raw;
  }

  _entitySingleSelected(key, domains, emptyText) {
    const id = String(this._val(key, "") || "");
    if (!id) {
      return `<div class="entity-selected"><div class="chips-empty">${this._esc(emptyText)}</div></div>`;
    }
    const byId = new Map(this._entityItems(domains, [id]).map((item) => [item.id, item]));
    const item = byId.get(id) || { id, name: id };
    const live = this._formatEntityLive(id);
    return `
      <div class="entity-selected">
        <div class="entity-row">
          <div class="entity-row-main">
            <span class="entity-row-name" title="${this._esc(item.id)}">${this._esc(item.name)}</span>
            <span class="entity-live" title="${this._esc(item.id)}">${this._esc(live)}</span>
          </div>
          <button type="button" class="entity-remove" data-entity-remove="${this._esc(key)}" data-entity-id="${this._esc(item.id)}" title="${this._t("remove")}">×</button>
        </div>
      </div>`;
  }

  _entitySelectedList(key, domains, emptyText) {
    const selected = this._list(key);
    const byId = new Map(
      this._entityItems(domains, selected).map((item) => [item.id, item])
    );
    const rows = selected.length
      ? selected
          .map((id) => {
            const item = byId.get(id) || { id, name: id };
            return `
              <div class="entity-row">
                <span class="entity-row-name" title="${this._esc(item.id)}">${this._esc(item.name)}</span>
                <button type="button" class="entity-remove" data-entity-remove="${this._esc(key)}" data-entity-id="${this._esc(item.id)}" title="${this._t("remove")}">×</button>
              </div>`;
          })
          .join("")
      : `<div class="chips-empty">${this._esc(emptyText)}</div>`;
    return `<div class="entity-selected">${rows}</div>`;
  }

  _entityModalHtml() {
    const modal = this._entityModal;
    if (!modal) return "";
    const single = modal.mode === "single";
    const draft = new Set(modal.draft || []);
    const base = this._entityItems(modal.domains, Array.from(draft)).map((item) => ({
      ...item,
      selected: draft.has(item.id),
    }));
    const items = this._filterEntities(base, modal.query);
    const inputType = single ? "radio" : "checkbox";
    const rows = items.length
      ? items
          .map(
            (item) => `
              <label class="entity-opt">
                <input type="${inputType}" name="tankwise-entity-pick" data-modal-toggle value="${this._esc(item.id)}" ${item.selected ? "checked" : ""}>
                <span>${this._esc(item.name)}</span>
              </label>`
          )
          .join("")
      : `<div class="entity-empty">${modal.domains && modal.domains[0] === "notify" ? this._t("none_found_notify") : this._t("none_found_entity")}</div>`;
    return `
      <div class="modal-backdrop" data-modal-backdrop>
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h3>${this._esc(modal.title)}</h3>
            <button type="button" class="modal-x" data-modal-cancel title="${this._t("close")}">×</button>
          </div>
          <p class="hint" style="margin:0 0 10px">${this._esc(modal.hint)}</p>
          <input type="search" class="modal-search" placeholder="${modal.domains && modal.domains[0] === "notify" ? this._t("search_notify") : this._t("search_entity")}" value="${this._esc(modal.query)}" autocomplete="off" data-modal-search>
          <div class="entity-list modal-list">${rows}</div>
          <div class="modal-actions">
            <button type="button" class="secondary" data-modal-cancel>${this._t("cancel")}</button>
            <button type="button" data-modal-confirm>${single ? this._t("select_entity") : this._t("add_selected")}</button>
          </div>
        </div>
      </div>
    `;
  }

  _thresholdMode() {
    return this._val("threshold_mode", "distance") === "percent" ? "percent" : "distance";
  }

  _distanceToPercent(distance) {
    const full = this._num("full_distance", 82);
    const empty = this._num("empty_distance", 120);
    if (empty <= full) return null;
    const pct = ((empty - Number(distance)) / (empty - full)) * 100;
    if (!Number.isFinite(pct)) return null;
    return Math.max(0, Math.min(100, pct));
  }

  _percentToDistance(percent) {
    const full = this._num("full_distance", 82);
    const empty = this._num("empty_distance", 120);
    if (empty <= full) return null;
    const pct = Math.max(0, Math.min(100, Number(percent)));
    if (!Number.isFinite(pct)) return null;
    return empty - (pct / 100) * (empty - full);
  }

  _setThresholdMode(mode) {
    if (!this._config) return;
    const cur = this._thresholdMode();
    if (mode === cur) return;
    let on = this._num("on_threshold", mode === "percent" ? 30 : 101);
    let off = this._num("off_threshold", mode === "percent" ? 95 : 84);
    if (mode === "percent" && cur === "distance") {
      const onP = this._distanceToPercent(on);
      const offP = this._distanceToPercent(off);
      on = onP == null ? 30 : Number(onP.toFixed(1));
      off = offP == null ? 95 : Number(offP.toFixed(1));
      // Ensure percent ordering on < off
      if (on >= off) {
        on = 30;
        off = 95;
      }
    } else if (mode === "distance" && cur === "percent") {
      const onD = this._percentToDistance(on);
      const offD = this._percentToDistance(off);
      on = onD == null ? 101 : Number(onD.toFixed(3));
      off = offD == null ? 84 : Number(offD.toFixed(3));
      // Ensure distance ordering on > off
      if (on <= off) {
        const full = this._num("full_distance", 82);
        const empty = this._num("empty_distance", 120);
        const span = Math.max(empty - full, 0.001);
        on = Number((full + span * 0.7).toFixed(3));
        off = Number((full + span * 0.05).toFixed(3));
      }
    }
    this._config = {
      ...this._config,
      threshold_mode: mode,
      on_threshold: on,
      off_threshold: off,
    };
    this._render();
  }

  _percent() {
    const st = this._status || {};
    if (st.percent !== null && st.percent !== undefined && Number.isFinite(Number(st.percent))) {
      return Math.max(0, Math.min(100, Number(st.percent)));
    }
    // Derive from distance + calibration when percent missing
    const dist = st.distance;
    const full = this._num("full_distance", 82);
    const empty = this._num("empty_distance", 120);
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
      <button type="button" class="tank-hit" data-open-history title="${this._t("tank_aria")}" aria-label="${this._t("tank_aria")}">
      <svg class="tank-svg" viewBox="0 0 120 140" width="140" height="164" aria-hidden="true">
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
        <text x="60" y="132" text-anchor="middle" font-size="11" fill="#5b6b63">${this._t("tank_label")}</text>
      </svg>
      <span class="tank-hint">${this._t("tank_hint")}</span>
      </button>`;
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

    if (!window) {
      return `
        <svg class="level-chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Sem dados">
          <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#f7faf8"/>
          <text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#5b6b63" font-size="14">${this._t("chart_no_data")}</text>
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
          <line x1="${pad.l}" y1="${y}" x2="${pad.l + iw}" y2="${y}" stroke="#d7e0db" stroke-width="1" ${
            pct === 0 || pct === 100 ? "" : 'stroke-dasharray="4 4"'
          }/>
          <text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#5b6b63">${pct}%</text>`;
      })
      .join("");

    // Step line for pump: ON near top of pump band, OFF near bottom.
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
      // Extend horizontal steps between changes.
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
      // Soft ON bands
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
        return `<text x="${x}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#5b6b63">${this._esc(
          this._formatHistoryTick(tickSources[i].ts, range)
        )}</text>`;
      })
      .join("");

    return `
      <svg class="level-chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${this._t("history_title")}">
        <defs>
          <linearGradient id="levelFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1b7f5a" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#1b7f5a" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#f7faf8"/>
        <text x="${pad.l}" y="${levelTop - 8}" font-size="12" font-weight="700" fill="#145c42">${this._t("level")}</text>
        <g class="chart-legend" transform="translate(${pad.l + 54}, ${levelTop - 18})">
          <line x1="0" y1="8" x2="18" y2="8" stroke="#1b7f5a" stroke-width="2.5"/>
          <text x="24" y="12" font-size="11" fill="#5b6b63">${this._t("chart_tank")}</text>
          <line x1="120" y1="8" x2="138" y2="8" stroke="#ef6c00" stroke-width="2.5"/>
          <text x="144" y="12" font-size="11" fill="#5b6b63">${this._t("chart_pump")}</text>
        </g>
        ${grid}
        ${
          levelPts.length
            ? `<path d="${levelArea}" fill="url(#levelFill)"/><path d="${levelPath}" fill="none" stroke="#1b7f5a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${levelDot}${levelLabel}`
            : `<text x="${pad.l + iw / 2}" y="${levelTop + levelH / 2}" text-anchor="middle" fill="#5b6b63" font-size="13">${this._t("chart_no_level")}</text>`
        }
        <text x="${pad.l}" y="${pumpTop - 8}" font-size="12" font-weight="700" fill="#ef6c00">${this._t("chart_pump_label")}</text>
        <rect x="${pad.l}" y="${pumpTop}" width="${iw}" height="${pumpH}" rx="8" fill="#fff" stroke="#d7e0db"/>
        <text x="${pad.l - 8}" y="${pumpTop + 18}" text-anchor="end" font-size="10" fill="#5b6b63">ON</text>
        <text x="${pad.l - 8}" y="${pumpTop + pumpH - 8}" text-anchor="end" font-size="10" fill="#5b6b63">OFF</text>
        ${pumpBands}
        ${
          pumpPts.length
            ? `<path d="${pumpPath}" fill="none" stroke="#ef6c00" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${pumpLabel}`
            : `<text x="${pad.l + iw / 2}" y="${pumpTop + pumpH / 2 + 4}" text-anchor="middle" fill="#5b6b63" font-size="13">${this._t("chart_no_pump")}</text>`
        }
        ${ticks}
      </svg>`;
  }

  async _openHistoryModal(range = "1d") {
    if (!this._selected) return;
    this._historyModal = {
      range,
      points: [],
      pump_points: [],
      loading: true,
      message: null,
      available: false,
    };
    this._render();
    await this._loadHistory(range);
  }

  async _loadHistory(range) {
    if (!this._selected || !this._historyModal) return;
    this._historyModal = {
      ...this._historyModal,
      range,
      loading: true,
      message: null,
    };
    this._render();
    try {
      const res = await this._ws("tankwise/level_history", {
        entry_id: this._selected,
        range,
      });
      if (!this._historyModal) return;
      this._historyModal = {
        range: res.range || range,
        points: res.points || [],
        pump_points: res.pump_points || [],
        loading: false,
        message: res.message || null,
        available: Boolean(res.available),
      };
    } catch (e) {
      if (!this._historyModal) return;
      this._historyModal = {
        ...this._historyModal,
        loading: false,
        points: [],
        pump_points: [],
        available: false,
        message: e.message || String(e),
      };
    }
    this._render();
  }

  _closeHistoryModal() {
    this._historyModal = null;
    this._render();
  }

  _historyModalHtml() {
    const modal = this._historyModal;
    if (!modal) return "";
    const ranges = [
      ["1h", this._t("range_1h")],
      ["1d", this._t("range_1d")],
      ["1w", this._t("range_1w")],
      ["1m", this._t("range_1m")],
    ];
    const body = modal.loading
      ? `<div class="hint" style="padding:28px 8px;text-align:center">${this._t("loading_history")}</div>`
      : `${
          modal.message
            ? `<div class="hint" style="margin-bottom:10px">${this._esc(modal.message)}</div>`
            : ""
        }${this._levelChartSvg(modal.points, modal.pump_points, modal.range)}`;
    return `
      <div class="modal-backdrop" data-history-backdrop>
        <div class="modal history-modal" role="dialog" aria-modal="true" aria-label="${this._t("history_title")}">
          <div class="modal-head">
            <h3>${this._t("history_title")}</h3>
            <button type="button" class="modal-x" data-history-close title="${this._t("close")}">×</button>
          </div>
          <div class="history-ranges">
            ${ranges
              .map(
                ([key, label]) =>
                  `<button type="button" class="tab ${modal.range === key ? "active" : ""}" data-history-range="${key}">${label}</button>`
              )
              .join("")}
          </div>
          <div class="history-body">${body}</div>
        </div>
      </div>`;
  }

  _pumpSvg(running) {
    const color = running ? "#1b7f5a" : "#9aa5a0";
    const spin = running
      ? `<animateTransform attributeName="transform" type="rotate" from="0 60 52" to="360 60 52" dur="1.2s" repeatCount="indefinite"/>`
      : "";
    return `
      <button type="button" class="tank-hit" data-open-history title="${this._t("tank_aria")}" aria-label="${this._t("tank_aria")}">
      <svg class="pump-svg" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
        <circle cx="60" cy="52" r="28" fill="#eef2f0" stroke="${color}" stroke-width="3"/>
        <g>
          <path d="M60 30 L66 52 L60 74 L54 52 Z" fill="${color}"/>
          <path d="M38 52 L60 46 L82 52 L60 58 Z" fill="${color}" opacity="0.7"/>
          ${spin}
        </g>
        <rect x="48" y="80" width="24" height="18" rx="3" fill="${color}"/>
        <text x="60" y="112" text-anchor="middle" font-size="11" fill="#5b6b63">${running ? this._t("pump_on") : this._t("pump_off")}</text>
      </svg>
      <span class="tank-hint">${this._t("tank_hint")}</span>
      </button>`;
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
        .hero-right { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .mode-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0 4px; }
        .ver { font-size: 0.95rem; font-weight: 600; color: var(--tw-muted); margin-left: 6px; }
        .log-box { max-height: 420px; overflow: auto; border: 1px solid var(--tw-border); border-radius: 12px; background: #f7faf8; }
        .log-row {
          display: flex; flex-direction: column; gap: 4px;
          padding: 10px 12px; border-bottom: 1px solid var(--tw-border); font-size: 0.82rem;
        }
        .log-row:last-child { border-bottom: none; }
        .log-head { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; }
        .log-ts { color: var(--tw-muted); font-family: ui-monospace, monospace; font-size: 0.78rem; }
        .log-ev { font-weight: 700; color: var(--tw-green-dark); }
        .log-extra { color: #31463c; word-break: break-word; line-height: 1.35; }
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
        .tank-hit {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          border: none; background: transparent; padding: 4px; cursor: pointer;
          border-radius: 14px;
        }
        .tank-hit:hover { background: rgba(27, 127, 90, 0.06); }
        .tank-hit:focus-visible { outline: 2px solid var(--tw-green); outline-offset: 2px; }
        .tank-hint {
          font-size: 0.72rem; color: var(--tw-muted); letter-spacing: 0.02em;
        }
        .history-modal { width: min(760px, 100%); max-height: min(90vh, 820px); }
        .history-ranges { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 8px; }
        .history-body { overflow: auto; }
        .level-chart { display: block; width: 100%; height: auto; }
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
        .label-with-tip {
          display: inline-flex; align-items: center; gap: 6px; margin-bottom: 4px;
        }
        .tip {
          position: relative; display: inline-flex; align-items: center; justify-content: center;
          width: 18px; height: 18px; border-radius: 50%;
          border: 1px solid var(--tw-border); background: #f7faf8; color: var(--tw-muted);
          font-size: 0.72rem; font-weight: 700; cursor: help; flex: 0 0 auto;
        }
        .tip-bubble {
          position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%);
          width: min(320px, 70vw); padding: 10px 12px; border-radius: 10px;
          background: #16382c; color: #fff; font-size: 0.78rem; font-weight: 500; line-height: 1.35;
          box-shadow: 0 8px 20px rgba(20, 60, 40, 0.22); z-index: 20;
          opacity: 0; visibility: hidden; pointer-events: none; transition: opacity .15s ease;
          text-align: left;
        }
        .tip-bubble::after {
          content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
          border: 6px solid transparent; border-top-color: #16382c;
        }
        .tip:hover .tip-bubble, .tip:focus .tip-bubble, .tip:focus-within .tip-bubble {
          opacity: 1; visibility: visible;
        }
        select, input[type=number], input[type=text] {
          width: 100%; box-sizing: border-box; padding: 10px 12px;
          border-radius: 10px; border: 1px solid var(--tw-border);
          background: #fbfcfb; color: #1c2b24; font-size: 0.95rem;
        }
        select[multiple] { min-height: 108px; }

        .entity-selected { display: flex; flex-direction: column; gap: 6px; margin: 6px 0 8px; }
        .entity-row {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 8px 10px; border: 1px solid var(--tw-border); border-radius: 10px; background: #fbfcfb;
        }
        .entity-row-main {
          min-width: 0; flex: 1; display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px;
        }
        .entity-row-name { font-size: 0.9rem; color: #1c2b24; overflow: hidden; text-overflow: ellipsis; }
        .entity-live {
          font-size: 0.95rem; font-weight: 700; color: var(--tw-green-dark);
          white-space: nowrap;
        }
        .entity-remove {
          flex: 0 0 auto; width: 28px; height: 28px; padding: 0; border-radius: 8px;
          background: #fff; color: #c62828; border: 1px solid #ef9a9a; font-size: 1.15rem; line-height: 1;
          font-weight: 700;
        }
        .entity-remove:hover { background: #fdecea; }
        .chips-empty { color: var(--tw-muted); font-size: 0.85rem; padding: 4px 0; }
        .add-btn { margin-top: 4px; }
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(20, 40, 30, 0.45);
          display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;
        }
        .modal {
          width: min(560px, 100%); max-height: min(80vh, 720px);
          background: #fff; border-radius: 16px; border: 1px solid var(--tw-border);
          box-shadow: 0 16px 40px rgba(20, 60, 40, 0.18); padding: 16px 18px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .modal-head h3 { margin: 0; color: var(--tw-green-dark); font-size: 1.1rem; }
        .modal-x {
          width: 32px; height: 32px; padding: 0; border-radius: 8px; background: #fff;
          color: var(--tw-muted); border: 1px solid var(--tw-border); font-size: 1.2rem;
        }
        .modal-search, input[type=search] {
          width: 100%; box-sizing: border-box; padding: 10px 12px;
          border-radius: 10px; border: 1px solid var(--tw-border);
          background: #fbfcfb; color: #1c2b24; font-size: 0.95rem;
        }
        .modal-list, .entity-list {
          max-height: 42vh; overflow: auto; border: 1px solid var(--tw-border);
          border-radius: 10px; background: #fbfcfb; padding: 6px;
        }
        .entity-opt {
          display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px;
          border-radius: 8px; font-weight: 500; color: #1c2b24; cursor: pointer;
        }
        .entity-opt:hover { background: #eef5f1; }
        .entity-opt input { width: auto; margin-top: 2px; }
        .entity-empty { padding: 12px; color: var(--tw-muted); font-size: 0.85rem; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
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
    root.querySelectorAll("[data-threshold-mode]").forEach((el) => {
      el.onclick = () => this._setThresholdMode(el.getAttribute("data-threshold-mode"));
    });
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
    btn("toggle_enabled", () => {
      const on = this._status?.enabled !== false;
      this._setEnabled(!on);
    });
    btn("toggle_demand", () => {
      const on = Boolean(this._status?.desired_on);
      this._setDemand(!on);
    });
    btn("toggle_reconcile", () => this._toggleReconcileEnabled());
    btn("save_reconcile", () => this._save());
    btn("test_notify", () => this._testNotify());

    root.querySelectorAll("[data-open-entity-modal]").forEach((el) => {
      el.onclick = () => {
        const key = el.getAttribute("data-open-entity-modal");
        if (key === "pump_entity") {
          this._openEntityModal(
            "pump_entity",
            ["switch", "light", "input_boolean"],
            this._t("modal_pump_title"),
            this._t("modal_pump_hint"),
            { mode: "single" }
          );
        } else if (key === "distance_entity") {
          this._openEntityModal(
            "distance_entity",
            ["sensor", "input_number", "number"],
            this._t("modal_distance_title"),
            this._t("modal_distance_hint"),
            { mode: "single" }
          );
        } else if (key === "toggle_entities") {
          this._openEntityModal(
            "toggle_entities",
            ["binary_sensor", "input_boolean", "switch"],
            this._t("modal_buttons_title"),
            this._t("modal_buttons_hint")
          );
        } else if (key === "led_entities") {
          this._openEntityModal(
            "led_entities",
            ["light", "switch", "input_boolean"],
            this._t("modal_leds_title"),
            this._t("modal_leds_hint")
          );
        } else if (key === "notify_services") {
          this._openEntityModal(
            "notify_services",
            ["notify"],
            this._t("modal_notify_title"),
            this._t("modal_notify_hint")
          );
        }
      };
    });

    const openHistory = root.querySelectorAll("[data-open-history]");
    openHistory.forEach((el) => {
      el.onclick = () => this._openHistoryModal(this._historyModal?.range || "1d");
    });
    root.querySelectorAll("[data-history-range]").forEach((el) => {
      el.onclick = () => this._loadHistory(el.getAttribute("data-history-range") || "1d");
    });
    root.querySelectorAll("[data-history-close]").forEach((el) => {
      el.onclick = () => this._closeHistoryModal();
    });
    const historyBackdrop = root.querySelector("[data-history-backdrop]");
    if (historyBackdrop) {
      historyBackdrop.onclick = (ev) => {
        if (ev.target === historyBackdrop) this._closeHistoryModal();
      };
    }
    root.querySelectorAll("[data-entity-remove]").forEach((el) => {
      el.onclick = () => {
        this._removeEntity(
          el.getAttribute("data-entity-remove"),
          el.getAttribute("data-entity-id")
        );
        this._render();
      };
    });
    const modalSearch = root.querySelector("[data-modal-search]");
    if (modalSearch) {
      modalSearch.oninput = (ev) => {
        if (!this._entityModal) return;
        this._entityModal = { ...this._entityModal, query: ev.target.value };
        const pos = ev.target.selectionStart;
        this._render();
        const again = this.shadowRoot.querySelector("[data-modal-search]");
        if (again) {
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (_) {}
        }
      };
    }
    root.querySelectorAll("[data-modal-toggle]").forEach((el) => {
      el.onchange = () => {
        if (this._entityModal && this._entityModal.mode === "single") {
          this._toggleModalDraft(el.value, true);
        } else {
          this._toggleModalDraft(el.value, el.checked);
        }
        this._render();
      };
    });
    root.querySelectorAll("[data-modal-cancel]").forEach((el) => {
      el.onclick = () => this._closeEntityModal();
    });
    const backdrop = root.querySelector("[data-modal-backdrop]");
    if (backdrop) {
      backdrop.onclick = (ev) => {
        if (ev.target === backdrop) this._closeEntityModal();
      };
    }
    const confirmBtn = root.querySelector("[data-modal-confirm]");
    if (confirmBtn) confirmBtn.onclick = () => this._confirmEntityModal();

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
              <p>${this._t("brand_sub")}</p>
            </div>
            <div class="hero-right">
              <span class="badge ${enabled ? "ok" : "off"}">${enabled ? this._t("automation_on") : this._t("automation_off")}</span>
              <button id="toggle_enabled" class="${enabled ? "danger" : ""}" ${this._busy || !this._selected ? "disabled" : ""}>
                ${enabled ? this._t("disable_automation") : this._t("enable_automation")}
              </button>
            </div>
          </div>

          ${this._err ? `<div class="err">${this._esc(this._err)}</div>` : ""}
          ${this._msg ? `<div class="msg">${this._esc(this._msg)}</div>` : ""}

          ${
            !this._entries.length
              ? `<div class="card empty">${this._t("no_install")}</div>`
              : `
          <div class="card">
            <div class="grid">
              <div>
                <label for="entry" class="label-with-tip">
                  ${this._t("installation")}
                  <span class="tip" tabindex="0" aria-label="${this._t("installation")}">
                    ?
                    <span class="tip-bubble" role="tooltip">${this._t("installation_tip")}</span>
                  </span>
                </label>
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
              <button class="tab ${sec === "monitor" ? "active" : ""}" data-tab="monitor" type="button">${this._t("tab_monitor")}</button>
              <button class="tab ${sec === "config" ? "active" : ""}" data-tab="config" type="button">${this._t("tab_config")}</button>
              <button class="tab ${sec === "cycle" ? "active" : ""}" data-tab="cycle" type="button">${this._t("tab_cycle")}</button>
              <button class="tab ${sec === "alerts" ? "active" : ""}" data-tab="alerts" type="button">${this._t("tab_alerts")}</button>
              <button class="tab ${sec === "logs" ? "active" : ""}" data-tab="logs" type="button">${this._t("tab_logs")}</button>
            </div>
          </div>

          ${
            sec === "monitor"
              ? `
          <div class="card">
            <h2>${this._t("live_status")}</h2>
            <div class="desc">${this._t("live_status_desc")}</div>
            <div class="visuals">
              <div class="visual">${this._tankSvg(pct)}</div>
              <div class="visual">${this._pumpSvg(pump)}</div>
              <div class="visual" style="align-items:stretch; width:100%">
                <div class="stats">
                  <div class="stat ${enabled ? "on" : "off"}"><div class="k">${this._t("controller")}</div><div class="v">${enabled ? "ON" : "OFF"}</div></div>
                  <div class="stat ${demand ? "on" : "off"}"><div class="k">${this._t("demand")}</div><div class="v">${demand ? "1 / ON" : "0 / OFF"}</div></div>
                  <div class="stat ${pump ? "on" : "off"}"><div class="k">${this._t("physical_pump")}</div><div class="v">${pump ? this._t("status_on") : this._t("status_off")}</div></div>
                  <div class="stat"><div class="k">${this._t("distance")}</div><div class="v">${dist}</div></div>
                  <div class="stat"><div class="k">${this._t("level")}</div><div class="v">${pct === null ? "—" : pct.toFixed(0) + "%"}</div></div>
                  <div class="stat"><div class="k">${this._t("phase")}</div><div class="v" style="font-size:1rem">${this._esc(st.cycle_phase || "idle")}</div></div>
                </div>
                ${
                  st.on_hold_elapsed != null && !demand
                    ? `<div class="hint" style="margin-top:10px">${this._t("hold_on", { elapsed: Number(st.on_hold_elapsed).toFixed(0), target: Number(st.on_hold_seconds || 120) })}</div>`
                    : ""
                }
                ${
                  st.off_hold_elapsed != null && demand
                    ? `<div class="hint" style="margin-top:10px">${this._t("hold_off", { elapsed: Number(st.off_hold_elapsed).toFixed(0), target: Number(st.off_hold_seconds || 120) })}</div>`
                    : ""
                }
              </div>
            </div>
          </div>

          <div class="card">
            <h2>${this._t("manual_title")}</h2>
            <div class="desc">${this._t("manual_desc")}</div>
            <div class="manual-box">
              <div>
                <div class="hint" style="margin-bottom:8px">${this._t("pump_section")}</div>
                <div class="actions" style="margin:0">
                  <button id="toggle_demand" class="${demand ? "danger" : ""}" ${this._busy ? "disabled" : ""}>
                    ${demand ? this._t("turn_pump_off") : this._t("turn_pump_on")}
                  </button>
                </div>
              </div>
              <div>
                <div class="hint" style="margin-bottom:8px">${this._t("maintenance")}</div>
                <div class="actions" style="margin:0">
                  <button id="refresh" class="secondary" ${this._busy ? "disabled" : ""}>${this._t("refresh")}</button>
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
            <h2>${this._t("entities_title")}</h2>
            <div class="desc">${this._t("entities_desc")}</div>
            <div class="grid">
              <div style="grid-column: 1 / -1">
                <label>${this._t("pump_control")}</label>
                ${this._entitySingleSelected(
                  "pump_entity",
                  ["switch", "light", "input_boolean"],
                  this._t("no_pump_entity")
                )}
                <button type="button" class="secondary add-btn" data-open-entity-modal="pump_entity">${
                  c.pump_entity ? this._t("change_pump") : this._t("choose_pump")
                }</button>
              </div>
              <div style="grid-column: 1 / -1">
                <label>${this._t("distance_sensor")}</label>
                ${this._entitySingleSelected(
                  "distance_entity",
                  ["sensor", "input_number", "number"],
                  this._t("no_distance_entity")
                )}
                <button type="button" class="secondary add-btn" data-open-entity-modal="distance_entity">${
                  c.distance_entity ? this._t("change_distance") : this._t("choose_distance")
                }</button>
                <div class="hint">${this._t("distance_hint")}</div>
              </div>
              <div style="grid-column: 1 / -1">
                <label>${this._t("physical_buttons")}</label>
                ${this._entitySelectedList(
                  "toggle_entities",
                  ["binary_sensor", "input_boolean", "switch"],
                  this._t("no_buttons")
                )}
                <button type="button" class="secondary add-btn" data-open-entity-modal="toggle_entities">${this._t("add_buttons")}</button>
                <div class="hint">${this._t("buttons_hint")}</div>
              </div>
              <div style="grid-column: 1 / -1">
                <label>${this._t("leds_title")}</label>
                ${this._entitySelectedList(
                  "led_entities",
                  ["light", "switch", "input_boolean"],
                  this._t("no_leds")
                )}
                <button type="button" class="secondary add-btn" data-open-entity-modal="led_entities">${this._t("add_leds")}</button>
                <div class="hint">${this._t("leds_hint")}</div>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>${this._t("calibration_title")}</h2>
            <div class="desc">${this._t("calibration_desc")}</div>
            <div class="grid">
              <div>
                <label>${this._t("full_distance")}</label>
                <input type="number" step="any" data-key="full_distance" value="${this._esc(this._val("full_distance", 82))}">
              </div>
              <div>
                <label>${this._t("empty_distance")}</label>
                <input type="number" step="any" data-key="empty_distance" value="${this._esc(this._val("empty_distance", 120))}">
              </div>
              <div style="grid-column: 1 / -1">
                <label>${this._t("threshold_unit")}</label>
                <div class="mode-row">
                  <button type="button" class="tab ${this._thresholdMode() === "distance" ? "active" : ""}" data-threshold-mode="distance">${this._t("unit_distance")}</button>
                  <button type="button" class="tab ${this._thresholdMode() === "percent" ? "active" : ""}" data-threshold-mode="percent">${this._t("unit_percent")}</button>
                </div>
                <div class="hint">${this._t("threshold_unit_hint")}</div>
              </div>
              ${
                this._thresholdMode() === "percent"
                  ? `
              <div>
                <label>${this._t("on_below_percent")}</label>
                <input type="number" step="0.1" min="0" max="100" data-key="on_threshold" value="${this._esc(this._val("on_threshold", 30))}">
                <div class="hint">${this._t("on_below_percent_hint")}</div>
              </div>
              <div>
                <label>${this._t("off_above_percent")}</label>
                <input type="number" step="0.1" min="0" max="100" data-key="off_threshold" value="${this._esc(this._val("off_threshold", 95))}">
                <div class="hint">${this._t("off_above_percent_hint")}</div>
              </div>`
                  : `
              <div>
                <label>${this._t("on_threshold_distance")}</label>
                <input type="number" step="any" data-key="on_threshold" value="${this._esc(this._val("on_threshold", 101))}">
                <div class="hint">${this._t("on_threshold_distance_hint")}</div>
              </div>
              <div>
                <label>${this._t("off_threshold_distance")}</label>
                <input type="number" step="any" data-key="off_threshold" value="${this._esc(this._val("off_threshold", 84))}">
                <div class="hint">${this._t("off_threshold_distance_hint")}</div>
              </div>`
              }
              <div>
                <label>${this._t("hold_on_s")}</label>
                <input type="number" step="1" min="0" data-key="on_hold_seconds" value="${this._esc(this._val("on_hold_seconds", 120))}">
              </div>
              <div>
                <label>${this._t("hold_off_s")}</label>
                <input type="number" step="1" min="0" data-key="off_hold_seconds" value="${this._esc(this._val("off_hold_seconds", 120))}">
              </div>
              <div>
                <label>${this._t("min_auto_switch_s")}</label>
                <input type="number" step="1" min="0" data-key="min_auto_switch_seconds" value="${this._esc(this._val("min_auto_switch_seconds", 300))}">
                <div class="hint">${this._t("min_auto_switch_hint")}</div>
              </div>
            </div>
            <div class="check">
              <input type="checkbox" data-key="expose_percentage" ${this._bool("expose_percentage", true) ? "checked" : ""}>
              ${this._t("expose_percent")}
            </div>
            <div class="actions">
              <button id="save" ${this._busy ? "disabled" : ""}>${this._t("save_config")}</button>
            </div>
          </div>

          <div class="card">
            <h2>${this._t("reconcile_title")}</h2>
            <div class="desc">${this._t("reconcile_desc")}</div>
            <div class="grid">
              <div>
                <label>${this._t("reconcile_interval")}</label>
                <input type="number" step="1" min="1" data-key="reconcile_interval_minutes" value="${this._esc(this._reconcileIntervalMinutes())}">
                <div class="hint">${this._t("reconcile_interval_hint")}</div>
              </div>
            </div>
            <div class="actions">
              <button id="toggle_reconcile" class="${this._bool("reconcile_enabled", true) ? "danger" : ""}" ${this._busy ? "disabled" : ""}>
                ${this._bool("reconcile_enabled", true) ? this._t("disable_reconcile") : this._t("enable_reconcile")}
              </button>
              <button id="save_reconcile" class="secondary" ${this._busy ? "disabled" : ""}>${this._t("save_interval")}</button>
            </div>
          </div>
          `
              : ""
          }

          ${
            sec === "cycle"
              ? `
          <div class="card">
            <h2>${this._t("cycle_title")}</h2>
            <div class="desc">${this._t("cycle_desc")}</div>
            <div class="check">
              <input type="checkbox" id="timed_mode" ${timed ? "checked" : ""}>
              ${this._t("use_timing")}
            </div>
            <div class="grid">
              <div>
                <label>${this._t("work_period")}</label>
                <input type="number" step="0.5" min="0" data-key="work_minutes" value="${this._esc(this._val("work_minutes", timed ? 30 : 0))}" ${timed ? "" : "disabled"}>
              </div>
              <div>
                <label>${this._t("rest_period")}</label>
                <input type="number" step="0.5" min="0" data-key="rest_minutes" value="${this._esc(this._val("rest_minutes", timed ? 30 : 0))}" ${timed ? "" : "disabled"}>
              </div>
              <div>
                <label>${this._t("failsafe_margin")}</label>
                <input type="number" step="0.5" min="0" data-key="failsafe_margin_minutes" value="${this._esc(this._val("failsafe_margin_minutes", 5))}">
              </div>
            </div>
            <div class="actions">
              <button id="save" ${this._busy ? "disabled" : ""}>${this._t("save_timing")}</button>
            </div>
          </div>
          `
              : ""
          }

          ${
            sec === "alerts"
              ? `
          <div class="card">
            <h2>${this._t("alerts_title")}</h2>
            <div class="desc">${this._t("alerts_desc")}</div>
            <div class="grid">
              <div style="grid-column: 1 / -1">
                <label>${this._t("notify_services")}</label>
                ${this._entitySelectedList(
                  "notify_services",
                  ["notify"],
                  this._t("no_notify")
                )}
                <button type="button" class="secondary add-btn" data-open-entity-modal="notify_services">${this._t("add_notify")}</button>
                <div class="hint">${this._t("notify_hint")}</div>
              </div>
              <div>
                <label>${this._t("low_level")}</label>
                <input type="number" step="1" min="0" max="100" data-key="low_level_percent" value="${this._esc(this._val("low_level_percent", 60))}">
              </div>
              <div>
                <label>${this._t("critical_level")}</label>
                <input type="number" step="1" min="0" max="100" data-key="critical_level_percent" value="${this._esc(this._val("critical_level_percent", 25))}">
              </div>
              <div>
                <label>${this._t("notify_hold")}</label>
                <input type="number" step="1" min="0" data-key="level_notify_hold_seconds" value="${this._esc(this._val("level_notify_hold_seconds", 120))}">
              </div>
            </div>
            <div class="actions">
              <button id="save" ${this._busy ? "disabled" : ""}>${this._t("save_alerts")}</button>
              <button id="test_notify" class="secondary" ${this._busy ? "disabled" : ""}>${this._t("test_alerts")}</button>
            </div>
          </div>
          `
              : ""
          }

          ${
            sec === "logs"
              ? `
          <div class="card">
            <h2>${this._t("logs_title")}</h2>
            <div class="desc">${this._t("logs_desc")}</div>
            <div class="actions" style="margin-top:0;margin-bottom:12px">
              <button id="refresh_logs" class="secondary" ${this._busy ? "disabled" : ""}>${this._t("refresh_logs")}</button>
            </div>
            <div class="log-box">
              ${
                (this._logs || []).length
                  ? this._logs.map((row) => this._logRowHtml(row)).join("")
                  : `<div class="hint" style="padding:14px">${this._t("no_events")}</div>`
              }
            </div>
          </div>
          `
              : ""
          }
          `
          }
          ${this._entityModalHtml()}
          ${this._historyModalHtml()}
        </div>
      </div>
    `;
    this._bind();
  }
}

customElements.define("tankwise-panel", TankwisePanel);
