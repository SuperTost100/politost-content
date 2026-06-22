"""AES-GCM crypto for .ptsb encrypted containers."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import struct
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"PTSB"
FORMAT_VERSION = 1
FLAG_ENCRYPTED = 0x01
WRAP_SALT = b"politost-ptsb-wrap-v1"


def derive_master_key(secret: str) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", secret.encode("utf-8"), WRAP_SALT, 100_000, dklen=32)


def derive_book_wrap_key(master_secret: str, book_id: str) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256",
        master_secret.encode("utf-8"),
        f"politost-ptsb-wrap-v1:{book_id}".encode(),
        100_000,
        dklen=32,
    )


def wrap_cek(master_secret: str, cek: bytes, book_id: str) -> tuple[str, str]:
    key = derive_book_wrap_key(master_secret, book_id)
    wrap_iv = os.urandom(12)
    wrapped = AESGCM(key).encrypt(wrap_iv, cek, None)
    return base64.b64encode(wrap_iv).decode("ascii"), base64.b64encode(wrapped).decode("ascii")


def unwrap_cek(master_secret: str, wrap_iv: bytes, wrapped: bytes, book_id: str) -> bytes:
    key = derive_book_wrap_key(master_secret, book_id)
    return AESGCM(key).decrypt(wrap_iv, wrapped, None)


def encrypt_zip(zip_bytes: bytes, cek: bytes, iv_b64: str | None = None) -> tuple[bytes, str]:
    iv = base64.b64decode(iv_b64) if iv_b64 else os.urandom(12)
    ciphertext = AESGCM(cek).encrypt(iv, zip_bytes, None)
    return ciphertext, base64.b64encode(iv).decode("ascii")


def decrypt_zip(ciphertext: bytes, cek: bytes, iv_b64: str) -> bytes:
    iv = base64.b64decode(iv_b64)
    return AESGCM(cek).decrypt(iv, ciphertext, None)


def build_encrypted_container(
    zip_bytes: bytes,
    *,
    header: dict[str, Any],
    master_secret: str,
) -> bytes:
    cek = os.urandom(32)
    ciphertext, iv_b64 = encrypt_zip(zip_bytes, cek)
    book_id = header.get("id")
    if not book_id or not isinstance(book_id, str):
        raise ValueError("Header PTSB richiede campo id per la cifratura CEK")
    wrap_iv_b64, wrapped_key_b64 = wrap_cek(master_secret, cek, book_id)
    header = {
        **header,
        "iv": iv_b64,
        "wrapIv": wrap_iv_b64,
        "wrappedKey": wrapped_key_b64,
        "encrypted": True,
    }
    header_json = json.dumps(header, ensure_ascii=False).encode("utf-8")
    if len(header_json) > 65535:
        raise ValueError("Header JSON troppo grande")
    flags = FLAG_ENCRYPTED
    if header.get("access") == "licensed":
        flags |= 0x02
    return (
        MAGIC
        + struct.pack(">BBH", FORMAT_VERSION, flags, len(header_json))
        + header_json
        + ciphertext
    )


def parse_encrypted_container(data: bytes) -> tuple[dict[str, Any], bytes]:
    if len(data) < 8 or data[:4] != MAGIC:
        raise ValueError("File PTSB non valido")
    version, flags, header_len = struct.unpack(">BBH", data[4:8])
    if version != FORMAT_VERSION:
        raise ValueError(f"Versione PTSB non supportata: {version}")
    if not (flags & FLAG_ENCRYPTED):
        raise ValueError("Container non cifrato")
    header_end = 8 + header_len
    header = json.loads(data[8:header_end].decode("utf-8"))
    return header, data[header_end:]


def unwrap_and_decrypt(data: bytes, master_secret: str) -> bytes:
    header, ciphertext = parse_encrypted_container(data)
    wrap_iv_b64 = header.get("wrapIv")
    wrapped_key_b64 = header.get("wrappedKey")
    iv = header.get("iv")
    if not wrap_iv_b64 or not wrapped_key_b64 or not iv:
        raise ValueError("Header PTSB incompleto")
    wrap_iv = base64.b64decode(wrap_iv_b64)
    wrapped = base64.b64decode(wrapped_key_b64)
    book_id = header.get("id")
    if not book_id or not isinstance(book_id, str):
        raise ValueError("Header PTSB richiede campo id")
    cek = unwrap_cek(master_secret, wrap_iv, wrapped, book_id)
    return decrypt_zip(ciphertext, cek, iv)
