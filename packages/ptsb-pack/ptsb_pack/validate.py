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
SPEC_VERSION_RE = re.compile(r"^\d+\.\d+$")
# Asset and archive limits enforced by content-core when it opens a package
# (assetResolver.ts and PTSB_ZIP_LIMITS in ptsb.ts). Packing a book over them
# gives a file the reader refuses.
ASSET_PATH_RE = re.compile(r"^assets/[a-zA-Z0-9._/-]+$")
ASSET_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
MAX_ASSET_BYTES = 2 * 1024 * 1024
MAX_BOOK_ASSETS_BYTES = 20 * 1024 * 1024
# Same pattern as TOOL_MARKUP in content-core's validateChapter.ts.
TOOL_MARKUP = re.compile(
    r"</?(?:markdown|invoke|parameter|function_calls|antml:[\w-]+|tool_use|tool_result)(?=[\s/>])[^>]*>", re.I
)


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


def _check_chapters(chapters: object) -> None:
    """Same rules as validateBundle in content-core: one entry per file and number."""
    if not isinstance(chapters, list) or not chapters:
        raise ValueError("Nessun capitolo in smartbook.json")
    seen: dict[str, set[str]] = {"id": set(), "number": set(), "file": set()}
    for i, ch in enumerate(chapters):
        if not isinstance(ch, dict):
            raise ValueError(f"smartbook.json: chapters[{i}] non è un oggetto")
        if not isinstance(ch.get("file"), str) or not ch["file"]:
            raise ValueError("Capitolo senza campo file")
        number = ch.get("number")
        # JSON 1.0 is an integer for content-core (Number.isInteger), so accept it here too.
        if isinstance(number, bool) or not isinstance(number, (int, float)) or number != int(number) or number < 1:
            raise ValueError(f"smartbook.json: chapters[{i}].number deve essere un intero positivo, trovato {number!r}")
        for key in ("id", "number", "file"):
            if key not in ch:
                continue
            value = int(ch[key]) if key == "number" else ch[key]
            seen_key = json.dumps(value, sort_keys=True)
            if seen_key in seen[key]:
                raise ValueError(f"smartbook.json: {key} ripetuto in chapters: {value}")
            seen[key].add(seen_key)


def _check_asset(path: str, size: int) -> None:
    if not ASSET_PATH_RE.match(path) or ".." in path:
        raise ValueError(f"percorso immagine non valido: {path}")
    if Path(path).suffix.lower() not in ASSET_EXTENSIONS:
        raise ValueError(f"formato immagine non ammesso: {path} (usa {', '.join(sorted(ASSET_EXTENSIONS))})")
    if size > MAX_ASSET_BYTES:
        raise ValueError(f"{path}: immagine troppo grande ({size} byte, max {MAX_ASSET_BYTES})")


def _check_book_meta(config: dict) -> None:
    """Optional metadata from content format 1.1. Same rules as validateBookMeta in content-core."""
    if "authors" in config:
        authors = config["authors"]
        if not isinstance(authors, list) or not authors:
            raise ValueError("smartbook.json: authors deve essere una lista non vuota di nomi")
        if any(not isinstance(a, str) or not a.strip() for a in authors):
            raise ValueError("smartbook.json: ogni voce di authors deve essere un nome non vuoto")
    if "version" in config:
        version = config["version"]
        if not isinstance(version, str) or not version.strip():
            raise ValueError("smartbook.json: version deve essere una stringa non vuota")
    if "specVersion" in config:
        spec = config["specVersion"]
        if not isinstance(spec, str) or not SPEC_VERSION_RE.match(spec):
            raise ValueError('smartbook.json: specVersion deve avere la forma MAJOR.MINOR, es. "1.1"')


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
    available: dict[str, int] = {}
    if assets_dir.is_dir():
        for path in assets_dir.rglob("*"):
            if not path.is_file():
                continue
            resolved = _inside(bundle_dir, path, path.name)
            available[f"assets/{resolved.relative_to(assets_dir.resolve()).as_posix()}"] = resolved.stat().st_size

    for md in md_files:
        raw = md.read_text(encoding="utf-8")
        for line_no, line in enumerate(raw.split("\n"), 1):
            leak = TOOL_MARKUP.search(line)
            if leak:
                raise ValueError(f"{md.name}, riga {line_no}: markup del generatore non rimosso {leak.group(0)!r}")
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
            _check_asset(path, available[path])
            if path not in required:
                required.append(path)
    total = sum(available[path] for path in required)
    if total > MAX_BOOK_ASSETS_BYTES:
        raise ValueError(f"Totale immagini troppo grande ({total} byte, max {MAX_BOOK_ASSETS_BYTES})")
    return required


def load_smartbook_config(bundle_dir: Path) -> dict:
    path = _inside(bundle_dir, bundle_dir / "smartbook.json", "smartbook.json")
    if not path.is_file():
        raise ValueError("smartbook.json mancante")
    config = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(config, dict):
        raise ValueError("smartbook.json: atteso un oggetto JSON")
    book_id = config.get("id", "")
    if not isinstance(book_id, str) or not ID_RE.match(book_id):
        raise ValueError(f"id smartbook non valido: {book_id!r}")
    chapters = config.get("chapters", [])
    _check_chapters(chapters)
    _check_book_meta(config)
    chapters_dir = bundle_dir / "chapters"
    if not chapters_dir.is_dir():
        raise ValueError("Cartella chapters/ mancante")
    named: set[str] = set()
    for ch in chapters:
        fname = ch["file"]
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
