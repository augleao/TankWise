"""Simple EN/PT message catalog for Tankwise backend strings."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant

_STRINGS: dict[str, dict[str, str]] = {
    "en": {
        "history_no_recorder": "History unavailable (recorder not loaded).",
        "history_no_recorder_active": "History unavailable (recorder is not active).",
        "history_query_failed": "Failed to read history: {err}",
        "history_no_data": (
            "No data in this period. Confirm that the distance sensor and pump "
            "are being recorded by the Recorder."
        ),
        "history_no_level": (
            "No level data in this period. Pump status may still appear below."
        ),
        "history_no_pump": (
            "No pump data in this period. Tank level may still appear on the chart."
        ),
        "test_no_notify": "No notify service configured.",
        "test_sent": "Test notification sent to {count} target(s).",
        "test_title": "Tankwise — alert test",
        "test_body": (
            "This is a Tankwise test notification. If you received this message, "
            "alerts are working."
        ),
        "notify_critical_title": "Tankwise critical level",
        "notify_critical_body": "Tank level is critically low ({percent:.0f}%).",
        "notify_low_title": "Tankwise low level",
        "notify_low_body": "Tank level is low ({percent:.0f}%).",
        "notify_failsafe_title": "Tankwise failsafe",
        "notify_failsafe_body": (
            "Pump stayed ON longer than work+margin; demand forced OFF."
        ),
        "notify_reconcile_title": "Tankwise reconcile fault",
        "notify_reconcile_body": "Could not set {entity} to {state}.",
        "state_on": "ON",
        "state_off": "OFF",
    },
    "pt": {
        "history_no_recorder": "Histórico indisponível (recorder não carregado).",
        "history_no_recorder_active": "Histórico indisponível (recorder não está ativo).",
        "history_query_failed": "Falha ao ler histórico: {err}",
        "history_no_data": (
            "Sem dados neste período. Confirme se o sensor de distância e a bomba "
            "estão sendo gravados pelo Recorder."
        ),
        "history_no_level": (
            "Sem dados de nível neste período. "
            "O status da bomba ainda pode aparecer abaixo."
        ),
        "history_no_pump": (
            "Sem dados da bomba neste período. "
            "O nível da caixa ainda pode aparecer no gráfico."
        ),
        "test_no_notify": "Nenhum serviço notify configurado.",
        "test_sent": "Notificação de teste enviada para {count} destino(s).",
        "test_title": "Tankwise — teste de alerta",
        "test_body": (
            "Esta é uma notificação de teste do Tankwise. Se você recebeu esta "
            "mensagem, os alertas estão funcionando."
        ),
        "notify_critical_title": "Tankwise nível crítico",
        "notify_critical_body": "O nível da caixa está criticamente baixo ({percent:.0f}%).",
        "notify_low_title": "Tankwise nível baixo",
        "notify_low_body": "O nível da caixa está baixo ({percent:.0f}%).",
        "notify_failsafe_title": "Tankwise failsafe",
        "notify_failsafe_body": (
            "A bomba ficou ON além de trabalho+margem; demanda forçada OFF."
        ),
        "notify_reconcile_title": "Tankwise falha de reconciliação",
        "notify_reconcile_body": "Não foi possível definir {entity} para {state}.",
        "state_on": "ON",
        "state_off": "OFF",
    },
}


def resolve_lang(raw: str | None) -> str:
    text = str(raw or "en").lower()
    return "pt" if text.startswith("pt") else "en"


def hass_lang(hass: HomeAssistant) -> str:
    return resolve_lang(getattr(hass.config, "language", None))


def t(lang: str | None, key: str, **vars: Any) -> str:
    code = resolve_lang(lang)
    template = _STRINGS.get(code, _STRINGS["en"]).get(key) or _STRINGS["en"].get(key) or key
    try:
        return template.format(**vars)
    except Exception:  # noqa: BLE001
        return template
