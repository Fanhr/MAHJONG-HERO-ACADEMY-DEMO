import xml.etree.ElementTree as ET
from pathlib import Path
from html import escape

SRC = Path('/Users/hurryfan/CodeBuddy/原型：英雄麻将/英雄麻将-局内游戏流程.drawio')
OUTDIR = Path('/Users/hurryfan/CodeBuddy/原型：英雄麻将/svg')
OUTDIR.mkdir(exist_ok=True)

def parse_style(s):
    d = {}
    for part in (s or '').split(';'):
        if not part:
            continue
        if '=' in part:
            k, v = part.split('=', 1)
            d[k] = v
        else:
            d[part] = True
    return d

def wrap_text(text, width_px, font=13):
    # rough char width
    lines_in = text.split('\n')
    approx = max(1, int(width_px // (font * 0.95)))
    out = []
    for ln in lines_in:
        cur = ''
        for ch in ln:
            cur += ch
            if len(cur) >= approx:
                out.append(cur)
                cur = ''
        out.append(cur)
    return [l for l in out if l != ''] or ['']

def render_page(diagram):
    model = diagram.find('mxGraphModel')
    W = int(model.get('pageWidth', '1000'))
    H = int(model.get('pageHeight', '1000'))
    root = model.find('root')
    cells = {c.get('id'): c for c in root.findall('mxCell')}

    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Helvetica,Arial,PingFang SC,sans-serif">')
    svg.append('<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" fill="#4d4d4d"/></marker></defs>')
    svg.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="#ffffff"/>')

    issues = []

    def geom(cell):
        g = cell.find('mxGeometry')
        if g is None:
            return None
        return (float(g.get('x', 0)), float(g.get('y', 0)), float(g.get('width', 0)), float(g.get('height', 0)))

    # render vertices first (swimlanes at back)
    verts = [c for c in root.findall('mxCell') if c.get('vertex') == '1']
    swim = [c for c in verts if 'swimlane' in (c.get('style') or '')]
    other = [c for c in verts if 'swimlane' not in (c.get('style') or '')]

    for c in swim:
        st = parse_style(c.get('style'))
        x, y, w, h = geom(c)
        fill = st.get('fillColor', '#ffffff')
        stroke = st.get('strokeColor', '#000000')
        svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" fill-opacity="0.35" stroke="{stroke}" stroke-width="1.5"/>')
        svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="34" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
        title = escape(c.get('value') or '')
        svg.append(f'<text x="{x+w/2}" y="{y+22}" text-anchor="middle" font-size="15" font-weight="bold" fill="#333">{title}</text>')

    # edges
    for c in root.findall('mxCell'):
        if c.get('edge') != '1':
            continue
        s = cells.get(c.get('source'))
        t = cells.get(c.get('target'))
        if s is None or t is None:
            issues.append(f"边 {c.get('id')} 引用缺失: source={c.get('source')} target={c.get('target')}")
            continue
        sg = geom(s); tg = geom(t)
        sx, sy = sg[0] + sg[2] / 2, sg[1] + sg[3] / 2
        tx, ty = tg[0] + tg[2] / 2, tg[1] + tg[3] / 2
        pts = [(sx, sy)]
        g = c.find('mxGeometry')
        arr = g.find('Array') if g is not None else None
        if arr is not None:
            for p in arr.findall('mxPoint'):
                pts.append((float(p.get('x')), float(p.get('y'))))
        pts.append((tx, ty))
        d = 'M ' + ' L '.join(f'{px:.1f},{py:.1f}' for px, py in pts)
        svg.append(f'<path d="{d}" fill="none" stroke="#4d4d4d" stroke-width="1.4" marker-end="url(#arrow)"/>')
        lbl = c.get('value')
        if lbl:
            mx, my = pts[len(pts)//2]
            svg.append(f'<rect x="{mx-10}" y="{my-11}" width="20" height="18" fill="#ffffff" opacity="0.85"/>')
            svg.append(f'<text x="{mx}" y="{my+3}" text-anchor="middle" font-size="12" fill="#b85450">{escape(lbl)}</text>')

    # non-swimlane vertices
    for c in other:
        st = parse_style(c.get('style'))
        x, y, w, h = geom(c)
        fill = st.get('fillColor', '#ffffff')
        stroke = st.get('strokeColor', '#000000')
        dash = ' stroke-dasharray="6,4"' if st.get('dashed') else ''
        if 'ellipse' in st:
            svg.append(f'<ellipse cx="{x+w/2}" cy="{y+h/2}" rx="{w/2}" ry="{h/2}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"{dash}/>')
        elif 'rhombus' in st:
            svg.append(f'<polygon points="{x+w/2},{y} {x+w},{y+h/2} {x+w/2},{y+h} {x},{y+h/2}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"{dash}/>')
        else:
            svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="1.5"{dash}/>')
        # text
        val = c.get('value') or ''
        val = val.replace('&#10;', '\n').replace('&amp;', '&')
        lines = wrap_text(val, w - 12)
        n = len(lines)
        start_y = y + h/2 - (n-1)*8
        # overflow check
        if n * 16 > h - 6:
            issues.append(f"节点 {c.get('id')} 文字可能溢出: '{val}' (h={h}, 行数={n})")
        for i, ln in enumerate(lines):
            svg.append(f'<text x="{x+w/2}" y="{start_y + i*16 + 4}" text-anchor="middle" font-size="13" fill="#111">{escape(ln)}</text>')

    svg.append('</svg>')

    # bounds check
    for c in other + swim:
        x, y, w, h = geom(c)
        if x < 0 or y < 0 or x + w > W or y + h > H:
            issues.append(f"节点 {c.get('id')} 超出页面边界 (page {W}x{H}, 节点 x={x},y={y},w={w},h={h})")

    return '\n'.join(svg), issues

tree = ET.parse(SRC)
mxfile = tree.getroot()
all_issues = {}
for diagram in mxfile.findall('diagram'):
    name = diagram.get('name')
    content, issues = render_page(diagram)
    fn = OUTDIR / f"{name}.svg"
    fn.write_text(content, encoding='utf-8')
    all_issues[name] = issues
    print(f"[导出] {fn.name}  节点+连线检查: {len(issues)} 个问题")

print('\n===== 问题汇总 =====')
total = 0
for name, issues in all_issues.items():
    if issues:
        print(f'\n## {name}')
        for it in issues:
            print(' -', it)
            total += 1
if total == 0:
    print('未发现越界/溢出/断链问题。')
