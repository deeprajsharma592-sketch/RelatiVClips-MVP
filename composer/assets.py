"""Asset library: SFX and popup images with a manifest that carries licence notes.

The composer copies (or hardlinks) referenced assets into each Hyperframes
project so renders never reach outside their folder.
"""

from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping

import engine_config

ASSET_TYPES = ("sfx", "popup")


@dataclass(frozen=True)
class Asset:
    id: str
    type: str
    file: str
    tags: tuple[str, ...] = ()
    license: str = "unknown"
    description: str = ""
    duration_s: float | None = None

    def path(self, root: Path) -> Path:
        return (root / self.file).resolve()


class AssetLibrary:
    def __init__(self, root: Path | None = None, assets: Iterable[Asset] = ()):
        self.root = (root or engine_config.settings().assets_dir).resolve()
        self._by_id: dict[str, Asset] = {a.id: a for a in assets}

    @classmethod
    def load(cls, root: Path | None = None) -> "AssetLibrary":
        base = (root or engine_config.settings().assets_dir).resolve()
        manifest = base / "manifest.json"
        if not manifest.exists():
            return cls(base, [])
        data = json.loads(manifest.read_text(encoding="utf-8"))
        assets = [
            Asset(
                id=str(item["id"]),
                type=str(item.get("type", "")),
                file=str(item["file"]),
                tags=tuple(item.get("tags", ())),
                license=str(item.get("license", "unknown")),
                description=str(item.get("description", "")),
                duration_s=item.get("duration_s"),
            )
            for item in data.get("assets", [])
        ]
        return cls(base, assets)

    def __len__(self) -> int:
        return len(self._by_id)

    def __iter__(self):
        return iter(self._by_id.values())

    def get(self, asset_id: str, kind: str | None = None) -> Asset | None:
        asset = self._by_id.get(asset_id)
        if asset is None:
            return None
        if kind and asset.type != kind:
            return None
        return asset

    def require(self, asset_id: str, kind: str) -> Asset:
        asset = self.get(asset_id, kind)
        if asset is None:
            known = ", ".join(sorted(a.id for a in self if a.type == kind)) or "(none)"
            raise KeyError(f"{kind} asset '{asset_id}' is not in the manifest; known: {known}")
        return asset

    def install(self, asset_id: str, kind: str, project_dir: Path) -> str:
        """Copy an asset into ``project_dir/assets/<kind>/`` and return its relative path."""
        asset = self.require(asset_id, kind)
        src = asset.path(self.root)
        if not src.exists():
            raise FileNotFoundError(f"asset '{asset_id}' points at missing file {src}")
        rel = Path("assets") / kind / src.name
        dst = project_dir / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        _link_or_copy(src, dst)
        return rel.as_posix()

    def manifest_rows(self) -> list[dict]:
        return [
            {
                "id": a.id,
                "type": a.type,
                "file": a.file,
                "tags": list(a.tags),
                "license": a.license,
                "description": a.description,
            }
            for a in self
        ]


def _link_or_copy(src: Path, dst: Path) -> None:
    if dst.exists() and dst.stat().st_size == src.stat().st_size:
        return
    if dst.exists():
        dst.unlink()
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def copy_source_video(src: Path, project_dir: Path, *, name: str = "source.mp4") -> str:
    """Place the source footage inside the project and return its relative path."""
    rel = Path("assets") / name
    dst = project_dir / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    _link_or_copy(src, dst)
    return rel.as_posix()


def write_manifest(path: Path, assets: Iterable[Mapping]) -> Path:
    payload = {"version": 1, "assets": list(assets)}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path
