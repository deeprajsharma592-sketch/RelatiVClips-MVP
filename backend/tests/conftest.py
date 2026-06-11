import sys
from pathlib import Path
import warnings

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


@pytest.fixture(autouse=True)
def capture_unawaited_coroutines():
    """Fail the test if any coroutine is created but never awaited.

    This regression guard ensures the `_run_async` helper in task_store
    always either awaits its coroutine (via the bound event loop) or
    closes it — never silently drops it.
    """
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", RuntimeWarning)
        yield
        unawaited = [
            str(w.message)
            for w in caught
            if "was never awaited" in str(w.message)
        ]
        if unawaited:
            pytest.fail(
                "Unawaited coroutine created during test:\n  "
                + "\n  ".join(unawaited)
            )
