"""Validate smartbook bundle directories."""

from __future__ import annotations

import json
import re
from pathlib import Path

ID_RE = re.compile(r"^[a-z0-9-]+$")
SKIP_FILES = {"LOADER_SNIPPET.txt", "ptsb.json"}
OPTIONAL_FILES = {"esercizi.md", "esami.md", "ide.json", "grafici.json"}
PARA_HEADER = re.compile(r"^## p\d+ \| ", re.M)
MD_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
IMAGE_BLOCK = re.compile(r":::image\{([^}]+)\}")
IMAGE_SRC = re.compile(r'src="([^"]+)"')
GRAFICO_TYPES = {"function", "plotly"}
IDE_FIELDS = ("id", "title", "language", "code")


def _inside(root: Path, path: Path, label: str) -> Path:
    if path.is_symlink():
        raise ValueError(f"symlink non consentito: {label}")
    resolved = path.resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError(f"percorso fuori dal bundle: {label}")
    return resolved


def _chapter_file(chapters_dir: Path, fname: str) -> Path:
    rel = Path(fname)
    if rel.is_absolute() or ".." in rel.parts:
        raise ValueError(f"File capitolo non valido: {fname}")
    path = chapters_dir / rel
    resolved = _inside(chapters_dir, path, f"chapters/{fname}")
    if not resolved.is_file():
        raise ValueError(f"File capitolo mancante: chapters/{fname}")
    return resolved


def _check_json_extra(name: str, data: object) -> None:
    if name == "grafici.json":
        if not isinstance(data, list):
            raise ValueError("grafici.json deve essere una lista")
        for i, item in enumerate(data):
            if not isinstance(item, dict) or item.get("type") not in GRAFICO_TYPES:
                raise ValueError(f"grafici.json[{i}]: type non valido")
        return
    if name == "ide.json":
        if not isinstance(data, list):
            raise ValueError("ide.json deve essere una lista")
        for i, item in enumerate(data):
            if not isinstance(item, dict) or any(not item.get(field) for field in IDE_FIELDS):
                raise ValueError(f"ide.json[{i}]: snippet non valido")


def _markdown_files(bundle_dir: Path, chapters: list[dict]) -> list[Path]:
    files: list[Path] = []
    chapters_dir = bundle_dir / "chapters"
    for ch in chapters:
        files.append(_chapter_file(chapters_dir, ch["file"]))
    for opt in ("esercizi.md", "esami.md"):
        path = bundle_dir / opt
        if path.exists():
            files.append(_inside(bundle_dir, path, opt))
    return files


def _required_assets(bundle_dir: Path, md_files: list[Path]) -> list[str]:
    required: list[str] = []
    assets_dir = bundle_dir / "assets"
    available: set[str] = set()
    if assets_dir.is_dir():
        for path in assets_dir.rglob("*"):
            if not path.is_file():
                continue
            resolved = _inside(bundle_dir, path, path.name)
            available.add(f"assets/{resolved.relative_to(assets_dir.resolve()).as_posix()}")

    for md in md_files:
        raw = md.read_text(encoding="utf-8")
        if MD_IMAGE.search(raw):
            raise ValueError(f"{md.name}: usa un blocco :::image al posto di ![]()")
        for match in IMAGE_BLOCK.finditer(raw):
            src = IMAGE_SRC.search(match.group(1))
            if not src:
                raise ValueError(f"{md.name}: blocco :::image senza src")
            path = src.group(1)
            if not path.startswith("assets/") or ".." in path:
                raise ValueError(f"{md.name}: percorso immagine non valido: {path}")
            if path not in available:
                raise ValueError(f"{md.name}: asset mancante: {path}")
            if path not in required:
                required.append(path)
    return required


def load_smartbook_config(bundle_dir: Path) -> dict:
    path = _inside(bundle_dir, bundle_dir / "smartbook.json", "smartbook.json")
    if not path.is_file():
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
    named: set[str] = set()
    for ch in chapters:
        fname = ch.get("file")
        if not fname:
            raise ValueError("Capitolo senza campo file")
        named.add(Path(fname).as_posix())
        raw = _chapter_file(chapters_dir, fname).read_text(encoding="utf-8")
        if not PARA_HEADER.search(raw):
            raise ValueError(f"Capitolo {fname}: nessun paragrafo (## pN | titolo)")
    for md in chapters_dir.rglob("*.md"):
        if md.is_symlink():
            raise ValueError(f"symlink non consentito: {md.name}")
        rel = md.resolve().relative_to(chapters_dir.resolve()).as_posix()
        if rel not in named:
            raise ValueError(f"Capitolo non elencato in smartbook.json: {rel}")
    for opt in OPTIONAL_FILES:
        p = bundle_dir / opt
        if not p.exists():
            continue
        _inside(bundle_dir, p, opt)
        if opt.endswith(".json"):
            data = json.loads(p.read_text(encoding="utf-8"))
            _check_json_extra(opt, data)
    _required_assets(bundle_dir, _markdown_files(bundle_dir, chapters))
    return config


def allowed_bundle_files(bundle_dir: Path) -> list[str]:
    config = load_smartbook_config(bundle_dir)
    files = ["smartbook.json"]
    for ch in config["chapters"]:
        files.append(f"chapters/{Path(ch['file']).as_posix()}")
    for opt in sorted(OPTIONAL_FILES):
        if (bundle_dir / opt).is_file():
            files.append(opt)
    chapters = config["chapters"]
    files.extend(_required_assets(bundle_dir, _markdown_files(bundle_dir, chapters)))
    return files


def list_bundle_files(bundle_dir: Path) -> list[str]:
    files: list[str] = []
    root = bundle_dir.resolve()
    for path in sorted(bundle_dir.rglob("*")):
        if not path.is_file() or path.name in SKIP_FILES:
            continue
        if path.is_symlink():
            raise ValueError(f"symlink non consentito: {path.name}")
        resolved = path.resolve()
        if not resolved.is_relative_to(root):
            raise ValueError(f"percorso fuori dal bundle: {path.name}")
        files.append(str(resolved.relative_to(root)).replace("\\", "/"))
    return files
