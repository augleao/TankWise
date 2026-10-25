"""Smoke checks for the ESP8266 level-sensor firmware package."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTEGRATION_FW = ROOT / "custom_components" / "tankwise" / "frontend" / "firmware"
ADDON_FW = ROOT / "tankwise" / "rootfs" / "app" / "static" / "firmware"


def _assert_firmware_dir(path: Path) -> None:
    manifest_path = path / "manifest.json"
    bin_path = path / "sensor-firmware.bin"
    assert manifest_path.is_file()
    assert bin_path.is_file()
    assert bin_path.stat().st_size > 100_000
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["version"] == "1.0.1"
    assert manifest["builds"][0]["chipFamily"] == "ESP8266"
    assert manifest["builds"][0]["parts"][0]["path"] == "sensor-firmware.bin"


def test_integration_firmware_package():
    _assert_firmware_dir(INTEGRATION_FW)


def test_addon_firmware_package_matches_integration():
    _assert_firmware_dir(ADDON_FW)
    integ = (INTEGRATION_FW / "sensor-firmware.bin").read_bytes()
    addon = (ADDON_FW / "sensor-firmware.bin").read_bytes()
    assert integ == addon
