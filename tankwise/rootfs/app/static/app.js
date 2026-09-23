(() => {
  const I18n = globalThis.TankwiseI18n;
  const state = {
    entries: [],
    selected: null,
    config: null,
    status: null,
    entities: {},
    busy: false,
    tab: "monitor",
    pollTimer: null,
    entityModal: null,
    historyModal: null, // { range, points, loading, message }
    lang: "en",
  };

  const $ = (id) => document.getElementById(id);

  function t(key, vars) {
    return I18n.t(state.lang, key, vars);
  }

  function applyLanguage() {
    document.documentElement.lang = state.lang === "pt" ? "pt-BR" : "en";
    I18n.applyDom(state.lang);
  }

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


  function thresholdMode() {
    return (state.config && state.config.threshold_mode) === "percent" ? "percent" : "distance";
  }

  function distanceToPercent(distance) {
    const full = Number(state.config?.full_distance ?? 0.25);
    const empty = Number(state.config?.empty_distance ?? 0.47);
    if (!(empty > full)) return null;
    const pct = ((empty - Number(distance)) / (empty - full)) * 100;
    return Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : null;
  }

  function percentToDistance(percent) {
    const full = Number(state.config?.full_distance ?? 0.25);
    const empty = Number(state.config?.empty_distance ?? 0.47);
    if (!(empty > full)) return null;
    const pct = Math.max(0, Math.min(100, Number(percent)));
    return Number.isFinite(pct) ? empty - (pct / 100) * (empty - full) : null;
  }

  function updateThresholdLabels() {
    const mode = thresholdMode();
    const onL = $("label_on_threshold");
    const offL = $("label_off_threshold");
    if (onL) {
      onL.textContent =
        mode === "percent" ? t("on_below_short") : t("on_threshold_distance");
    }
    if (offL) {
      offL.textContent =
        mode === "percent" ? t("off_above_short") : t("off_threshold_distance");
    }
    const on = $("on_threshold");
    const off = $("off_threshold");
    if (on) {
      on.step = mode === "percent" ? "0.1" : "any";
      if (mode === "percent") { on.min = "0"; on.max = "100"; } else { on.removeAttribute("min"); on.removeAttribute("max"); }
    }
    if (off) {
      off.step = mode === "percent" ? "0.1" : "any";
      if (mode === "percent") { off.min = "0"; off.max = "100"; } else { off.removeAttribute("min"); off.removeAttribute("max"); }
    }
  }

  function setThresholdMode(mode) {
    if (!state.config) return;
    const cur = thresholdMode();
    if (mode === cur) return;
    let on = Number(state.config.on_threshold);
    let off = Number(state.config.off_threshold);
    if (mode === "percent" && cur === "distance") {
      on = distanceToPercent(on) ?? 30;
      off = distanceToPercent(off) ?? 95;
      if (on >= off) { on = 30; off = 95; }
      on = Number(on.toFixed(1));
      off = Number(off.toFixed(1));
    } else if (mode === "distance" && cur === "percent") {
      on = percentToDistance(on) ?? 0.4;
      off = percentToDistance(off) ?? 0.28;
      if (on <= off) {
        const full = Number(state.config.full_distance ?? 0.25);
        const empty = Number(state.config.empty_distance ?? 0.47);
        const span = Math.max(empty - full, 0.001);
        on = Number((full + span * 0.7).toFixed(3));
        off = Number((full + span * 0.05).toFixed(3));
      } else {
        on = Number(on.toFixed(3));
        off = Number(off.toFixed(3));
      }
    }
    state.config.threshold_mode = mode;
    state.config.on_threshold = on;
    state.config.off_threshold = off;
    const modeEl = $("threshold_mode");
    if (modeEl) modeEl.value = mode;
    if ($("on_threshold")) $("on_threshold").value = on;
    if ($("off_threshold")) $("off_threshold").value = off;
    updateThresholdLabels();
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
        (data && (data.message || data.error)) || t("http_error", { status: res.status });
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
      <button type="button" class="tank-hit" id="btn-open-history" title="${t("tank_aria")}" aria-label="${t("tank_aria")}">
      <svg viewBox="0 0 120 140" width="140" height="164" aria-hidden="true">
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
        <text x="60" y="132" text-anchor="middle" font-size="11" fill="#5b6b63">${t("tank_label")}</text>
      </svg>
      <span class="tank-hint">${t("tank_hint")}</span>
      </button>`;
  }

  function formatHistoryTick(ts, range) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    if (range === "1h" || range === "1d") {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  }

  function historyTimeWindow(levelPoints, pumpPoints) {
    const times = []
      .concat(levelPoints || [], pumpPoints || [])
      .map((p) => Date.parse(p.ts))
      .filter((t) => Number.isFinite(t));
    if (!times.length) return null;
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    return { t0, t1: t1 === t0 ? t0 + 1 : t1 };
  }

  function levelChartSvg(points, pumpPoints, range) {
    const W = 680;
    const H = 380;
    const pad = { t: 28, r: 18, b: 36, l: 52 };
    const gap = 18;
    const levelH = 220;
    const pumpH = 70;
    const iw = W - pad.l - pad.r;
    const levelTop = pad.t;
    const pumpTop = pad.t + levelH + gap;
    const window = historyTimeWindow(points, pumpPoints);

    if (!window) {
      return `
        <svg class="level-chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${t("chart_no_data")}">
          <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#f7faf8"/>
          <text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#5b6b63" font-size="14">${t("chart_no_data")}</text>
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

    let pumpPath = "";
    let pumpBands = "";
    let pumpLabel = "";
    if (pumpPts.length) {
      const yOn = pumpTop + 14;
      const yOff = pumpTop + pumpH - 14;
      const segments = pumpPts.map((p) => [xAt(p.ts), p.on ? yOn : yOff, Boolean(p.on)]);
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
        return `<text x="${x}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#5b6b63">${formatHistoryTick(
          tickSources[i].ts,
          range
        )}</text>`;
      })
      .join("");

    return `
      <svg class="level-chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${t("history_title")}">
        <defs>
          <linearGradient id="levelFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1b7f5a" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#1b7f5a" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#f7faf8"/>
        <text x="${pad.l}" y="${levelTop - 8}" font-size="12" font-weight="700" fill="#145c42">${t("level")}</text>
        <g transform="translate(${pad.l + 54}, ${levelTop - 18})">
          <line x1="0" y1="8" x2="18" y2="8" stroke="#1b7f5a" stroke-width="2.5"/>
          <text x="24" y="12" font-size="11" fill="#5b6b63">${t("chart_tank")}</text>
          <line x1="120" y1="8" x2="138" y2="8" stroke="#ef6c00" stroke-width="2.5"/>
          <text x="144" y="12" font-size="11" fill="#5b6b63">${t("chart_pump")}</text>
        </g>
        ${grid}
        ${
          levelPts.length
            ? `<path d="${levelArea}" fill="url(#levelFill)"/><path d="${levelPath}" fill="none" stroke="#1b7f5a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${levelDot}${levelLabel}`
            : `<text x="${pad.l + iw / 2}" y="${levelTop + levelH / 2}" text-anchor="middle" fill="#5b6b63" font-size="13">${t("chart_no_level")}</text>`
        }
        <text x="${pad.l}" y="${pumpTop - 8}" font-size="12" font-weight="700" fill="#ef6c00">${t("chart_pump_label")}</text>
        <rect x="${pad.l}" y="${pumpTop}" width="${iw}" height="${pumpH}" rx="8" fill="#fff" stroke="#d7e0db"/>
        <text x="${pad.l - 8}" y="${pumpTop + 18}" text-anchor="end" font-size="10" fill="#5b6b63">ON</text>
        <text x="${pad.l - 8}" y="${pumpTop + pumpH - 8}" text-anchor="end" font-size="10" fill="#5b6b63">OFF</text>
        ${pumpBands}
        ${
          pumpPts.length
            ? `<path d="${pumpPath}" fill="none" stroke="#ef6c00" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${pumpLabel}`
            : `<text x="${pad.l + iw / 2}" y="${pumpTop + pumpH / 2 + 4}" text-anchor="middle" fill="#5b6b63" font-size="13">${t("chart_no_pump")}</text>`
        }
        ${ticks}
      </svg>`;
  }

  function renderHistoryModal() {
    const modal = $("history-modal");
    const body = $("history-body");
    if (!modal || !body) return;
    const hm = state.historyModal;
    if (!hm) {
      modal.classList.add("hidden");
      return;
    }
    modal.classList.remove("hidden");
    document.querySelectorAll("[data-history-range]").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-history-range") === hm.range);
    });
    if (hm.loading) {
      body.innerHTML = `<div class="hint" style="padding:28px 8px;text-align:center">${t("loading_history")}</div>`;
      return;
    }
    body.innerHTML = `${
      hm.message ? `<div class="hint" style="margin-bottom:10px">${hm.message}</div>` : ""
    }${levelChartSvg(hm.points || [], hm.pump_points || [], hm.range)}`;
  }

  async function openHistoryModal(range = "1d") {
    if (!state.selected) return;
    state.historyModal = {
      range,
      points: [],
      pump_points: [],
      loading: true,
      message: null,
    };
    renderHistoryModal();
    await loadHistory(range);
  }

  async function loadHistory(range) {
    if (!state.selected || !state.historyModal) return;
    state.historyModal = { ...state.historyModal, range, loading: true, message: null };
    renderHistoryModal();
    try {
      const res = await api(`/entries/${state.selected}/level_history?range=${encodeURIComponent(range)}`);
      if (!state.historyModal) return;
      state.historyModal = {
        range: res.range || range,
        points: res.points || [],
        pump_points: res.pump_points || [],
        loading: false,
        message: res.message || null,
      };
    } catch (err) {
      if (!state.historyModal) return;
      state.historyModal = {
        ...state.historyModal,
        loading: false,
        points: [],
        pump_points: [],
        message: err.message || String(err),
      };
    }
    renderHistoryModal();
  }

  function closeHistoryModal() {
    state.historyModal = null;
    renderHistoryModal();
  }

  function pumpSvg(running) {
    const color = running ? "#1b7f5a" : "#9aa5a0";
    const spin = running
      ? `<animateTransform attributeName="transform" type="rotate" from="0 60 52" to="360 60 52" dur="1.2s" repeatCount="indefinite"/>`
      : "";
    return `
      <button type="button" class="tank-hit" id="btn-open-history-pump" title="${t("tank_aria")}" aria-label="${t("tank_aria")}">
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
        <circle cx="60" cy="52" r="28" fill="#eef2f0" stroke="${color}" stroke-width="3"/>
        <g>
          <path d="M60 30 L66 52 L60 74 L54 52 Z" fill="${color}"/>
          <path d="M38 52 L60 46 L82 52 L60 58 Z" fill="${color}" opacity="0.7"/>
          ${spin}
        </g>
        <rect x="48" y="80" width="24" height="18" rx="3" fill="${color}"/>
        <text x="60" y="112" text-anchor="middle" font-size="11" fill="#5b6b63">${running ? t("pump_on") : t("pump_off")}</text>
      </svg>
      <span class="tank-hint">${t("tank_hint")}</span>
      </button>`;
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
    const openHistory = $("btn-open-history");
    if (openHistory) {
      openHistory.onclick = () => openHistoryModal(state.historyModal?.range || "1d");
    }
    const openHistoryPump = $("btn-open-history-pump");
    if (openHistoryPump) {
      openHistoryPump.onclick = () => openHistoryModal(state.historyModal?.range || "1d");
    }

    const rows = [
      [t("status_automation"), st.enabled ? t("status_on") : t("status_off"), st.enabled ? "on" : "off"],
      [t("demand"), st.desired_on ? "ON" : "OFF", st.desired_on ? "on" : "off"],
      [t("physical_pump_short"), st.pump_on == null ? "—" : st.pump_on ? "ON" : "OFF", st.pump_on ? "on" : "off"],
      [t("distance"), fmt(st.distance), ""],
      [t("level"), pct == null ? "—" : `${pct.toFixed(0)}%`, ""],
      [t("phase"), fmt(st.cycle_phase), ""],
      [t("status_allowed"), st.pump_allowed ? t("status_yes") : t("status_no"), ""],
      [t("status_reason"), fmt(st.reason), ""],
    ];
    $("stats").innerHTML = rows
      .map(
        ([k, v, cls]) =>
          `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`
      )
      .join("");

    const badge = $("badge");
    const toggleEnabled = $("btn-toggle-enabled");
    if (!st.enabled) {
      badge.className = "badge off";
      badge.textContent = t("automation_badge_off");
      if (toggleEnabled) {
        toggleEnabled.textContent = t("enable_automation");
        toggleEnabled.className = "";
      }
    } else if (st.desired_on) {
      badge.className = "badge ok";
      badge.textContent = t("demand_badge_on");
      if (toggleEnabled) {
        toggleEnabled.textContent = t("disable_automation");
        toggleEnabled.className = "danger";
      }
    } else {
      badge.className = "badge";
      badge.textContent = t("demand_badge_off");
      if (toggleEnabled) {
        toggleEnabled.textContent = t("disable_automation");
        toggleEnabled.className = "danger";
      }
    }
    if (toggleEnabled) {
      toggleEnabled.disabled = Boolean(state.busy) || !state.selected;
    }
    const toggleDemand = $("btn-toggle-demand");
    if (toggleDemand) {
      if (st.desired_on) {
        toggleDemand.textContent = t("turn_pump_off");
        toggleDemand.className = "danger";
      } else {
        toggleDemand.textContent = t("turn_pump_on");
        toggleDemand.className = "";
      }
      toggleDemand.disabled = Boolean(state.busy) || !state.selected;
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
    if (!multiple) opts.push(`<option value="">${t("select_option")}</option>`);
    for (const item of list) {
      const sel = selectedSet.has(item.id) ? " selected" : "";
      opts.push(`<option value="${item.id}"${sel}>${item.name}</option>`);
    }
    for (const sid of selectedSet) {
      if (sid && !list.some((x) => x.id === sid)) {
        opts.push(`<option value="${sid}" selected>${sid} ${t("current_entity")}</option>`);
      }
    }
    el.innerHTML = opts.join("");
  }


  function entityItems(domains, selectedIds) {
    const list = mergeDomains(domains);
    const selectedSet = new Set(selectedIds || []);
    const items = list.map((item) => ({ ...item, selected: selectedSet.has(item.id) }));
    for (const sid of selectedSet) {
      if (sid && !list.some((x) => x.id === sid)) {
        items.unshift({ id: sid, name: `${sid} ${t("current_entity")}`, selected: true });
      }
    }
    return items;
  }

  function formatEntityLive(entityId) {
    if (!entityId) return t("live_unavailable");
    let found = null;
    for (const domain of Object.keys(state.entities || {})) {
      const hit = (state.entities[domain] || []).find((x) => x.id === entityId);
      if (hit) {
        found = hit;
        break;
      }
    }
    if (
      !found ||
      found.state === "unavailable" ||
      found.state === "unknown" ||
      found.state == null ||
      found.state === ""
    ) {
      if (entityId === state.config?.distance_entity && state.status?.distance != null) {
        const n = Number(state.status.distance);
        return Number.isFinite(n) ? n.toFixed(3) : String(state.status.distance);
      }
      if (entityId === state.config?.pump_entity && state.status?.pump_on != null) {
        return state.status.pump_on ? t("live_on") : t("live_off");
      }
      return t("live_unavailable");
    }
    const raw = String(found.state);
    const lower = raw.toLowerCase();
    if (lower === "on" || lower === "open" || lower === "true") return t("live_on");
    if (lower === "off" || lower === "closed" || lower === "false") return t("live_off");
    const num = Number(raw);
    const unit = found.unit || "";
    if (Number.isFinite(num)) {
      const abs = Math.abs(num);
      const formatted =
        abs >= 100 ? num.toFixed(0) : abs >= 10 ? num.toFixed(2) : num.toFixed(3);
      return unit ? `${formatted} ${unit}` : formatted;
    }
    return unit ? `${raw} ${unit}` : raw;
  }

  function selectedSingle(key, domains, emptyText, btnId, chooseKey, changeKey) {
    const el = $(`${key}_list`);
    const btn = $(btnId);
    if (!el || !state.config) return;
    const id = state.config[key] || "";
    if (!id) {
      el.innerHTML = `<div class="chips-empty">${emptyText}</div>`;
    } else {
      const byId = new Map(entityItems(domains, [id]).map((i) => [i.id, i]));
      const item = byId.get(id) || { id, name: id };
      const live = formatEntityLive(id);
      el.innerHTML = `<div class="entity-row"><div class="entity-row-main"><span class="entity-row-name" title="${item.id}">${item.name}</span><span class="entity-live">${live}</span></div><button type="button" class="entity-remove" data-key="${key}" data-id="${id}" title="${t("remove")}">×</button></div>`;
      el.querySelectorAll(".entity-remove").forEach((b) => {
        b.addEventListener("click", () => {
          state.config[key] = "";
          selectedSingle(key, domains, emptyText, btnId, chooseKey, changeKey);
        });
      });
    }
    if (btn) btn.textContent = id ? t(changeKey) : t(chooseKey);
  }

  function selectedList(key, domains, emptyText) {
    const el = $(`${key}_list`);
    if (!el || !state.config) return;
    const selected = Array.isArray(state.config[key]) ? state.config[key] : [];
    const byId = new Map(entityItems(domains, selected).map((i) => [i.id, i]));
    el.innerHTML = selected.length
      ? selected
          .map((id) => {
            const item = byId.get(id) || { id, name: id };
            return `<div class="entity-row"><span class="entity-row-name" title="${item.id}">${item.name}</span><button type="button" class="entity-remove" data-key="${key}" data-id="${id}" title="${t("remove")}">×</button></div>`;
          })
          .join("")
      : `<div class="chips-empty">${emptyText}</div>`;
    el.querySelectorAll(".entity-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-key");
        const id = btn.getAttribute("data-id");
        state.config[k] = (state.config[k] || []).filter((x) => x !== id);
        selectedList(k, domains, emptyText);
      });
    });
  }

  function renderModalList() {
    const modal = state.entityModal;
    if (!modal) return;
    const single = modal.mode === "single";
    const draft = new Set(modal.draft || []);
    const q = String(modal.query || "").trim().toLowerCase();
    const items = entityItems(modal.domains, Array.from(draft))
      .map((item) => ({ ...item, selected: draft.has(item.id) }))
      .filter(
        (item) =>
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      );
    const list = $("entity-modal-list");
    const inputType = single ? "radio" : "checkbox";
    list.innerHTML = items.length
      ? items
          .map(
            (item) =>
              `<label class="entity-opt"><input type="${inputType}" name="tankwise-entity-pick" value="${item.id}" ${item.selected ? "checked" : ""}><span>${item.name}</span></label>`
          )
          .join("")
      : `<div class="entity-empty">${modal.domains && modal.domains[0] === "notify" ? t("none_found_notify") : t("none_found_entity")}</div>`;
    list.querySelectorAll("input").forEach((box) => {
      box.addEventListener("change", () => {
        if (single) {
          state.entityModal.draft = box.checked ? [box.value] : [];
          renderModalList();
          return;
        }
        const set = new Set(state.entityModal.draft || []);
        if (box.checked) set.add(box.value);
        else set.delete(box.value);
        state.entityModal.draft = Array.from(set);
      });
    });
    const confirm = $("entity-modal-confirm");
    if (confirm) confirm.textContent = single ? t("select_entity") : t("add_selected");
  }

  function openEntityModal(key, domains, title, hint, { mode = "multi" } = {}) {
    let draft = [];
    if (mode === "single") {
      const cur = state.config?.[key];
      draft = cur ? [String(cur)] : [];
    } else {
      draft = [...(state.config?.[key] || [])];
    }
    state.entityModal = {
      key,
      domains,
      title,
      hint,
      query: "",
      mode,
      draft,
    };
    $("entity-modal-title").textContent = title;
    $("entity-modal-hint").textContent = hint;
    $("entity-modal-search").value = "";
    $("entity-modal-search").setAttribute(
      "placeholder",
      domains && domains[0] === "notify" ? t("search_notify") : t("search_entity")
    );
    $("entity-modal").classList.remove("hidden");
    renderModalList();
    $("entity-modal-search").focus();
  }

  function closeEntityModal() {
    state.entityModal = null;
    $("entity-modal").classList.add("hidden");
  }

  function confirmEntityModal() {
    if (!state.entityModal || !state.config) return;
    const { key, draft, domains, mode } = state.entityModal;
    if (mode === "single") {
      state.config[key] = draft && draft.length ? draft[0] : "";
    } else {
      state.config[key] = [...draft];
    }
    closeEntityModal();
    if (key === "pump_entity") {
      selectedSingle(
        "pump_entity",
        ["switch", "input_boolean", "light"],
        t("no_pump_entity"),
        "btn-choose-pump",
        "choose_pump",
        "change_pump"
      );
    } else if (key === "distance_entity") {
      selectedSingle(
        "distance_entity",
        ["sensor", "input_number", "number"],
        t("no_distance_entity"),
        "btn-choose-distance",
        "choose_distance",
        "change_distance"
      );
    } else if (key === "toggle_entities") {
      selectedList("toggle_entities", domains, t("no_buttons"));
    } else if (key === "led_entities") {
      selectedList("led_entities", domains, t("no_leds"));
    } else if (key === "notify_services") {
      selectedList("notify_services", domains, t("no_notify"));
    }
  }

  function bindConfigFields() {
    if (!state.config) return;
    const c = state.config;
    selectedSingle(
      "pump_entity",
      ["switch", "input_boolean", "light"],
      t("no_pump_entity"),
      "btn-choose-pump",
      "choose_pump",
      "change_pump"
    );
    selectedSingle(
      "distance_entity",
      ["sensor", "input_number", "number"],
      t("no_distance_entity"),
      "btn-choose-distance",
      "choose_distance",
      "change_distance"
    );
    selectedList("toggle_entities", ["binary_sensor", "input_boolean", "switch"], t("no_buttons"));
    selectedList("led_entities", ["light", "switch", "input_boolean"], t("no_leds"));
    selectedList("notify_services", ["notify"], t("no_notify"));

    const scalars = [
      "full_distance",
      "empty_distance",
      "on_threshold",
      "off_threshold",
      "on_hold_seconds",
      "off_hold_seconds",
      "reconcile_retries",
      "work_minutes",
      "rest_minutes",
      "failsafe_margin_minutes",
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
    const minutesEl = $("reconcile_interval_minutes");
    if (minutesEl) {
      const seconds = Number(c.reconcile_interval ?? 120);
      minutesEl.value = String(Math.max(1, Math.round(seconds / 60)));
    }
    $("expose_percentage").checked = Boolean(c.expose_percentage);
    const timed = Number(c.work_minutes) > 0 || Number(c.rest_minutes) > 0;
    $("timed_mode").checked = timed;
    updateReconcileToggle();
  }

  function updateReconcileToggle() {
    const btn = $("btn-toggle-reconcile");
    if (!btn) return;
    const enabled = state.config?.reconcile_enabled !== false;
    btn.textContent = enabled
      ? t("disable_reconcile")
      : t("enable_reconcile");
    btn.className = enabled ? "danger" : "";
    btn.disabled = Boolean(state.busy) || !state.selected;
  }

  function readConfigFromForm() {
    const payload = { ...state.config };
    const get = (id) => $(id);

    payload.pump_entity = state.config.pump_entity || null;
    payload.distance_entity = state.config.distance_entity || null;
    payload.toggle_entities = Array.isArray(state.config.toggle_entities)
      ? state.config.toggle_entities
      : [];
    payload.led_entities = Array.isArray(state.config.led_entities)
      ? state.config.led_entities
      : [];
    payload.notify_services = Array.isArray(state.config.notify_services)
      ? state.config.notify_services
      : [];
    delete payload.notify_service;
    payload.expose_percentage = get("expose_percentage").checked;
    payload.threshold_mode = get("threshold_mode")?.value || thresholdMode();

    const numberKeys = [
      "full_distance",
      "empty_distance",
      "on_threshold",
      "off_threshold",
      "on_hold_seconds",
      "off_hold_seconds",
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
    const minutesEl = get("reconcile_interval_minutes");
    if (minutesEl && minutesEl.value !== "") {
      payload.reconcile_interval = Math.max(1, Math.round(Number(minutesEl.value))) * 60;
    }
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

  function applyEntry(entry, { preserveConfig = false } = {}) {
    state.selected = entry.entry_id;
    state.version = entry.version || state.version || "";
    const ver = $("version");
    if (ver) ver.textContent = state.version ? `v${state.version}` : "";
    if (!preserveConfig) {
      state.config = { ...entry.config };
      if (!Array.isArray(state.config.notify_services)) {
        const legacy = state.config.notify_service;
        state.config.notify_services =
          typeof legacy === "string" && legacy.trim() ? [legacy.trim()] : [];
      }
    }
    state.status = entry.status;
    $("empty-state").hidden = true;
    $("app").hidden = false;
    renderMonitor();
    if (!preserveConfig) {
      bindConfigFields();
      if ($("threshold_mode")) $("threshold_mode").value = thresholdMode();
      updateThresholdLabels();
    } else if (state.config) {
      // Refresh live values without wiping in-progress entity picks.
      selectedSingle(
        "pump_entity",
        ["switch", "input_boolean", "light"],
        t("no_pump_entity"),
        "btn-choose-pump",
        "choose_pump",
        "change_pump"
      );
      selectedSingle(
        "distance_entity",
        ["sensor", "input_number", "number"],
        t("no_distance_entity"),
        "btn-choose-distance",
        "choose_distance",
        "change_distance"
      );
    }
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
        $("badge").textContent = t("no_integration");
        return;
      }
      let entry = state.entries.find((e) => e.entry_id === state.selected) || state.entries[0];
      const preserveConfig =
        Boolean(state.entityModal) || state.tab === "config" || state.tab === "cycle" || state.tab === "alerts";
      applyEntry(entry, { preserveConfig });
      if (!list.message) showAlert("");
    } catch (err) {
      showAlert(err.message || String(err), "err");
      $("badge").className = "badge off";
      $("badge").textContent = t("error_badge");
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
      showAlert(t("msg_saved"), "ok");
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
      showAlert(enabled ? t("msg_automation_on") : t("msg_automation_off"), "ok");
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
      showAlert(desiredOn ? t("msg_demand_on") : t("msg_demand_off"), "ok");
    } catch (err) {
      showAlert(err.message || String(err), "err");
    }
    setBusy(false);
  }

  function formatLogTs(raw) {
    const text = String(raw || "");
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    return text.replace("T", " ").replace(/\.\d+/, "").replace("Z", "").replace(/\+00:00$/, "");
  }

  function formatLogValue(key, value) {
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

  function logRowHtml(row) {
    const ts = formatLogTs(row.ts);
    const ev = row.event || "";
    const preferred = ["percent", "distance", "reason", "desired_on", "enabled", "target_on", "service"];
    const keys = [
      ...preferred.filter((k) => k in row),
      ...Object.keys(row).filter((k) => !["ts", "event", ...preferred].includes(k)),
    ];
    const extra = keys.length
      ? keys.map((k) => `${k}=${formatLogValue(k, row[k])}`).join(" · ")
      : "—";
    return `<div class="log-row"><div class="log-head"><span class="log-ts">${ts}</span><span class="log-ev">${ev}</span></div><div class="log-extra">${extra}</div></div>`;
  }

  async function loadLogs() {
    if (!state.selected) return;
    try {
      const res = await api(`/entries/${state.selected}/logs?limit=200`);
      const box = $("logs");
      if (!box) return;
      const rows = res.logs || [];
      box.innerHTML = rows.length
        ? rows.map((row) => logRowHtml(row)).join("")
        : `<div class="hint">${t("no_events")}</div>`;
    } catch (err) {
      showAlert(err.message || String(err), "err");
    }
  }

  async function testAlerts() {
    if (!state.selected) return;
    setBusy(true);
    try {
      const res = await api(`/entries/${state.selected}/test_notify`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      showAlert(res.message || t("msg_test_sent"), "ok");
    } catch (err) {
      showAlert(err.message || String(err), "err");
    }
    setBusy(false);
  }

  async function setReconcileEnabled(enabled) {
    if (!state.selected) return;
    setBusy(true);
    try {
      const res = await api(`/entries/${state.selected}/config`, {
        method: "POST",
        body: JSON.stringify({ reconcile_enabled: enabled }),
      });
      applyEntry(res);
      showAlert(enabled ? t("msg_reconcile_on") : t("msg_reconcile_off"), "ok");
    } catch (err) {
      showAlert(err.message || String(err), "err");
    }
    setBusy(false);
  }

  async function saveReconcileInterval() {
    if (!state.selected) return;
    const minutesEl = $("reconcile_interval_minutes");
    const minutes = Math.max(1, Math.round(Number(minutesEl?.value || 2)));
    setBusy(true);
    try {
      const res = await api(`/entries/${state.selected}/config`, {
        method: "POST",
        body: JSON.stringify({ reconcile_interval: minutes * 60 }),
      });
      applyEntry(res);
      showAlert(t("reconcile_interval_saved"), "ok");
    } catch (err) {
      showAlert(err.message || String(err), "err");
    }
    setBusy(false);
  }

  function switchTab(tab) {
    state.tab = tab;
    if (tab === "logs") loadLogs();
    document.querySelectorAll(".tab").forEach((el) => {
      el.classList.toggle("active", el.dataset.tab === tab);
    });
    document.querySelectorAll("[data-panel]").forEach((el) => {
      el.hidden = el.dataset.panel !== tab;
    });
  }

  function wire() {
    const modeEl = $("threshold_mode");
    if (modeEl) {
      modeEl.addEventListener("change", (ev) => setThresholdMode(ev.target.value));
    }

    document.querySelectorAll(".tab[data-tab]").forEach((el) => {
      el.addEventListener("click", () => switchTab(el.dataset.tab));
    });
    $("btn-refresh").addEventListener("click", () => refresh());
    $("btn-save-config").addEventListener("click", () => saveConfig());
    $("btn-save-cycle").addEventListener("click", () => saveConfig());
    $("btn-save-alerts").addEventListener("click", () => saveConfig());
    const testAlertsBtn = $("btn-test-alerts");
    if (testAlertsBtn) {
      testAlertsBtn.addEventListener("click", () => testAlerts());
    }
    const toggleEnabledBtn = $("btn-toggle-enabled");
    if (toggleEnabledBtn) {
      toggleEnabledBtn.addEventListener("click", () => {
        const on = Boolean(state.status?.enabled);
        setEnabled(!on);
      });
    }
    const toggleDemandBtn = $("btn-toggle-demand");
    if (toggleDemandBtn) {
      toggleDemandBtn.addEventListener("click", () => {
        const on = Boolean(state.status?.desired_on);
        setDemand(!on);
      });
    }
    const toggleReconcileBtn = $("btn-toggle-reconcile");
    if (toggleReconcileBtn) {
      toggleReconcileBtn.addEventListener("click", () => {
        const on = state.config?.reconcile_enabled !== false;
        setReconcileEnabled(!on);
      });
    }
    const saveReconcileBtn = $("btn-save-reconcile");
    if (saveReconcileBtn) {
      saveReconcileBtn.addEventListener("click", () => saveReconcileInterval());
    }
    const btnLogs = $("btn-refresh-logs");
    if (btnLogs) btnLogs.addEventListener("click", () => loadLogs());
    const historyModal = $("history-modal");
    if (historyModal) {
      historyModal.addEventListener("click", (ev) => {
        if (ev.target === historyModal) closeHistoryModal();
      });
    }
    const historyClose = $("history-modal-close");
    if (historyClose) historyClose.addEventListener("click", () => closeHistoryModal());
    document.querySelectorAll("[data-history-range]").forEach((el) => {
      el.addEventListener("click", () => {
        const range = el.getAttribute("data-history-range") || "1d";
        if (!state.historyModal) {
          openHistoryModal(range);
        } else {
          loadHistory(range);
        }
      });
    });
    const addToggles = $("btn-add-toggles");
    if (addToggles) {
      addToggles.addEventListener("click", () =>
        openEntityModal(
          "toggle_entities",
          ["binary_sensor", "input_boolean", "switch"],
          t("modal_buttons_title"),
          t("modal_buttons_hint")
        )
      );
    }
    const addLeds = $("btn-add-leds");
    if (addLeds) {
      addLeds.addEventListener("click", () =>
        openEntityModal(
          "led_entities",
          ["light", "switch", "input_boolean"],
          t("modal_leds_title"),
          t("modal_leds_hint")
        )
      );
    }
    const choosePump = $("btn-choose-pump");
    if (choosePump) {
      choosePump.addEventListener("click", () =>
        openEntityModal(
          "pump_entity",
          ["switch", "input_boolean", "light"],
          t("modal_pump_title"),
          t("modal_pump_hint"),
          { mode: "single" }
        )
      );
    }
    const chooseDistance = $("btn-choose-distance");
    if (chooseDistance) {
      chooseDistance.addEventListener("click", () =>
        openEntityModal(
          "distance_entity",
          ["sensor", "input_number", "number"],
          t("modal_distance_title"),
          t("modal_distance_hint"),
          { mode: "single" }
        )
      );
    }
    const addNotify = $("btn-add-notify");
    if (addNotify) {
      addNotify.addEventListener("click", () =>
        openEntityModal(
          "notify_services",
          ["notify"],
          t("modal_notify_title"),
          t("modal_notify_hint")
        )
      );
    }
    const modal = $("entity-modal");
    if (modal) {
      modal.addEventListener("click", (ev) => {
        if (ev.target === modal) closeEntityModal();
      });
    }
    const modalClose = $("entity-modal-close");
    if (modalClose) modalClose.addEventListener("click", () => closeEntityModal());
    const modalCancel = $("entity-modal-cancel");
    if (modalCancel) modalCancel.addEventListener("click", () => closeEntityModal());
    const modalConfirm = $("entity-modal-confirm");
    if (modalConfirm) modalConfirm.addEventListener("click", () => confirmEntityModal());
    const modalSearch = $("entity-modal-search");
    if (modalSearch) {
      modalSearch.addEventListener("input", (ev) => {
        if (!state.entityModal) return;
        state.entityModal.query = ev.target.value;
        renderModalList();
      });
    }
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

  async function loadLanguage() {
    try {
      const res = await api("/language");
      state.lang = I18n.resolveLang(res.language);
    } catch {
      state.lang = "en";
    }
    applyLanguage();
  }

  wire();
  loadLanguage()
    .then(() => refresh())
    .catch(() => refresh());
  state.pollTimer = setInterval(() => {
    if (!state.busy) refresh();
  }, 5000);
})();
