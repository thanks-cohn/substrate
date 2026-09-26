#!/usr/bin/env python3
"""Prepare the small Sketch Town runtime subset from the tracked Kenney ZIP."""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import sys
import zipfile


ASSET_MAPPING = {
    "grass.png": "Tiles/grass_center_N.png",
    "path.png": "Tiles/grass_pathCrossing_N.png",
    "building.png": "Tiles/building_doorWindowsBeige_N.png",
    "tree.png": "Tiles/tree_single_N.png",
    "trees.png": "Tiles/tree_multiple_N.png",
}
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARCHIVE = ROOT / "assets/worlds/sketch-town/kenney_sketchTown.zip"
DEFAULT_OUTPUT = ROOT / "src/assets/worlds/sketch-town"


def prepare(archive: Path, output: Path) -> list[Path]:
    if not archive.is_file():
        raise FileNotFoundError(f"Sketch Town archive is missing: {archive}")
    try:
        source = zipfile.ZipFile(archive)
    except zipfile.BadZipFile as error:
        raise RuntimeError(f"Sketch Town archive is corrupt: {archive}") from error

    generated: list[Path] = []
    with source:
        available = set(source.namelist())
        missing = [entry for entry in ASSET_MAPPING.values() if entry not in available]
        if missing:
            raise RuntimeError("Sketch Town archive lacks required assets: " + ", ".join(missing))
        output.mkdir(parents=True, exist_ok=True)
        for runtime_name, archive_entry in ASSET_MAPPING.items():
            destination = output / runtime_name
            temporary = destination.with_suffix(".png.tmp")
            with source.open(archive_entry) as source_file, temporary.open("wb") as target:
                shutil.copyfileobj(source_file, target)
            if temporary.read_bytes()[:8] != PNG_SIGNATURE:
                temporary.unlink(missing_ok=True)
                raise RuntimeError(f"Required asset is not a PNG: {archive_entry}")
            temporary.replace(destination)
            generated.append(destination)
    return generated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    try:
        generated = prepare(args.archive.resolve(), args.output.resolve())
    except (OSError, RuntimeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    for path in generated:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
