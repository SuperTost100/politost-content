"""Tests for per-book CEK wrap isolation."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ptsb_pack.crypto import unwrap_cek, wrap_cek  # noqa: E402


@pytest.fixture
def master_secret() -> str:
    return "test-master-secret-for-unit-tests"


def test_per_book_wrap_keys_are_isolated(master_secret: str) -> None:
    cek = os.urandom(32)
    wrap_iv_a, wrapped_a = wrap_cek(master_secret, cek, "book-a")
    wrap_iv_b, wrapped_b = wrap_cek(master_secret, cek, "book-b")

    import base64

    iv_a = base64.b64decode(wrap_iv_a)
    iv_b = base64.b64decode(wrap_iv_b)
    key_a = base64.b64decode(wrapped_a)
    key_b = base64.b64decode(wrapped_b)

    assert unwrap_cek(master_secret, iv_a, key_a, "book-a") == cek
    assert unwrap_cek(master_secret, iv_b, key_b, "book-b") == cek

    with pytest.raises(Exception):
        unwrap_cek(master_secret, iv_a, key_a, "book-b")

    with pytest.raises(Exception):
        unwrap_cek(master_secret, iv_b, key_b, "book-a")
