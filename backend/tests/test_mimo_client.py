from backend.llm import chain


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
