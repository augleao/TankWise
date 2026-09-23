"""Smoke checks for the Lovelace history card packaging."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "custom_components" / "tankwise" / "frontend"
LOVELACE = ROOT / "custom_components" / "tankwise" / "lovelace.py"


def test_history_card_js_exists():
    card = FRONTEND / "tankwise-history-card.js"
    assert card.is_file()
    text = card.read_text(encoding="utf-8")
    assert "customElements.define" in text
    assert "tankwise-history-card" in text
    assert "tankwise/level_history" in text
    assert "tankwise/card_entries" in text
    assert "window.customCards" in text


def test_status_card_js_exists():
    card = FRONTEND / "tankwise-status-card.js"
    assert card.is_file()
    text = card.read_text(encoding="utf-8")
    assert "customElements.define" in text
    assert "tankwise-status-card" in text
    assert "tankwise/card_status" in text
    assert "tankwise/card_entries" in text
    assert "window.customCards" in text
    assert 'this._t("controller")' in text or "_t(\"controller\")" in text


def test_lovelace_registration_module_exists():
    text = LOVELACE.read_text(encoding="utf-8")
    assert "async_register_lovelace_card" in text
    assert "tankwise-history-card.js" in text
    assert "tankwise-status-card.js" in text
    assert "LOVELACE_CARDS" in text
