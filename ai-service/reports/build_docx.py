"""
build_docx.py
Converts 10_ProjectSummary.md → 10_ProjectSummary.docx

Steps:
  1. Parse the markdown and extract every ```mermaid ... ``` block.
  2. Render each block to a PNG via mmdc (Mermaid CLI).
  3. Replace each block with a markdown image reference.
  4. Run pandoc on the modified markdown to produce the DOCX.
"""

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

REPORT_DIR = Path(__file__).parent
MD_IN      = REPORT_DIR / "10_ProjectSummary.md"
DOCX_OUT   = REPORT_DIR / "10_ProjectSummary.docx"
IMG_DIR    = REPORT_DIR / "mermaid_images"

IMG_DIR.mkdir(exist_ok=True)

# ── 1. Read markdown ──────────────────────────────────────────────────────────
text = MD_IN.read_text(encoding="utf-8")

# ── 2. Find every mermaid block and render to PNG ────────────────────────────
MERMAID_RE = re.compile(r"```mermaid\n(.*?)```", re.DOTALL)
matches = list(MERMAID_RE.finditer(text))

if not matches:
    print("No mermaid blocks found — running pandoc on original file.")
else:
    print(f"Found {len(matches)} mermaid diagram(s). Rendering...")

replacements = []  # list of (match, img_path)

for i, m in enumerate(matches, start=1):
    diagram_src = m.group(1).strip()
    mmd_file = IMG_DIR / f"diagram_{i:02d}.mmd"
    png_file = IMG_DIR / f"diagram_{i:02d}.png"

    mmd_file.write_text(diagram_src, encoding="utf-8")

    # On Windows mmdc is installed as a .cmd wrapper
    mmdc_cmd = r"C:\Users\Emircan\AppData\Roaming\npm\mmdc.cmd"

    result = subprocess.run(
        [
            mmdc_cmd,
            "-i", str(mmd_file),
            "-o", str(png_file),
            "-b", "white",          # white background
            "-w", "1200",           # width px — wide enough for complex graphs
            "--scale", "2",         # 2× for crisp rendering
        ],
        capture_output=True,
        text=True,
        shell=True,
    )

    if result.returncode != 0:
        print(f"  [WARN] diagram_{i:02d} failed: {result.stderr.strip()}")
        # Leave the block as-is if rendering fails
        replacements.append((m, None))
    else:
        print(f"  [OK]   diagram_{i:02d}.png")
        replacements.append((m, png_file))

# ── 3. Build modified markdown with image refs ───────────────────────────────
# Work backwards so offsets stay valid
modified = text
for m, png_file in reversed(replacements):
    if png_file is None:
        continue
    # Pandoc resolves image paths relative to the working directory we pass below
    rel_path = png_file.relative_to(REPORT_DIR).as_posix()
    img_md = f"![]({rel_path})\n"
    modified = modified[: m.start()] + img_md + modified[m.end() :]

# Write the modified markdown to a temp file next to the report dir
tmp_md = REPORT_DIR / "_tmp_converted.md"
tmp_md.write_text(modified, encoding="utf-8")

# ── 4. Run pandoc ─────────────────────────────────────────────────────────────
print(f"\nRunning pandoc -> {DOCX_OUT.name} ...")
pandoc_result = subprocess.run(
    [
        "pandoc",
        str(tmp_md),
        "-o", str(DOCX_OUT),
        "--from", "markdown",
        "--to", "docx",
        "--highlight-style", "tango",
        "-V", "geometry:margin=2.5cm",
    ],
    capture_output=True,
    text=True,
    cwd=str(REPORT_DIR),   # so relative image paths resolve correctly
)

tmp_md.unlink(missing_ok=True)   # clean up temp file

if pandoc_result.returncode != 0:
    print(f"pandoc error:\n{pandoc_result.stderr}")
    sys.exit(1)

print(f"\nDone! -> {DOCX_OUT}")
