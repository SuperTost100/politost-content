"""Validate smartbook bundle directories."""

from __future__ import annotations

import json
import re
from pathlib import Path

ID_RE = re.compile(r"^[a-z0-9-]+$")
SKIP_FILES = {"LOADER_SNIPPET.txt", "ptsb.json"}
OPTIONAL_FILES = {"esercizi.md", "esami.md", "ide.json", "grafici.json"}


IMAGE_BLOCK = re.compile(r':::image\{([^}]+)\}')
IMAGE_SRC = re.compile(r'src="([^"]+)"')
EXTERNAL_IMAGE = re.compile(r'!\[[^\]]*\]\((?:https?:|data:|//)')


def _validate_image_assets(bundle_dir: Path) -> None:
    assets_dir = bundle_dir / "assets"
    available = set()
    if assets_dir.is_dir():
        for path in assets_dir.rglob("*"):
            if path.is_file():
                available.add(f"assets/{path.relative_to(assets_dir).as_posix()}")

    md_files = list((bundle_dir / "chapters").glob("*.md"))
    for opt in ("esercizi.md", "esami.md"):
        p = bundle_dir / opt
        if p.exists():
            md_files.append(p)

    for md in md_files:
        raw = md.read_text(encoding="utf-8")
        if EXTERNAL_IMAGE.search(raw):
            raise ValueError(f"{md.name}: immagini con URL esterni non consentite")
        for match in IMAGE_BLOCK.finditer(raw):
            src = IMAGE_SRC.search(match.group(1))
            if not src:
                raise ValueError(f"{md.name}: blocco :::image senza src")
            path = src.group(1)
            if not path.startswith("assets/") or ".." in path:
                raise ValueError(f"{md.name}: percorso immagine non valido: {path}")
            if path not in available:
                raise ValueError(f"{md.name}: asset mancante: {path}")


def load_smartbook_config(bundle_dir: Path) -> dict:
    path = bundle_dir / "smartbook.json"
    if not path.exists():
        raise ValueError("smartbook.json mancante")
    config = json.loads(path.read_text(encoding="utf-8"))
    book_id = config.get("id", "")
    if not ID_RE.match(book_id):
        raise ValueError(f"id smartbook non valido: {book_id!r}")
    chapters = config.get("chapters", [])
    if not chapters:
        raise ValueError("Nessun capitolo in smartbook.json")
    chapters_dir = bundle_dir / "chapters"
    if not chapters_dir.is_dir():
        raise ValueError("Cartella chapters/ mancante")
    for ch in chapters:
        fname = ch.get("file")
        if not fname:
            raise ValueError("Capitolo senza campo file")
        ch_path = chapters_dir / fname
        if not ch_path.exists():
            raise ValueError(f"File capitolo mancante: chapters/{fname}")
        raw = ch_path.read_text(encoding="utf-8")
        if "## p" not in raw:
            raise ValueError(f"Capitolo {fname}: nessun paragrafo (## pN | titolo)")
    for opt in OPTIONAL_FILES:
        p = bundle_dir / opt
        if p.exists() and opt.endswith(".json"):
            json.loads(p.read_text(encoding="utf-8"))
    _validate_image_assets(bundle_dir)
    return config


def list_bundle_files(bundle_dir: Path) -> list[str]:
    files: list[str] = []
    for path in sorted(bundle_dir.rglob("*")):
        if path.is_file() and path.name not in SKIP_FILES:
            files.append(str(path.relative_to(bundle_dir)).replace("\\", "/"))
    return files
