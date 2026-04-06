#!/usr/bin/env python3
"""
Generate dark and blue SVG silhouette files for specific countries.

Output for each country code:
  public/silhouettes/{code}.svg       — fill #1e293b (dark, unrevealed)
  public/silhouettes/{code}_blue.svg  — fill #3b82f6 (blue, revealed)

Sources:
  - mc, nr, sg, sm, mh, mv, fm, tv: already extracted from Wikimedia into
    public/silhouettes/{code}.svg (black fill). Re-generate with correct colors.
  - va: use the pre-computed 12-point path from silhouettePaths.ts (480x320 canvas).
"""

import re
from pathlib import Path

BASE = Path(__file__).parent.parent / 'public' / 'silhouettes'

DARK = '#1e293b'
BLUE = '#3b82f6'

# Vatican City path (from silhouettePaths.ts, already in 480x320 space)
VA_PATH = ('M402.9,219.5L420.1,115.8L408.6,31.4L345.7,16.0L237.1,23.7'
           'L82.8,50.6L59.9,142.7L71.4,234.9L111.4,281.0L217.1,304.0'
           'L317.2,273.3L402.9,219.5Z')
VA_VIEWBOX = '0 0 480 320'


def read_paths_and_viewbox(svg_file: Path) -> tuple[list[str], str]:
    """Extract all path d-strings and the viewBox from an existing SVG."""
    text = svg_file.read_text(encoding='utf-8')
    vb_m = re.search(r'viewBox="([^"]+)"', text)
    vb = vb_m.group(1) if vb_m else '0 0 100 100'
    paths = re.findall(r'<path\s+d="([^"]+)"', text)
    return paths, vb


def write_svg(code: str, paths: list[str], viewbox: str, fill: str, suffix: str = ''):
    path_els = '\n  '.join(f'<path d="{d}" />' for d in paths)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" fill="{fill}">\n  {path_els}\n</svg>\n'
    fname = f'{code}{suffix}.svg'
    (BASE / fname).write_text(svg, encoding='utf-8')
    print(f'  {fname}  ({len(paths)} path(s))')


def process(code: str, paths: list[str], viewbox: str):
    print(f'{code}:')
    write_svg(code, paths, viewbox, DARK)
    write_svg(code, paths, viewbox, BLUE, '_blue')


if __name__ == '__main__':
    # Vatican City — hand-crafted path from silhouettePaths.ts
    process('va', [VA_PATH], VA_VIEWBOX)

    # Wikimedia-extracted countries
    for code in ['mc', 'nr', 'sg', 'sm', 'mh', 'mv', 'fm', 'tv']:
        src = BASE / f'{code}.svg'
        if not src.exists():
            print(f'{code}: MISSING {src}')
            continue
        paths, vb = read_paths_and_viewbox(src)
        if not paths:
            print(f'{code}: no paths found in {src}')
            continue
        process(code, paths, vb)

    print('\nDone.')
