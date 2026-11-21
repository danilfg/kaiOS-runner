#!/usr/bin/env python3
"""Create an OmniSD/Wallace-compatible wrapper around the WebIDE app ZIP."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

app = Path("dist/block-frontier-kaios.zip")
out = Path("dist/block-frontier-omnisd.zip")
if not app.is_file():
    raise SystemExit("Missing WebIDE archive: " + str(app))
with ZipFile(out, "w", ZIP_DEFLATED) as archive:
    archive.write(app, "application.zip")
    archive.writestr("update.webapp", "")
    archive.writestr(
        "metadata.json",
        json.dumps(
            {"version": 1, "manifestURL": "app://block-frontier-danilfg/manifest.webapp"},
            separators=(",", ":"),
        ),
    )
with ZipFile(out) as archive:
    assert sorted(archive.namelist()) == sorted(["application.zip", "update.webapp", "metadata.json"])
print("Created " + str(out))
