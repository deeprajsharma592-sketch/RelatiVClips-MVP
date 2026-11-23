import json

from backend.llm import openrouter_client


class _Response:
    status_code = 200
    text = ""

    def json(self):
        return {
            "choices": [{"message": {"content": json.dumps({"status": "ok", "clips": []})}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 20},
        }


def test_openrouter_models_are_fixed(monkeypatch):
    calls = []

    class _Client:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def post(self, url, json, headers):
            calls.append(json["model"])
            return _Response()

    monkeypatch.setattr(openrouter_client, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(openrouter_client.httpx, "Client", _Client)
    openrouter_client.generate_haiku("transcript")
    openrouter_client.generate_deepseek("transcript")

    assert calls == [
        "anthropic/claude-haiku-5.5",
        "deepseek/deepseek-v4.1-flash-1017",
    ]
