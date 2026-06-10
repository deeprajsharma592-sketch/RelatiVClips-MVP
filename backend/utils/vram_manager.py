import gc
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    torch = None
    TORCH_AVAILABLE = False

def clear_gpu() -> dict:
    """
    Sequential VRAM Handover Protocol.

    WHY THIS MATTERS:
    - RTX 5050 has 8GB VRAM ceiling
    - faster-whisper uses ~3-4GB when loaded
    - FFmpeg AV1 encoding uses ~1.5GB
    - Running both simultaneously = CUDA OOM crash

    This function ensures clean GPU memory release between pipeline stages,
    allowing sequential model loading without memory conflicts.

    Returns:
        dict: VRAM status before and after clearing
    """
    vram_before = {}

    if TORCH_AVAILABLE and torch.cuda.is_available():
        vram_before = {
            "allocated_mb": torch.cuda.memory_allocated() / 1024 / 1024,
            "reserved_mb": torch.cuda.memory_reserved() / 1024 / 1024,
            "cuda_available": True
        }

        torch.cuda.empty_cache()
        gc.collect()

        vram_after = {
            "allocated_mb": torch.cuda.memory_allocated() / 1024 / 1024,
            "reserved_mb": torch.cuda.memory_reserved() / 1024 / 1024
        }

        return {
            "status": "cleared",
            "before": vram_before,
            "after": vram_after,
            "released_mb": vram_before.get("allocated_mb", 0) - vram_after["allocated_mb"]
        }

    return {"status": "no_cuda", "cuda_available": False, "torch_available": TORCH_AVAILABLE}


def get_vram_usage() -> dict:
    """
    Check current VRAM usage for monitoring.

    Returns:
        dict: Current GPU memory statistics
    """
    if TORCH_AVAILABLE and torch.cuda.is_available():
        return {
            "allocated_mb": round(torch.cuda.memory_allocated() / 1024 / 1024, 2),
            "reserved_mb": round(torch.cuda.memory_reserved() / 1024 / 1024, 2),
            "max_allocated_mb": round(torch.cuda.max_memory_allocated() / 1024 / 1024, 2),
            "cuda_available": True,
            "torch_available": True
        }

    return {
        "allocated_mb": 0,
        "reserved_mb": 0,
        "cuda_available": False,
        "torch_available": TORCH_AVAILABLE
    }