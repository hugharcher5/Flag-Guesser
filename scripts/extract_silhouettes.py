#!/usr/bin/env python3
"""
Extract land-area paths from downloaded Wikimedia SVGs and create clean black
silhouette SVGs in public/silhouettes/.

Each output SVG has:
  - transparent background
  - fill="black" for all land paths
  - viewBox tightly cropped to the land area (with padding)
"""

import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ET.register_namespace('', 'http://www.w3.org/2000/svg')
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')

BASE = Path(__file__).parent.parent / 'public' / 'silhouettes'


# ── SVG path bounding box (approximate) ─────────────────────────────────────

_TOKEN = re.compile(r'[MmZzLlHhVvCcSsQqTtAa]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?')

def _parse_path_nums(d: str) -> list:
    """Return list of (command_letter, [floats]) tuples."""
    tokens = _TOKEN.findall(d)
    cmds = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t.isalpha():
            cmd = t; i += 1
            nums = []
            while i < len(tokens) and not tokens[i].isalpha():
                nums.append(float(tokens[i])); i += 1
            cmds.append((cmd, nums))
        else:
            i += 1
    return cmds


def path_bbox(d: str) -> tuple[float,float,float,float] | None:
    """Approximate bounding box by tracking cursor through path commands."""
    cmds = _parse_path_nums(d)
    if not cmds:
        return None
    xs, ys = [], []
    cx, cy = 0.0, 0.0   # current point
    sx, sy = 0.0, 0.0   # start point (for Z)

    def record(x, y):
        xs.append(x); ys.append(y)

    for cmd, nums in cmds:
        c = cmd.upper()
        rel = cmd.islower() and cmd != 'Z'

        if c == 'M':
            for i in range(0, len(nums), 2):
                x = (cx + nums[i]) if (rel and i > 0) else (cx + nums[i] if (rel and i == 0) else nums[i])
                y = (cy + nums[i+1]) if (rel and i > 0) else (cy + nums[i+1] if (rel and i == 0) else nums[i+1])
                # First pair is always treated as M, rest as implicit L
                if rel:
                    x = cx + nums[i]; y = cy + nums[i+1]
                else:
                    x = nums[i]; y = nums[i+1]
                cx, cy = x, y
                if i == 0:
                    sx, sy = x, y
                record(x, y)

        elif c == 'L':
            for i in range(0, len(nums), 2):
                x = cx + nums[i] if rel else nums[i]
                y = cy + nums[i+1] if rel else nums[i+1]
                cx, cy = x, y; record(x, y)

        elif c == 'H':
            for n in nums:
                x = cx + n if rel else n
                cx = x; record(x, cy)

        elif c == 'V':
            for n in nums:
                y = cy + n if rel else n
                cy = y; record(cx, y)

        elif c in ('C',):
            # Cubic bezier: 3 pairs — 2 control pts + endpoint
            # Only record the endpoint (control pts can be far outside the curve)
            for i in range(0, len(nums), 6):
                ex = cx + nums[i+4] if rel else nums[i+4]
                ey = cy + nums[i+5] if rel else nums[i+5]
                cx, cy = ex, ey
                record(ex, ey)

        elif c in ('S', 'Q'):
            # Smooth cubic / quadratic: 2 pairs — 1 control pt + endpoint
            step = 4
            for i in range(0, len(nums), step):
                ex = cx + nums[i+step-2] if rel else nums[i+step-2]
                ey = cy + nums[i+step-1] if rel else nums[i+step-1]
                cx, cy = ex, ey
                record(ex, ey)

        elif c == 'T':
            for i in range(0, len(nums), 2):
                x = cx + nums[i] if rel else nums[i]
                y = cy + nums[i+1] if rel else nums[i+1]
                cx, cy = x, y; record(x, y)

        elif c == 'A':
            for i in range(0, len(nums), 7):
                x = cx + nums[i+5] if rel else nums[i+5]
                y = cy + nums[i+6] if rel else nums[i+6]
                cx, cy = x, y; record(x, y)

        elif c == 'Z':
            cx, cy = sx, sy

    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def bbox_for_paths(ds: list[str]) -> tuple[float,float,float,float] | None:
    boxes = [path_bbox(d) for d in ds]
    boxes = [b for b in boxes if b]
    if not boxes:
        return None
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def viewbox_from_paths(ds: list[str], padding_frac: float = 0.05) -> str:
    b = bbox_for_paths(ds)
    if not b:
        return '0 0 100 100'
    x0, y0, x1, y1 = b
    w = x1 - x0 or 1.0
    h = y1 - y0 or 1.0
    pad_x = w * padding_frac
    pad_y = h * padding_frac
    return f'{x0-pad_x:.4f} {y0-pad_y:.4f} {w+2*pad_x:.4f} {h+2*pad_y:.4f}'


# ── SVG writing ──────────────────────────────────────────────────────────────

def write_silhouette(code: str, paths: list[str], viewbox: str):
    path_els = '\n  '.join(f'<path d="{d}" />' for d in paths)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" fill="black">\n  {path_els}\n</svg>\n'
    out = BASE / f'{code}.svg'
    out.write_text(svg, encoding='utf-8')
    total = sum(len(d) for d in paths)
    print(f'  -> {out.name}  ({len(paths)} path(s), {total} d-chars, viewBox={viewbox[:40]})')


# ── Path extraction helpers ──────────────────────────────────────────────────

def extract_by_id(svg_file: Path, elem_id: str) -> list[str]:
    tree = ET.parse(svg_file)
    for el in tree.getroot().iter():
        if el.get('id') == elem_id:
            d = el.get('d', '')
            return [d] if d else []
    return []


def extract_by_fill(svg_file: Path, fill_color: str, min_len: int = 10) -> list[str]:
    tree = ET.parse(svg_file)
    fill_lc = fill_color.lower()
    paths = []
    for el in tree.getroot().iter():
        if not el.tag.endswith('path'):
            continue
        d = el.get('d', '')
        if len(d) < min_len:
            continue
        style = el.get('style', '')
        fill = el.get('fill', '')
        m = re.search(r'fill\s*:\s*([^;]+)', style)
        if m:
            fill = m.group(1).strip()
        if fill.lower() == fill_lc:
            paths.append(d)
    return paths


def extract_closed_paths(svg_file: Path, min_len: int = 50) -> list[str]:
    tree = ET.parse(svg_file)
    paths = []
    for el in tree.getroot().iter():
        if not el.tag.endswith('path'):
            continue
        d = el.get('d', '')
        if len(d) < min_len:
            continue
        if re.search(r'[Zz]\s*$', d.strip()):
            paths.append(d)
    return paths


# ── Per-country processing ───────────────────────────────────────────────────

def process_sg():
    print('Singapore (sg):')
    paths = extract_by_fill(BASE / 'sg_raw.svg', '#fefee9', min_len=100)
    if not paths:
        # fallback: largest path
        tree = ET.parse(BASE / 'sg_raw.svg')
        best = max((el.get('d','') for el in tree.getroot().iter() if el.tag.endswith('path')), key=len, default='')
        paths = [best] if best else []
    vb = viewbox_from_paths(paths, padding_frac=0.02)
    write_silhouette('sg', paths, vb)


def process_mv():
    print('Maldives (mv):')
    paths = extract_by_fill(BASE / 'mv_raw.svg', '#A7D0B1', min_len=20)
    if not paths:
        paths = extract_closed_paths(BASE / 'mv_raw.svg', min_len=30)
    vb = viewbox_from_paths(paths, padding_frac=0.03)
    write_silhouette('mv', paths, vb)


def process_mh():
    print('Marshall Islands (mh):')
    paths = extract_closed_paths(BASE / 'mh_raw.svg', min_len=20)
    vb = viewbox_from_paths(paths, padding_frac=0.03)
    write_silhouette('mh', paths, vb)


def process_fm():
    print('Micronesia (fm):')
    paths = extract_closed_paths(BASE / 'fm_raw.svg', min_len=20)
    vb = viewbox_from_paths(paths, padding_frac=0.03)
    write_silhouette('fm', paths, vb)


def process_tv():
    print('Tuvalu (tv):')
    paths = extract_closed_paths(BASE / 'tv_raw.svg', min_len=20)
    vb = viewbox_from_paths(paths, padding_frac=0.03)
    write_silhouette('tv', paths, vb)


def process_mc():
    print('Monaco (mc):')
    # mc_raw.svg: path3012 = main Monaco territory, path5506 = Fontvieille (reclaimed land)
    # These have fill=url(#pattern) (polka-dot highlight) — not #fefee9 which is French land
    paths = [d for d in [
        ''.join(extract_by_id(BASE / 'mc_raw.svg', 'path3012')),
        ''.join(extract_by_id(BASE / 'mc_raw.svg', 'path5506')),
    ] if d]
    vb = viewbox_from_paths(paths, padding_frac=0.08)
    write_silhouette('mc', paths, vb)


def process_sm():
    print('San Marino (sm):')
    # sm_raw.svg: detailed close-up, land is #fefee9 (path3397, 4726 chars)
    paths = extract_by_fill(BASE / 'sm_raw.svg', '#fefee9', min_len=100)
    vb = viewbox_from_paths(paths, padding_frac=0.05)
    write_silhouette('sm', paths, vb)


def process_nr():
    print('Nauru (nr):')
    # nr_raw.svg: detailed island map, land is #fefee9 (path8278, 4130 chars)
    paths = extract_by_fill(BASE / 'nr_raw.svg', '#fefee9', min_len=100)
    vb = viewbox_from_paths(paths, padding_frac=0.05)
    write_silhouette('nr', paths, vb)


def process_va():
    print('Vatican City (va):')
    # va_raw.svg has id='va' but it's a microscopic dot in a Europe map (183 chars)
    # Extract it and zoom into the bounding box
    paths = extract_by_id(BASE / 'va_raw.svg', 'va')
    if paths and max(len(p) for p in paths) < 200:
        print('  NOTE: va path is tiny in Europe map — zooming into its bbox')
    vb = viewbox_from_paths(paths, padding_frac=0.5)  # generous padding for tiny shape
    write_silhouette('va', paths, vb)


if __name__ == '__main__':
    process_sg()
    process_mv()
    process_mh()
    process_fm()
    process_tv()
    process_mc()
    process_sm()
    process_nr()
    process_va()
    print('\nDone.')
