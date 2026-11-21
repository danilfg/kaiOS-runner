#!/usr/bin/env python3
"""Build *real* J2ME MIDP/CLDC JAR+JAD for Nokia Series 40.
Toolchain from Maven Central, verified by SHA256; no dependency bundled into game.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import subprocess
import sys
from urllib.request import urlopen
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / ".cache" / "j2me-tools"
DIST = ROOT / "dist"
ARTIFACTS = (
    ("org/eclipse/jdt/ecj/3.26.0/ecj-3.26.0.jar",
     "ac0ba5876eaf7ebb47749a0d1be179c51f194b9dd0b875d1c09e1b530f5a2db5"),
    ("org/microemu/cldcapi10/2.0.4/cldcapi10-2.0.4.jar",
     "6b5753c830a966d91cbfcd5cde223a6899c6c69f021a8e38a429cec967bc290d"),
    ("org/microemu/midpapi20/2.0.4/midpapi20-2.0.4.jar",
     "b7f6ed5e0344c7000643ecc114e6edff3587e8e77face546af0e12ffd6dbe826"),
)
NAME = "Block Frontier"
MAIN = "com.danilfg.blockfrontier.BlockFrontierMIDlet"
BASENAME = "block-frontier-j2me"
VERSION = "0.2.0"


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(rel, expected):
    LIB.mkdir(parents=True, exist_ok=True)
    dst = LIB / rel.rsplit("/", 1)[1]
    if dst.exists() and sha256(dst) == expected:
        return dst
    url = "https://repo.maven.apache.org/maven2/" + rel
    print("Fetching", url, flush=True)
    with urlopen(url, timeout=90) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != expected:
        raise RuntimeError("SHA-256 mismatch for " + rel)
    dst.write_bytes(data)
    return dst


def main():
    jars = [download(*item) for item in ARTIFACTS]
    classes = ROOT / ".cache" / "j2me-classes"
    classes.mkdir(parents=True, exist_ok=True)
    boot = os.pathsep.join(map(str, jars[1:]))
    src = ROOT / "java-me" / "src"
    filename = src / "com" / "danilfg" / "blockfrontier" / "BlockFrontierMIDlet.java"
    cmd = [
        "java", "-jar", str(jars[0]), "-source", "1.3", "-target", "cldc1.1",
        "-g:none", "-nowarn", "-encoding", "UTF-8",
        "-bootclasspath", boot, "-sourcepath", str(src),
        "-d", str(classes), str(filename),
    ]
    subprocess.run(cmd, check=True)
    expected_class = classes / "com" / "danilfg" / "blockfrontier" / "BlockFrontierMIDlet.class"
    if not expected_class.exists():
        raise RuntimeError("Compiler did not produce main MIDlet class")

    class_files = sorted(classes.rglob("*.class"))
    if not class_files:
        raise RuntimeError("No compiled class files")
    for path in class_files:
        raw = path.read_bytes()
        if raw[:4] != bytes((0xca, 0xfe, 0xba, 0xbe)):
            raise RuntimeError("Not a class file: " + str(path))
        major = int.from_bytes(raw[6:8], "big")
        if major != 45:
            raise RuntimeError("Incompatible class version: " + str(major))
    DIST.mkdir(parents=True, exist_ok=True)
    jar_path = DIST / (BASENAME + ".jar")
    jad_path = DIST / (BASENAME + ".jad")
    fields = [
        ("Manifest-Version", "1.0"),
        ("MIDlet-Name", NAME),
        ("MIDlet-Version", VERSION),
        ("MIDlet-Vendor", "danilfg"),
        ("MIDlet-1", NAME + ", ," + MAIN),
        ("MicroEdition-Profile", "MIDP-2.0"),
        ("MicroEdition-Configuration", "CLDC-1.0"),
    ]
    manifest = "\r\n".join(k + ": " + v for k, v in fields) + "\r\n\r\n"
    with ZipFile(jar_path, "w", ZIP_DEFLATED, compresslevel=9) as z:
        z.writestr("META-INF/MANIFEST.MF", manifest.encode("ascii"))
        for f in class_files:
            z.write(f, f.relative_to(classes).as_posix())
    jad_lines = fields[1:] + [
        ("MIDlet-Jar-URL", jar_path.name),
        ("MIDlet-Jar-Size", str(jar_path.stat().st_size)),
    ]
    jad_path.write_bytes(("\r\n".join(k + ": " + v for k, v in jad_lines) + "\r\n").encode("ascii"))
    with ZipFile(jar_path) as z:
        assert "META-INF/MANIFEST.MF" in z.namelist()
        assert expected_class.relative_to(classes).as_posix() in z.namelist()
    if jar_path.stat().st_size > 512 * 1024:
        raise RuntimeError("JAR exceeds conservative 512 KiB Nokia 2720 fold limit")
    print("Built", jar_path.name, jar_path.stat().st_size, "bytes;", jad_path.name)


if __name__ == "__main__":
    main()
