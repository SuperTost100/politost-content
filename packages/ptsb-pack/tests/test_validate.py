"""Bundle validation — asset cross-check (BF-16, mirrors BF-11)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ptsb_pack.validate import load_smartbook_config  # noqa: E402


def _write_bundle(
    bundle_dir: Path,
    *,
    chapter_md: str,
    assets: dict[str, bytes] | None = None,
    extras: dict[str, str] | None = None,
    meta: dict | None = None,
) -> None:
    config = {
        "id": "test-book",
        "title": "Test",
        "chapters": [{"file": "ch01.md", "number": 1}],
        **(meta or {}),
    }
    (bundle_dir / "chapters").mkdir(parents=True, exist_ok=True)
    (bundle_dir / "smartbook.json").write_text(json.dumps(config), encoding="utf-8")
    (bundle_dir / "chapters" / "ch01.md").write_text(chapter_md, encoding="utf-8")
    for name, raw in (extras or {}).items():
        (bundle_dir / name).write_text(raw, encoding="utf-8")
    for rel, data in (assets or {}).items():
        path = bundle_dir / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def test_fails_when_chapter_refs_missing_asset(tmp_path: Path) -> None:
    _write_bundle(
        tmp_path,
        chapter_md='## p1 | Intro\n\n:::image{src="assets/foo.png" alt="Fig"}\n:::\n',
    )
    with pytest.raises(ValueError, match=r"ch01\.md: asset mancante: assets/foo\.png"):
        load_smartbook_config(tmp_path)


def test_passes_when_referenced_asset_exists(tmp_path: Path) -> None:
    _write_bundle(
        tmp_path,
        chapter_md='## p1 | Intro\n\n:::image{src="assets/foo.png" alt="Fig"}\n:::\n',
        assets={"assets/foo.png": b"\x89PNG"},
    )
    config = load_smartbook_config(tmp_path)
    assert config["id"] == "test-book"


def test_fails_when_esercizi_refs_missing_asset(tmp_path: Path) -> None:
    _write_bundle(
        tmp_path,
        chapter_md="## p1 | Intro\n\nNo images here.\n",
        extras={
            "esercizi.md": '## Esercizi\n\n:::image{src="assets/missing.png" alt="Fig"}\n:::\n',
        },
    )
    with pytest.raises(ValueError, match=r"esercizi\.md: asset mancante: assets/missing\.png"):
        load_smartbook_config(tmp_path)


def test_cli_validate_exits_one_on_missing_asset(tmp_path: Path) -> None:
    _write_bundle(
        tmp_path,
        chapter_md='## p1 | Intro\n\n:::image{src="assets/foo.png" alt="Fig"}\n:::\n',
    )
    result = subprocess.run(
        [sys.executable, "-m", "ptsb_pack.cli", "validate", str(tmp_path)],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    assert result.returncode == 1
    assert "asset mancante: assets/foo.png" in result.stderr


def test_rejects_markdown_image(tmp_path: Path) -> None:
    _write_bundle(tmp_path, chapter_md="## p1 | Intro\n\n![](assets/missing.png)\n")
    with pytest.raises(ValueError, match=":::image"):
        load_smartbook_config(tmp_path)


def test_rejects_prose_that_only_contains_the_letters(tmp_path: Path) -> None:
    _write_bundle(tmp_path, chapter_md="This mentions ## p but has no header.\n")
    with pytest.raises(ValueError, match="nessun paragrafo"):
        load_smartbook_config(tmp_path)


def test_rejects_chapter_path_escape(tmp_path: Path) -> None:
    _write_bundle(tmp_path, chapter_md="## p1 | Intro\n")
    outside = tmp_path / "outside.md"
    outside.write_text("## p1 | Secret\n", encoding="utf-8")
    config_path = tmp_path / "smartbook.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["chapters"][0]["file"] = "../outside.md"
    config_path.write_text(json.dumps(config), encoding="utf-8")
    with pytest.raises(ValueError, match="non valido"):
        load_smartbook_config(tmp_path)


def test_rejects_orphan_chapter(tmp_path: Path) -> None:
    _write_bundle(tmp_path, chapter_md="## p1 | Intro\n")
    (tmp_path / "chapters" / "orphan.md").write_text("## p1 | Extra\n", encoding="utf-8")
    with pytest.raises(ValueError, match="non elencato"):
        load_smartbook_config(tmp_path)


def test_rejects_bad_grafico_type(tmp_path: Path) -> None:
    _write_bundle(
        tmp_path,
        chapter_md="## p1 | Intro\n",
        extras={"grafici.json": json.dumps([{"id": "g", "title": "G", "type": "not-a-real-type", "config": {}}])},
    )
    with pytest.raises(ValueError, match="type non valido"):
        load_smartbook_config(tmp_path)


def test_pack_writes_access_into_smartbook_json(tmp_path: Path) -> None:
    import io
    import zipfile

    from ptsb_pack.pack import pack_plain

    bundle = tmp_path / "bundle"
    _write_bundle(bundle, chapter_md="## p1 | Intro\n")
    source = json.loads((bundle / "smartbook.json").read_text(encoding="utf-8"))
    assert "access" not in source
    blob = pack_plain(bundle, access="licensed")
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        packed = json.loads(zf.read("smartbook.json"))
        manifest = json.loads(zf.read("ptsb.json"))
    assert packed["access"] == "licensed"
    assert manifest["access"] == "licensed"
    assert "access" not in json.loads((bundle / "smartbook.json").read_text(encoding="utf-8"))


def test_accepts_book_metadata(tmp_path: Path) -> None:
    meta = {"authors": ["Ada Rossi"], "version": "1.2.0", "specVersion": "1.1"}
    _write_bundle(tmp_path, chapter_md="## p1 | Intro\n\nTesto.\n", meta=meta)
    assert load_smartbook_config(tmp_path)["authors"] == ["Ada Rossi"]


@pytest.mark.parametrize(
    ("meta", "pattern"),
    [
        ({"authors": "Ada Rossi"}, "authors deve essere una lista"),
        ({"authors": ["Ada", " "]}, "ogni voce di authors"),
        ({"version": 2}, "version deve essere"),
        ({"specVersion": "1"}, "specVersion deve avere"),
    ],
)
def test_rejects_bad_book_metadata(tmp_path: Path, meta: dict, pattern: str) -> None:
    _write_bundle(tmp_path, chapter_md="## p1 | Intro\n\nTesto.\n", meta=meta)
    with pytest.raises(ValueError, match=pattern):
        load_smartbook_config(tmp_path)


@pytest.mark.parametrize("leak", ["</markdown>", "</invoke>", '<parameter name="content">', "</function_calls>"])
def test_rejects_leftover_generator_markup(tmp_path: Path, leak: str) -> None:
    _write_bundle(tmp_path, chapter_md=f"## p1 | Intro\n\nTesto.\n{leak}\n")
    with pytest.raises(ValueError, match=r"ch01\.md, riga 4: markup del generatore"):
        load_smartbook_config(tmp_path)


def test_rejects_generator_markup_in_esami(tmp_path: Path) -> None:
    _write_bundle(tmp_path, chapter_md="## p1 | Intro\n\nTesto.\n", extras={"esami.md": "---\ntype: esami\n---\n</invoke>\n"})
    with pytest.raises(ValueError, match=r"esami\.md, riga 4"):
        load_smartbook_config(tmp_path)


def test_allows_angle_brackets_in_prose_and_math(tmp_path: Path) -> None:
    _write_bundle(tmp_path, chapter_md="## p1 | Intro\n\nSe $a<b$ e $c>d$, il <markdown-it> parser non conta: <parameters>.\n")
    load_smartbook_config(tmp_path)
