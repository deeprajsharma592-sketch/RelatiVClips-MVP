import json

from backend.llm import chain, mimo_client


class _Response:
    status_code = 200
    text = ""

    def json(self):
        return {
            "choices": [{"message": {"content": json.dumps({"rubric_ver": "sauce-0.3", "candidates": []})}}],
            "usage": {"prompt_tokens": 120, "completion_tokens": 20},
        }


def test_mimo_uses_shared_system_prompt_and_structured_output(monkeypatch):
    captured = {}

    class _Client:
        def __init__(self, **kwargs):
            captured["client"] = kwargs

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def post(self, url, json, headers):
            captured.update(url=url, payload=json, headers=headers)
            return _Response()

    monkeypatch.setattr(mimo_client, "MIMO_API_KEY", "test-key")
    monkeypatch.setattr(mimo_client.httpx, "Client", _Client)
    text = mimo_client.generate("timestamped transcript", max_tokens=700)

    assert json.loads(text)["rubric_ver"] == "sauce-0.3"
    assert captured["url"].endswith("/chat/completions")
    assert captured["payload"]["model"] == "mimo-v2.6-pro"
    assert captured["payload"]["response_format"] == {"type": "json_object"}
    assert captured["payload"]["thinking"] == {"type": "disabled"}
    assert "RELATIV MASTER CLIP INTELLIGENCE" in captured["payload"]["messages"][0]["content"]
    assert "THE FIVE LAWS" in captured["payload"]["messages"][0]["content"]
    assert captured["payload"]["messages"][1]["content"] == "timestamped transcript"


def test_calibration_chain_is_strict_and_ordered(monkeypatch):
    direct = lambda prompt: "direct"
    or_haiku = lambda prompt: "or-haiku"
    or_deepseek = lambda prompt: "or-deepseek"
    monkeypatch.setattr(chain, "_build_claude_callable", lambda: direct)
    monkeypatch.setattr(chain, "_build_openrouter_haiku_callable", lambda: or_haiku)
    monkeypatch.setattr(chain, "_build_openrouter_deepseek_callable", lambda: or_deepseek)

    expected = [
        ("anthropic_direct_haiku_5_5", direct),
        ("openrouter_haiku_5_5", or_haiku),
        ("openrouter_deepseek_v4_1_flash_1017", or_deepseek),
    ]
    assert chain._provider_chain() == expected
    assert chain._provider_chain("mimo") == expected
