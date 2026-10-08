"""Pack smartbook directories into .ptsb files."""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from ptsb_pack import __version__
from ptsb_pack.crypto import build_encrypted_container
from ptsb_pack.validate import allowed_bundle_files, load_smartbook_config

Access = Literal["public", "licensed"]

# content-core's PTSB_ZIP_LIMITS: the reader refuses archives over these.
MAX_ZIP_FILES = 200
MAX_ZIP_FILE_BYTES = 5 * 1024 * 1024
MAX_ZIP_BYTES = 50 * 1024 * 1024
TEXT_SUFFIXES = (".md", ".json")


def _read_member(bundle_dir: Path, rel: str) -> bytes:
    path = bundle_dir / rel
    if path.is_symlink():
        raise ValueError(f"symlink non consentito: {rel}")
    resolved = path.resolve()
    root = bundle_dir.resolve()
    if not resolved.is_relative_to(root):
        raise ValueError(f"percorso fuori dal bundle: {rel}")
    data = resolved.read_bytes()
    if rel.endswith(TEXT_SUFFIXES):
        # LF only, like the files the reader's own tools write.
        data = data.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")
    if len(data) > MAX_ZIP_FILE_BYTES:
        raise ValueError(f"{rel}: file troppo grande ({len(data)} byte, max {MAX_ZIP_FILE_BYTES})")
    return data


def build_inner_zip(bundle_dir: Path, *, access: Access) -> bytes:
    config = load_smartbook_config(bundle_dir)
    packed_config = {**config, "access": access}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        ptsb_manifest = {
            "formatVersion": 1,
            "packageType": "smartbook",
            "encrypted": False,
            "access": access,
            "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": f"ptsb-pack/{__version__}",
        }
        zf.writestr("ptsb.json", json.dumps(ptsb_manifest, indent=2))
        zf.writestr("smartbook.json", json.dumps(packed_config, ensure_ascii=False, indent=2))
        files = allowed_bundle_files(bundle_dir)
        # ptsb.json and smartbook.json are written above; smartbook.json is also in files.
        if len(files) + 1 > MAX_ZIP_FILES:
            raise ValueError(f"Troppi file nel pacchetto ({len(files) + 1}, max {MAX_ZIP_FILES})")
        for rel in files:
            if rel == "smartbook.json":
                continue
            zf.writestr(rel, _read_member(bundle_dir, rel))
    data = buf.getvalue()
    if len(data) > MAX_ZIP_BYTES:
        raise ValueError(f"Pacchetto troppo grande ({len(data)} byte, max {MAX_ZIP_BYTES})")
    return data


def pack_plain(bundle_dir: Path, *, access: Access = "public") -> bytes:
    load_smartbook_config(bundle_dir)
    return build_inner_zip(bundle_dir, access=access)


def pack_encrypted(
    bundle_dir: Path,
    *,
    master_secret: str,
    access: Access = "licensed",
) -> bytes:
    if not master_secret:
        raise ValueError("master_secret richiesto per pacchetti cifrati")
    config = load_smartbook_config(bundle_dir)
    zip_bytes = build_inner_zip(bundle_dir, access=access)
    header = {
        "id": config["id"],
        "title": config.get("title", config["id"]),
        "subject": config.get("subject", ""),
        "access": access,
    }
    return build_encrypted_container(zip_bytes, header=header, master_secret=master_secret)


def pack_to_file(
    bundle_dir: Path,
    out_path: Path,
    *,
    encrypt: bool = False,
    master_secret: str | None = None,
    access: Access = "public",
) -> Path:
    if encrypt:
        data = pack_encrypted(bundle_dir, master_secret=master_secret or "", access=access)
    else:
        data = pack_plain(bundle_dir, access=access)
    out_path.write_bytes(data)
    return out_path
