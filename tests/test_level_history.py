"""Unit tests for recorder history API compatibility helpers."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "custom_components" / "tankwise"))

from helpers import call_history_compat  # noqa: E402


def test_call_history_drops_unsupported_kwargs():
    def old_api(hass, *, start_time, end_time, entity_id, include_start_time_state=True):
        return {"entity_id": entity_id, "start": start_time, "end": end_time}

    result = call_history_compat(
        old_api,
        object(),
        start_time=1,
        end_time=2,
        entity_id="sensor.tank",
        include_start_time_state=True,
        significant_changes_only=False,
        no_attributes=True,
    )
    assert result == {"entity_id": "sensor.tank", "start": 1, "end": 2}


def test_call_history_retries_without_optional_kwargs():
    calls: list[dict] = []

    def quirky(hass, **kwargs):
        calls.append(dict(kwargs))
        if "significant_changes_only" in kwargs:
            raise TypeError("unexpected keyword argument 'significant_changes_only'")
        return {"ok": True, **kwargs}

    result = call_history_compat(
        quirky,
        object(),
        start_time=1,
        significant_changes_only=False,
        no_attributes=True,
    )
    assert result["ok"] is True
    assert "significant_changes_only" not in result
    assert len(calls) >= 2
