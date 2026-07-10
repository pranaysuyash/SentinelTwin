#!/usr/bin/env python3
"""
Migrate bottom-panel sub-components from raw hex colors to UI_TONES/UI_SURFACES tokens.

Three-pass approach:
  Pass 1: Replace hex values with ${token} syntax everywhere in the file
  Pass 2: Convert className="...${...}..." to className={`...${...}...`}
           and any other "...${...}..." that contains ${UI_SURFACES/UI_TONES} to template literals
  Pass 3: Add missing imports
"""
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
COMPONENTS_DIR = PROJECT_ROOT / "apps" / "studio" / "src" / "components" / "bottom-panel"

SKIP_PATTERNS = ["__tests__", ".test.", ".spec."]

# All hex → ${token} mappings (applied globally)
HEX_TO_TOKEN = {
    # UI_SURFACES backgrounds
    "bg-[#0b1018]": "${UI_SURFACES.panel}",
    "bg-[#0d0f17]": "${UI_SURFACES.panel}",
    "bg-[#0d1017]": "${UI_SURFACES.panel}",
    "bg-[#0a0d14]": "${UI_SURFACES.panel}",
    "bg-[#090c12]": "${UI_SURFACES.panel}",
    "bg-[#090d14]": "${UI_SURFACES.panel}",
    "bg-[#0b0f17]": "${UI_SURFACES.panel}",
    "bg-[#111521]": "${UI_SURFACES.card}",
    # UI_SURFACES borders
    "border-[#181b26]": "${UI_SURFACES.borderPanel}",
    "border-[#141925]": "${UI_SURFACES.borderPanel}",
    "border-[#1f2536]": "${UI_SURFACES.borderSubtle}",
    "border-[#24283a]": "${UI_SURFACES.borderThin}",
    "border-[#2a3045]": "${UI_SURFACES.borderDark}",
    "border-[#2b3143]": "${UI_SURFACES.borderDark}",
    "border-[#32384d]": "${UI_SURFACES.borderStrong}",
    "border-[#3b435c]": "${UI_SURFACES.borderStrong}",
    # UI_SURFACES text muted
    "text-[#3a4158]": "${UI_SURFACES.textMuted}",
    "text-[#4a5568]": "${UI_SURFACES.textMuted}",
    "text-[#4d566b]": "${UI_SURFACES.textMuted}",
    # UI_SURFACES text muted2
    "text-[#556076]": "${UI_SURFACES.textMuted2}",
    "text-[#5b667c]": "${UI_SURFACES.textMuted2}",
    "text-[#5a647a]": "${UI_SURFACES.textMuted2}",
    "text-[#68738a]": "${UI_SURFACES.textMuted2}",
    "text-[#6b7c95]": "${UI_SURFACES.textMuted2}",
    "text-[#6f7f9f]": "${UI_SURFACES.textMuted2}",
    "text-[#72809a]": "${UI_SURFACES.textMuted2}",
    "text-[#7a89a8]": "${UI_SURFACES.textMuted2}",
    # UI_SURFACES text muted3
    "text-[#8090a8]": "${UI_SURFACES.textMuted3}",
    "text-[#8b96ab]": "${UI_SURFACES.textMuted3}",
    "text-[#8ea5cc]": "${UI_SURFACES.textMuted3}",
    "text-[#8ea0bf]": "${UI_SURFACES.textMuted3}",
    "text-[#8c9bb4]": "${UI_SURFACES.textMuted3}",
    "text-[#9aa6bf]": "${UI_SURFACES.textMuted3}",
    # UI_SURFACES text muted4
    "text-[#9ea8bf]": "${UI_SURFACES.textMuted4}",
    "text-[#9bb2d8]": "${UI_SURFACES.textMuted4}",
    "text-[#a1abc1]": "${UI_SURFACES.textMuted4}",
    # UI_SURFACES text body
    "text-[#b7c1d8]": "${UI_SURFACES.textBody}",
    "text-[#b9c2d8]": "${UI_SURFACES.textBody}",
    "text-[#b9c7df]": "${UI_SURFACES.textBody}",
    "text-[#c0c8da]": "${UI_SURFACES.textBody}",
    "text-[#c7d0e4]": "${UI_SURFACES.textBody}",
    # UI_SURFACES text body2
    "text-[#cdd9ee]": "${UI_SURFACES.textBody2}",
    "text-[#d2d9e8]": "${UI_SURFACES.textBody2}",
    "text-[#d5e0f5]": "${UI_SURFACES.textBody2}",
    "text-[#d7deed]": "${UI_SURFACES.textBody2}",
    "text-[#dce5f7]": "${UI_SURFACES.textBody2}",
    # UI_SURFACES hover
    "hover:bg-[#1a2333]": "${UI_SURFACES.hoverBg}",
    "hover:bg-[#1e2235]": "${UI_SURFACES.hoverBg}",
    "hover:bg-[#131a28]": "${UI_SURFACES.hoverBg}",
    "hover:text-white": "${UI_SURFACES.hoverText}",
    "hover:text-[#a1abc1]": "${UI_SURFACES.hoverText}",
    "hover:text-[#8b96ab]": "${UI_SURFACES.hoverText}",
    # UI_TONES semantic
    "text-amber-300": "${UI_TONES.warning.text}",
    "text-amber-400": "${UI_TONES.warning.text}",
    "text-emerald-300": "${UI_TONES.success.text}",
    "text-rose-300": "${UI_TONES.danger.text}",
    "text-blue-300": "${UI_TONES.info.text}",
    "text-blue-400": "${UI_TONES.info.text}",
    "text-[#93c5fd]": "${UI_TONES.info.text}",
    "text-[#60a5fa]": "${UI_TONES.info.text}",
}

IMPORT_SURFACES = 'import { UI_SURFACES } from "@/lib/studio-surface-tokens";'
IMPORT_TONES = 'import { UI_TONES } from "@/lib/design-tokens";'


def should_skip(filepath: str) -> bool:
    return any(p in filepath for p in SKIP_PATTERNS)


def add_import(content: str, import_line: str) -> str:
    if import_line in content:
        return content
    lines = content.split("\n")
    last_import_end = -1
    in_multiline = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if in_multiline:
            if "}" in stripped:
                in_multiline = False
                last_import_end = i
            continue
        if stripped.startswith("import ") and "{" in stripped and "}" not in stripped:
            in_multiline = True
            continue
        if stripped.startswith("import ") or stripped.startswith("import{"):
            if "}" in stripped:
                last_import_end = i
            elif "{" in stripped:
                in_multiline = True
            else:
                last_import_end = i
    if last_import_end >= 0:
        lines.insert(last_import_end + 1, import_line)
        return "\n".join(lines)
    return content


def fix_broken_strings(content: str) -> str:
    """
    Convert "...${UI_SURFACES...}..." or "...${UI_TONES...}..." to `...${token}...`
    when they appear inside regular double-quoted strings.
    Uses character-by-character scanning instead of regex.
    """
    lines = content.split("\n")
    new_lines = []

    for line in lines:
        if "${UI_SURFACES." not in line and "${UI_TONES." not in line:
            new_lines.append(line)
            continue

        # Find all "..." strings that contain ${} and need conversion
        result = []
        i = 0
        while i < len(line):
            # Look for a double-quoted string containing ${UI_SURFACES or ${UI_TONES
            if line[i] == '"':
                # Find the matching closing "
                j = i + 1
                depth = 0
                while j < len(line):
                    if line[j] == '\\' and j + 1 < len(line):
                        j += 2
                        continue
                    if line[j] == '"':
                        break
                    j += 1
                # Extract content between quotes
                inner = line[i+1:j]
                # Check if it contains our tokens
                if ("${UI_SURFACES." in inner or "${UI_TONES." in inner) and "${" in inner:
                    # Check if this is already inside a backtick context
                    # Look backwards for className= or just plain "..." in attribute
                    prefix = line[:i]
                    # Convert to backtick string: `...${token}...`
                    result.append(f"{{`{{{inner}}}`}}")
                    i = j + 1
                else:
                    result.append(line[i:j+1])
                    i = j + 1
            else:
                result.append(line[i])
                i += 1

        new_lines.append("".join(result))

    return "\n".join(new_lines)


def process_file(filepath: Path) -> dict:
    content = filepath.read_text(encoding="utf-8")
    original = content
    total_replacements = 0

    # Pass 1: Replace all hex values with ${token} syntax
    for hex_val, token in HEX_TO_TOKEN.items():
        count = content.count(hex_val)
        if count > 0:
            content = content.replace(hex_val, token)
            total_replacements += count

    # Pass 2: Fix broken "...${...}..." strings → backtick template literals
    content = fix_broken_strings(content)

    # Pass 3: Add imports
    needs_surfaces = "UI_SURFACES." in content and IMPORT_SURFACES not in content
    needs_tones = "UI_TONES." in content and IMPORT_TONES not in content

    if needs_surfaces:
        content = add_import(content, IMPORT_SURFACES)
    if needs_tones:
        content = add_import(content, IMPORT_TONES)

    if content != original:
        filepath.write_text(content, encoding="utf-8")

    return {
        "file": str(filepath.relative_to(PROJECT_ROOT)),
        "replacements": total_replacements,
        "import_added": needs_surfaces or needs_tones,
    }


def main():
    files = sorted(COMPONENTS_DIR.glob("*.tsx"))
    total_replacements = 0
    files_modified = 0

    print(f"Scanning {len(files)} files...\n")

    for filepath in files:
        if should_skip(str(filepath)):
            continue
        result = process_file(filepath)
        if result["replacements"] > 0:
            total_replacements += result["replacements"]
            files_modified += 1
            print(f"  {result['file']}: {result['replacements']} replacements" +
                  (" [+import]" if result["import_added"] else ""))

    print(f"\nTotal: {total_replacements} replacements across {files_modified} files")


if __name__ == "__main__":
    main()
