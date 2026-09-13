"""Sidebar panel registration for Tankwise."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

FRONTEND_PATH = Path(__file__).parent / "frontend"
_PANEL_REGISTERED = False


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register static frontend assets and the Tankwise sidebar panel."""
    global _PANEL_REGISTERED
    if _PANEL_REGISTERED:
        return

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                "/tankwise/frontend",
                str(FRONTEND_PATH),
                False,
            )
        ]
    )

    try:
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path="tankwise",
            webcomponent_name="tankwise-panel",
            sidebar_title="Tankwise",
            sidebar_icon="mdi:water-pump",
            module_url="/tankwise/frontend/tankwise-panel.js",
            embed_iframe=False,
            require_admin=True,
            config_panel_domain="tankwise",
        )
    except ValueError as err:
        # Already registered on reload
        _LOGGER.debug("Tankwise panel registration skipped: %s", err)

    _PANEL_REGISTERED = True
    _LOGGER.info("Tankwise sidebar panel available at /tankwise")
