import subprocess
import zlib
from pathlib import Path

files = {
    "V84__Add_gate_type_column.sql": ("683a1af", "backend/src/main/resources/db/migration/V84__Add_gate_type_column.sql", 1654566303),
    "V85__Add_gate_id_to_camera.sql": ("683a1af", "backend/src/main/resources/db/migration/V85__Add_gate_id_to_camera.sql", 955137756),
    "V86__Grant_delete_on_map_source_and_activation_audit.sql": (
        "683a1af",
        "backend/src/main/resources/db/migration/V86__Grant_delete_on_map_source_and_activation_audit.sql",
        -1367139715,
    ),
    "V87__Add_camera_source_configuration.sql": (
        "ff61bbd",
        "backend/src/main/resources/db/migration/V84__Add_camera_source_configuration.sql",
        674575778,
    ),
}

out = Path("backend/src/main/resources/db/migration")


def crc_variants(data: bytes):
    variants = {
        "raw": data,
        "lf": data.replace(b"\r\n", b"\n").replace(b"\r", b"\n"),
        "crlf": data.replace(b"\n", b"\r\n") if b"\r\n" not in data else data,
    }
    for label, v in variants.items():
        if v.startswith(b"\xef\xbb\xbf"):
            v = v[3:]
        # Flyway also trims? try as-is
        c = zlib.crc32(v) & 0xFFFFFFFF
        if c >= 2**31:
            c -= 2**32
        yield label, c, len(v)


for name, (commit, git_path, expected) in files.items():
    data = subprocess.check_output(["git", "show", f"{commit}:{git_path}"])
    # Prefer LF for repo consistency
    normalized = data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    (out / name).write_bytes(normalized)
    print(name, "expected", expected)
    for label, c, n in crc_variants(data):
        print(f"  blob/{label}: {c} len={n} match={c == expected}")
    for label, c, n in crc_variants(normalized):
        print(f"  file/{label}: {c} len={n} match={c == expected}")
