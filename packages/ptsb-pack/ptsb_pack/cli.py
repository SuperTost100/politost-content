"""CLI entry point."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from ptsb_pack.inspect import inspect_file
from ptsb_pack.pack import pack_to_file
from ptsb_pack.validate import load_smartbook_config


def main() -> None:
    parser = argparse.ArgumentParser(prog="ptsb-pack", description="Impacchetta Smartbook in .ptsb")
    sub = parser.add_subparsers(dest="command", required=True)

    p_val = sub.add_parser("validate", help="Valida cartella output")
    p_val.add_argument("dir", type=Path)

    p_pack = sub.add_parser("pack", help="Crea file .ptsb")
    p_pack.add_argument("dir", type=Path)
    p_pack.add_argument("--out", "-o", type=Path, required=True)
    p_pack.add_argument("--encrypt", action="store_true")
    p_pack.add_argument("--access", choices=["public", "licensed"], default="public")
    p_pack.add_argument(
        "--master-secret",
        default=None,
        help="Secret DRM (o @env:PTSB_MASTER_SECRET)",
    )

    p_ins = sub.add_parser("inspect", help="Ispeziona .ptsb")
    p_ins.add_argument("file", type=Path)

    args = parser.parse_args()

    try:
        if args.command == "validate":
            config = load_smartbook_config(args.dir)
            print(json.dumps({"valid": True, "id": config["id"], "title": config.get("title")}, indent=2))
        elif args.command == "pack":
            secret = args.master_secret
            if secret and secret.startswith("@env:"):
                secret = os.environ.get(secret[5:], "")
            if args.encrypt and not secret:
                secret = os.environ.get("PTSB_MASTER_SECRET", "")
            access = "licensed" if args.encrypt else args.access
            pack_to_file(
                args.dir,
                args.out,
                encrypt=args.encrypt,
                master_secret=secret,
                access=access,
            )
            print(f"Creato {args.out}")
        elif args.command == "inspect":
            print(json.dumps(inspect_file(args.file), indent=2, ensure_ascii=False))
    except (ValueError, OSError) as e:
        print(f"Errore: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
