"""TankWise Supervisor add-on — ingress web UI + Home Assistant API proxy."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from aiohttp import ClientSession, ClientTimeout, web

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8099"))
STATIC_DIR = Path(__file__).resolve().parent / "static"

# Supervisor injects these inside the add-on container
HA_URL = os.environ.get("HA_URL", "http://supervisor/core").rstrip("/")
TOKEN = os.environ.get("SUPERVISOR_TOKEN") or os.environ.get("HASSIO_TOKEN") or ""

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
_LOGGER = logging.getLogger("tankwise.addon")


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    }


async def _ha(
    session: ClientSession,
    method: str,
    path: str,
    *,
    json_body: dict | None = None,
) -> tuple[int, object]:
    url = f"{HA_URL}{path}"
    async with session.request(
        method,
        url,
        headers=_headers(),
        json=json_body,
        timeout=ClientTimeout(total=30),
    ) as resp:
        text = await resp.text()
        if not text:
            return resp.status, None
        try:
            return resp.status, await resp.json(content_type=None)
        except Exception:  # noqa: BLE001
            return resp.status, {"message": text}


def _json_error(message: str, status: int = 502) -> web.Response:
    return web.json_response({"message": message}, status=status)



_MSG = {
    "en": {
        "integration_missing": (
            "Tankwise integration not found. "
            "Install via HACS and add it under Devices & services."
        ),
        "invalid_json": "Invalid JSON",
        "cannot_list_entities": "Could not list entities",
    },
    "pt": {
        "integration_missing": (
            "Integração Tankwise não encontrada. "
            "Instale via HACS e adicione em Dispositivos e serviços."
        ),
        "invalid_json": "JSON inválido",
        "cannot_list_entities": "Não foi possível listar entidades",
    },
}


def _resolve_lang(raw: object) -> str:
    text = str(raw or "en").lower()
    return "pt" if text.startswith("pt") else "en"


def _t(lang: str, key: str) -> str:
    code = _resolve_lang(lang)
    return _MSG.get(code, _MSG["en"]).get(key) or _MSG["en"].get(key) or key


async def _ha_lang(session: ClientSession) -> str:
    status, data = await _ha(session, "GET", "/api/config")
    if status < 400 and isinstance(data, dict):
        return _resolve_lang(data.get("language"))
    return "en"

async def api_health(_: web.Request) -> web.Response:
    ok = bool(TOKEN)
    return web.json_response(
        {
            "ok": ok,
            "ha_url": HA_URL,
            "token_present": ok,
        }
    )



async def api_language(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    lang = await _ha_lang(session)
    return web.json_response({"language": lang})


async def api_entries(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    status, data = await _ha(session, "GET", "/api/tankwise/entries")
    if status == 404:
        lang = await _ha_lang(session)
        return web.json_response(
            {
                "entries": [],
                "message": _t(lang, "integration_missing"),
            }
        )
    if status >= 400:
        return _json_error(
            (data or {}).get("message", f"HA API error {status}")
            if isinstance(data, dict)
            else f"HA API error {status}",
            status=status,
        )
    return web.json_response(data)


async def api_entry(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    entry_id = request.match_info["entry_id"]
    status, data = await _ha(session, "GET", f"/api/tankwise/entries/{entry_id}")
    if status >= 400:
        return _json_error(
            (data or {}).get("message", f"HA API error {status}")
            if isinstance(data, dict)
            else f"HA API error {status}",
            status=status,
        )
    return web.json_response(data)


async def api_config(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    entry_id = request.match_info["entry_id"]
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        lang = await _ha_lang(session)
        return _json_error(_t(lang, "invalid_json"), 400)
    status, data = await _ha(
        session,
        "POST",
        f"/api/tankwise/entries/{entry_id}/config",
        json_body=body if isinstance(body, dict) else {"config": body},
    )
    if status >= 400:
        return _json_error(
            (data or {}).get("message", f"HA API error {status}")
            if isinstance(data, dict)
            else f"HA API error {status}",
            status=status,
        )
    return web.json_response(data)


async def api_enabled(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    entry_id = request.match_info["entry_id"]
    body = await request.json()
    status, data = await _ha(
        session,
        "POST",
        f"/api/tankwise/entries/{entry_id}/enabled",
        json_body=body,
    )
    if status >= 400:
        return _json_error(
            (data or {}).get("message", f"HA API error {status}")
            if isinstance(data, dict)
            else f"HA API error {status}",
            status=status,
        )
    return web.json_response(data)


async def api_demand(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    entry_id = request.match_info["entry_id"]
    body = await request.json()
    status, data = await _ha(
        session,
        "POST",
        f"/api/tankwise/entries/{entry_id}/demand",
        json_body=body,
    )
    if status >= 400:
        return _json_error(
            (data or {}).get("message", f"HA API error {status}")
            if isinstance(data, dict)
            else f"HA API error {status}",
            status=status,
        )
    return web.json_response(data)


async def api_reconcile(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    entry_id = request.match_info["entry_id"]
    status, data = await _ha(
        session,
        "POST",
        f"/api/tankwise/entries/{entry_id}/reconcile",
        json_body={},
    )
    if status >= 400:
        return _json_error(
            (data or {}).get("message", f"HA API error {status}")
            if isinstance(data, dict)
            else f"HA API error {status}",
            status=status,
        )
    return web.json_response(data)


async def api_entities(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    status, data = await _ha(session, "GET", "/api/tankwise/entities")
    if status == 404:
        # Fallback: list from /api/states when integration HTTP API missing
        st, states = await _ha(session, "GET", "/api/states")
        if st >= 400 or not isinstance(states, list):
            lang = await _ha_lang(session)
            return _json_error(_t(lang, "cannot_list_entities"), status=st)
        domains = {
            "switch",
            "sensor",
            "binary_sensor",
            "light",
            "input_boolean",
            "input_number",
            "number",
        }
        buckets: dict[str, list] = {d: [] for d in domains}
        for item in states:
            eid = item.get("entity_id", "")
            domain = eid.split(".", 1)[0]
            if domain not in buckets:
                continue
            name = item.get("attributes", {}).get("friendly_name") or eid
            unit = item.get("attributes", {}).get("unit_of_measurement") or ""
            buckets[domain].append(
                {
                    "id": eid,
                    "name": f"{name} ({eid})",
                    "state": str(item.get("state") or ""),
                    "unit": str(unit),
                }
            )
        for key in buckets:
            buckets[key].sort(key=lambda x: x["name"])
        # Also list notify.* services for the alerts picker.
        notify_map: dict[str, dict] = {}
        st2, services = await _ha(session, "GET", "/api/services")
        if st2 < 400 and isinstance(services, list):
            for domain_block in services:
                if domain_block.get("domain") != "notify":
                    continue
                for name in (domain_block.get("services") or {}):
                    sid = f"notify.{name}"
                    notify_map[sid] = {"id": sid, "name": sid}
        for item in states:
            eid = item.get("entity_id", "")
            if not eid.startswith("notify."):
                continue
            label = item.get("attributes", {}).get("friendly_name") or eid
            notify_map[eid] = {"id": eid, "name": f"{label} ({eid})"}
        buckets["notify"] = sorted(notify_map.values(), key=lambda x: x["name"])
        return web.json_response({"entities": buckets})
    if status >= 400:
        return _json_error(
            (data or {}).get("message", f"HA API error {status}")
            if isinstance(data, dict)
            else f"HA API error {status}",
            status=status,
        )
    return web.json_response(data)


async def index(_: web.Request) -> web.Response:
    return web.FileResponse(STATIC_DIR / "index.html")


async def on_startup(app: web.Application) -> None:
    app["session"] = ClientSession()
    if not TOKEN:
        _LOGGER.warning("SUPERVISOR_TOKEN missing — HA API calls will fail")
    else:
        _LOGGER.info("TankWise add-on ready (HA=%s)", HA_URL)


async def on_cleanup(app: web.Application) -> None:
    await app["session"].close()



async def api_logs(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    entry_id = request.match_info["entry_id"]
    limit = request.rel_url.query.get("limit", "50")
    status, data = await _ha(
        session, "GET", f"/api/tankwise/entries/{entry_id}/logs?limit={limit}"
    )
    if status >= 400:
        return _json_error(
            (data or {}).get("message", f"HA API error {status}")
            if isinstance(data, dict)
            else f"HA API error {status}",
            status=status,
        )
    return web.json_response(data)


async def api_level_history(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    entry_id = request.match_info["entry_id"]
    range_key = request.rel_url.query.get("range", "1d")
    status, data = await _ha(
        session,
        "GET",
        f"/api/tankwise/entries/{entry_id}/level_history?range={range_key}",
    )
    if status >= 400:
        return _json_error(
            (data or {}).get("message", f"HA API error {status}")
            if isinstance(data, dict)
            else f"HA API error {status}",
            status=status,
        )
    return web.json_response(data)


async def api_test_notify(request: web.Request) -> web.Response:
    session: ClientSession = request.app["session"]
    entry_id = request.match_info["entry_id"]
    status, data = await _ha(
        session, "POST", f"/api/tankwise/entries/{entry_id}/test_notify", json_body={}
    )
    if status >= 400:
        return _json_error(
            (data or {}).get("message", f"HA API error {status}")
            if isinstance(data, dict)
            else f"HA API error {status}",
            status=status,
        )
    return web.json_response(data)


def create_app() -> web.Application:
    app = web.Application()
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)

    app.router.add_get("/api/health", api_health)
    app.router.add_get("/api/language", api_language)
    app.router.add_get("/api/entries", api_entries)
    app.router.add_get("/api/entries/{entry_id}", api_entry)
    app.router.add_post("/api/entries/{entry_id}/config", api_config)
    app.router.add_post("/api/entries/{entry_id}/enabled", api_enabled)
    app.router.add_post("/api/entries/{entry_id}/demand", api_demand)
    app.router.add_post("/api/entries/{entry_id}/reconcile", api_reconcile)
    app.router.add_get("/api/entries/{entry_id}/logs", api_logs)
    app.router.add_get("/api/entries/{entry_id}/level_history", api_level_history)
    app.router.add_post("/api/entries/{entry_id}/test_notify", api_test_notify)
    app.router.add_get("/api/entities", api_entities)

    app.router.add_get("/", index)
    app.router.add_static("/static/", STATIC_DIR, show_index=False)
    return app


def main() -> None:
    _LOGGER.info("Starting TankWise add-on on %s:%s", HOST, PORT)
    web.run_app(create_app(), host=HOST, port=PORT, print=None)


if __name__ == "__main__":
    main()
