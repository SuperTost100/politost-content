"""Inspect .ptsb files."""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path
from typing import Any

from ptsb_pack.crypto import MAGIC, parse_encrypted_container


def inspect_file(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if data[:2] == b"PK":
        return _inspect_plain_zip(data)
    if data[:4] == MAGIC:
        return _inspect_encrypted(data)
    raise ValueError("Formato .ptsb non riconosciuto")


def _inspect_plain_zip(data: bytes) -> dict[str, Any]:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        names = zf.namelist()
        ptsb = {}
        if "ptsb.json" in names:
            ptsb = json.loads(zf.read("ptsb.json"))
        smartbook = {}
        if "smartbook.json" in names:
            smartbook = json.loads(zf.read("smartbook.json"))
        return {
            "type": "plain_zip",
            "encrypted": False,
            "access": ptsb.get("access", smartbook.get("access", "public")),
            "id": smartbook.get("id"),
            "title": smartbook.get("title"),
            "files": names,
        }


def _inspect_encrypted(data: bytes) -> dict[str, Any]:
    header, _, _ = parse_encrypted_container(data)
    return {
        "type": "encrypted",
        "encrypted": True,
        "access": header.get("access", "licensed"),
        "id": header.get("id"),
        "title": header.get("title"),
        "subject": header.get("subject"),
        "hasWrappedKey": bool(header.get("wrappedKey")),
    }
