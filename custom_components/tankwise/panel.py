"""Sidebar panel registration for Tankwise.

Registers a custom sidebar item (like add-on dashboards) pointing at the
Tankwise web component. Uses frontend.async_register_built_in_panel with
keyword-only args for compatibility with newer Home Assistant cores.
"""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

FRONTEND_PATH = Path(__file__).parent / "frontend"
PANEL_URL_PATH = "tankwise"
PANEL_JS_PATH = "/tankwise/frontend/tankwise-panel.js"


def _integration_version() -> str:
    """Return manifest version for cache-busting the panel JS."""
    try:
        import json

        manifest = json.loads(
            (Path(__file__).with_name("manifest.json")).read_text(encoding="utf-8")
        )
        return str(manifest.get("version", "0"))
    except Exception:  # noqa: BLE001
        return "0"


def _panel_js_url() -> str:
    return f"{PANEL_JS_PATH}?v={_integration_version()}"


_PANEL_REGISTERED = False


async def _async_register_static(hass: HomeAssistant) -> None:
    """Serve the panel JS/CSS from /tankwise/frontend/..."""
    try:
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    "/tankwise/frontend",
                    str(FRONTEND_PATH),
                    False,  # no cache — always pick up updates
                )
            ]
        )
    except Exception:  # noqa: BLE001
        _LOGGER.debug("Using legacy http.async_register_static_path")
        try:
            hass.http.async_register_static_path(
                "/tankwise/frontend",
                str(FRONTEND_PATH),
                cache_headers=False,
            )
        except Exception:  # noqa: BLE001
            # Path may already exist after reload
            _LOGGER.debug("Static path /tankwise/frontend already registered")


def _register_built_in(hass: HomeAssistant) -> None:
    """Register via frontend API (preferred on modern HA)."""
    from homeassistant.components.frontend import async_register_built_in_panel

    # ALL keyword args — HA inserted sidebar_default_visible and broke positional calls.
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Tankwise",
        sidebar_icon="mdi:water-pump",
        sidebar_default_visible=True,
        frontend_url_path=PANEL_URL_PATH,
        config={
            "_panel_custom": {
                "name": "tankwise-panel",
                "embed_iframe": False,
                "trust_external": False,
                "module_url": _panel_js_url(),
            }
        },
        require_admin=False,
        update=True,
        show_in_sidebar=True,
    )


async def _register_panel_custom(hass: HomeAssistant) -> None:
    """Fallback through panel_custom helper."""
    from homeassistant.components import panel_custom

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name="tankwise-panel",
        sidebar_title="Tankwise",
        sidebar_icon="mdi:water-pump",
        module_url=_panel_js_url(),
        embed_iframe=False,
        require_admin=False,
    )


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register static assets + Tankwise sidebar panel (idempotent)."""
    global _PANEL_REGISTERED

    await _async_register_static(hass)

    # Wait until frontend is available (dependencies should guarantee this,
    # but be defensive on reload / partial setups).
    if "frontend" not in hass.config.components:
        _LOGGER.warning(
            "Frontend not loaded yet; Tankwise sidebar panel deferred until entry setup"
        )
        return

    try:
        _register_built_in(hass)
        _PANEL_REGISTERED = True
        _LOGGER.info(
            "Tankwise sidebar panel registered at /%s (open it from the left menu)",
            PANEL_URL_PATH,
        )
        return
    except TypeError:
        # Older cores without sidebar_default_visible / show_in_sidebar / update
        _LOGGER.debug("Retrying built-in panel registration with fewer kwargs")
        try:
            from homeassistant.components.frontend import async_register_built_in_panel

            async_register_built_in_panel(
                hass,
                component_name="custom",
                sidebar_title="Tankwise",
                sidebar_icon="mdi:water-pump",
                frontend_url_path=PANEL_URL_PATH,
                config={
                    "_panel_custom": {
                        "name": "tankwise-panel",
                        "embed_iframe": False,
                        "trust_external": False,
                        "module_url": _panel_js_url(),
                    }
                },
                require_admin=False,
            )
            _PANEL_REGISTERED = True
            _LOGGER.info("Tankwise sidebar panel registered (legacy frontend API)")
            return
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Built-in panel registration failed; trying panel_custom")
    except ValueError as err:
        # Already registered
        _PANEL_REGISTERED = True
        _LOGGER.info("Tankwise panel already present: %s", err)
        return
    except Exception:  # noqa: BLE001
        _LOGGER.exception("Built-in panel registration failed; trying panel_custom")

    try:
        await _register_panel_custom(hass)
        _PANEL_REGISTERED = True
        _LOGGER.info("Tankwise sidebar panel registered via panel_custom")
    except ValueError as err:
        _PANEL_REGISTERED = True
        _LOGGER.info("Tankwise panel_custom already present: %s", err)
    except Exception:  # noqa: BLE001
        _LOGGER.exception(
            "Could not register Tankwise sidebar panel. "
            "Open http://homeassistant.local:8123/tankwise manually after fixing logs."
        )


def is_panel_registered() -> bool:
    """Return True if the sidebar panel was registered in this process."""
    return _PANEL_REGISTERED
