"""Register Tankwise Lovelace cards as dashboard resources."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later

from .panel import _async_register_static, _integration_version

_LOGGER = logging.getLogger(__name__)

# Each card is served from /tankwise/frontend/ and auto-added to Lovelace resources.
LOVELACE_CARDS: tuple[str, ...] = (
    "tankwise-history-card.js",
    "tankwise-status-card.js",
)


def _card_url(filename: str) -> str:
    return f"/tankwise/frontend/{filename}?v={_integration_version()}"


def _card_url_base(filename: str) -> str:
    return f"/tankwise/frontend/{filename}"


def _lovelace_data(hass: HomeAssistant) -> Any | None:
    return hass.data.get("lovelace")


def _lovelace_mode(lovelace: Any) -> str | None:
    mode = getattr(lovelace, "mode", None)
    if mode is not None:
        return str(mode)
    if isinstance(lovelace, dict):
        raw = lovelace.get("mode")
        return str(raw) if raw is not None else None
    return None


def _lovelace_resources(lovelace: Any) -> Any | None:
    resources = getattr(lovelace, "resources", None)
    if resources is not None:
        return resources
    if isinstance(lovelace, dict):
        return lovelace.get("resources")
    return None


def _resource_path(url: str) -> str:
    return str(url or "").split("?", 1)[0]


def _resource_version(url: str) -> str | None:
    if "?v=" not in str(url or ""):
        return None
    return str(url).rsplit("?v=", 1)[-1]


async def _async_register_one_storage_resource(
    resources: Any, filename: str
) -> None:
    """Create or update one card module in Lovelace storage resources."""
    url = _card_url(filename)
    base = _card_url_base(filename)
    version = _integration_version()
    existing = [
        item
        for item in resources.async_items()
        if _resource_path(item.get("url", "")).startswith(base)
        or _resource_path(item.get("url", "")) == base
    ]

    for item in existing:
        if _resource_version(item.get("url", "")) == version:
            _LOGGER.debug("Tankwise Lovelace card already registered at %s", url)
            return
        if hasattr(resources, "async_update_item"):
            await resources.async_update_item(
                item["id"],
                {"res_type": "module", "url": url},
            )
            _LOGGER.info("Updated Tankwise Lovelace card resource to %s", url)
            return
        item["url"] = url
        _LOGGER.info("Patched Tankwise Lovelace card resource URL to %s", url)
        return

    if hasattr(resources, "async_create_item"):
        await resources.async_create_item({"res_type": "module", "url": url})
        _LOGGER.info("Registered Tankwise Lovelace card resource: %s", url)
        return

    _LOGGER.warning(
        "Could not create Lovelace resource for Tankwise card; add manually: %s",
        url,
    )


async def _async_register_storage_resources(resources: Any) -> None:
    """Create or update all Tankwise card modules in Lovelace storage."""
    if hasattr(resources, "async_get_info"):
        await resources.async_get_info()
    for filename in LOVELACE_CARDS:
        await _async_register_one_storage_resource(resources, filename)


def _register_extra_js(hass: HomeAssistant) -> None:
    """YAML / fallback: load modules via frontend extra JS."""
    try:
        from homeassistant.components.frontend import add_extra_js_url
    except Exception:  # noqa: BLE001
        _LOGGER.exception("frontend.add_extra_js_url unavailable")
        return

    for filename in LOVELACE_CARDS:
        url = _card_url(filename)
        try:
            add_extra_js_url(hass, url)
            _LOGGER.info("Registered Tankwise Lovelace card via extra JS: %s", url)
        except Exception:  # noqa: BLE001
            _LOGGER.exception(
                "Failed to register Tankwise Lovelace card as extra JS (%s)", url
            )


async def async_register_lovelace_card(hass: HomeAssistant) -> None:
    """Serve + register Tankwise Lovelace cards for any dashboard."""
    from .const import DOMAIN

    await _async_register_static(hass)

    lovelace = _lovelace_data(hass)
    if lovelace is None:
        retries = int(hass.data.setdefault(DOMAIN, {}).get("_lovelace_retries", 0))
        if retries >= 12:
            manuals = ", ".join(_card_url(name) for name in LOVELACE_CARDS)
            _LOGGER.warning(
                "Lovelace never became ready; add Tankwise card resources manually: %s",
                manuals,
            )
            return
        hass.data[DOMAIN]["_lovelace_retries"] = retries + 1
        _LOGGER.debug(
            "Lovelace not ready yet; Tankwise cards will retry registration shortly"
        )

        async def _retry(_now: Any) -> None:
            await async_register_lovelace_card(hass)

        async_call_later(hass, 5, _retry)
        return

    hass.data.setdefault(DOMAIN, {}).pop("_lovelace_retries", None)
    resources = _lovelace_resources(lovelace)
    mode = _lovelace_mode(lovelace)

    if mode == "storage" and resources is not None:

        async def _when_loaded(_now: Any = None) -> None:
            loaded = getattr(resources, "loaded", True)
            if loaded is False:
                async_call_later(hass, 5, _when_loaded)
                return
            try:
                await _async_register_storage_resources(resources)
            except Exception:  # noqa: BLE001
                _LOGGER.exception(
                    "Failed to register Tankwise Lovelace cards in storage mode"
                )
                _register_extra_js(hass)

        await _when_loaded()
        return

    _register_extra_js(hass)
