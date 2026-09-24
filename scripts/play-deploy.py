#!/usr/bin/env python3
"""Upload an AAB to Google Play from the command line.

Everything after the first release can be done without opening the console:
this creates an edit, uploads the bundle, assigns it to a track, writes the
release notes and commits. Google requires the *first* upload of an app to go
through the console UI; after that this script owns the loop.

Usage (from the repo root):

    uv run --with google-auth --with requests scripts/play-deploy.py \\
        --aab dist/android/premind-1.0.0-release.aab \\
        --track internal \\
        --notes "첫 내부 테스트 빌드"

Credentials: a Play Console service account JSON, passed with --key or in
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON. See docs/release-checklist.md for how to
create one; it needs the "릴리스 관리자" role on this app in Play Console.

Nothing here is destructive on its own: an edit that is never committed simply
expires, so --dry-run stops before the commit and leaves Play untouched.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

API = "https://androidpublisher.googleapis.com/androidpublisher/v3"
UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"
DEFAULT_PACKAGE = "kr.co.premind.premind"
TRACKS = ("internal", "alpha", "beta", "production")


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def authorised_session(key_path: Path):
    try:
        import google.auth.transport.requests
        from google.oauth2 import service_account
    except ImportError:
        fail(
            "google-auth is not installed. Run this through:\n"
            "  uv run --with google-auth --with requests scripts/play-deploy.py ..."
        )
    try:
        import requests
    except ImportError:
        fail("requests is not installed. See the command above.")

    credentials = service_account.Credentials.from_service_account_file(
        str(key_path), scopes=[SCOPE]
    )
    credentials.refresh(google.auth.transport.requests.Request())
    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {credentials.token}"
    return session


def check(response, what: str):
    if response.status_code >= 400:
        # Play's errors are specific and worth showing verbatim; the usual one
        # is "APK specifies a version code that has already been used".
        fail(f"{what} failed ({response.status_code}): {response.text[:600]}")
    return response.json() if response.content else {}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aab", required=True, type=Path, help="the .aab to upload")
    parser.add_argument("--track", default="internal", choices=TRACKS)
    parser.add_argument("--package", default=DEFAULT_PACKAGE)
    parser.add_argument("--notes", default="", help="release notes, Korean")
    parser.add_argument(
        "--key",
        type=Path,
        default=os.environ.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"),
        help="service account JSON (or GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)",
    )
    parser.add_argument(
        "--status",
        default="draft",
        choices=("draft", "completed"),
        help="draft leaves the release for you to review and roll out in the console",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="upload and assign, but do not commit the edit",
    )
    args = parser.parse_args()

    if not args.aab.is_file():
        fail(f"no such bundle: {args.aab}")
    if not args.key:
        fail(
            "no service account key. Pass --key or set "
            "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON. docs/release-checklist.md says how "
            "to create one."
        )
    key_path = Path(args.key)
    if not key_path.is_file():
        fail(f"no such key file: {key_path}")

    session = authorised_session(key_path)
    base = f"{API}/applications/{args.package}/edits"

    edit = check(session.post(base), "creating the edit")
    edit_id = edit["id"]
    print(f"edit {edit_id} opened for {args.package}")

    with args.aab.open("rb") as bundle:
        uploaded = check(
            session.post(
                f"{UPLOAD}/applications/{args.package}/edits/{edit_id}/bundles",
                params={"uploadType": "media"},
                headers={"Content-Type": "application/octet-stream"},
                data=bundle,
            ),
            "uploading the bundle",
        )
    version_code = uploaded["versionCode"]
    print(f"uploaded {args.aab.name} as versionCode {version_code}")

    release = {
        "name": f"{args.aab.stem}",
        "versionCodes": [str(version_code)],
        "status": args.status,
    }
    if args.notes:
        release["releaseNotes"] = [{"language": "ko-KR", "text": args.notes}]
    check(
        session.put(
            f"{base}/{edit_id}/tracks/{args.track}",
            json={"track": args.track, "releases": [release]},
        ),
        f"assigning to the {args.track} track",
    )
    print(f"assigned to {args.track} as {args.status}")

    if args.dry_run:
        session.delete(f"{base}/{edit_id}")
        print("dry run: edit discarded, Play is unchanged")
        return

    committed = check(session.post(f"{base}/{edit_id}:commit"), "committing the edit")
    print(f"committed: {json.dumps(committed, ensure_ascii=False)}")
    print(
        "done. A draft release still needs to be rolled out in the console; "
        "--status completed rolls it out immediately."
    )


if __name__ == "__main__":
    main()
