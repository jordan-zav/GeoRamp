"""Build a reproducible QGIS plugin ZIP from the source directory."""

from __future__ import annotations

import configparser
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
PLUGIN_NAME = "georamp"
PLUGIN_DIR = ROOT / PLUGIN_NAME


def plugin_version() -> str:
    metadata = configparser.ConfigParser(interpolation=None)
    metadata.read(PLUGIN_DIR / "metadata.txt", encoding="utf-8")
    return metadata["general"]["version"]


def build_archive() -> Path:
    output_dir = ROOT / "dist"
    output_dir.mkdir(exist_ok=True)
    archive = output_dir / f"{PLUGIN_NAME}-{plugin_version()}.zip"

    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
        for source in sorted(PLUGIN_DIR.rglob("*")):
            if not source.is_file():
                continue
            if "__pycache__" in source.parts or source.suffix in {".pyc", ".pyo"}:
                continue
            bundle.write(source, Path(PLUGIN_NAME) / source.relative_to(PLUGIN_DIR))
        for relative_name in ("LICENSE", "CHANGELOG.md"):
            bundle.write(ROOT / relative_name, Path(PLUGIN_NAME) / relative_name)

    return archive


if __name__ == "__main__":
    print(build_archive())
