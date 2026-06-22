"""Pack smartbook directories into .ptsb files."""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from ptsb_pack.crypto import build_encrypted_container
from ptsb_pack.validate import SKIP_FILES, load_smartbook_config

Access = Literal["public", "licensed"]


def _collect_files(bundle_dir: Path) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for path in sorted(bundle_dir.rglob("*")):
        if not path.is_file() or path.name in SKIP_FILES:
            continue
        rel = str(path.relative_to(bundle_dir)).replace("\\", "/")
        files[rel] = path.read_bytes()
    return files


def build_inner_zip(bundle_dir: Path, *, access: Access) -> bytes:
    config = load_smartbook_config(bundle_dir)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        ptsb_manifest = {
            "formatVersion": 1,
            "packageType": "smartbook",
            "encrypted": False,
            "access": access,
            "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": "ptsb-pack/1.0",
        }
        zf.writestr("ptsb.json", json.dumps(ptsb_manifest, indent=2))
        for rel, data in _collect_files(bundle_dir).items():
            if rel == "ptsb.json":
                continue
            zf.writestr(rel, data)
    return buf.getvalue()


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
