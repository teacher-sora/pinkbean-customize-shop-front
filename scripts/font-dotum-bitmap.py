# 명찰 · 말풍선 글자(돋움 12px — 게임의 글꼴)를 도트 그대로 뽑는다. core/chatGlyphs 가 이 도트를 직접 찍는다(브라우저가 글꼴을 그리지 않는다).
#
# 왜 글꼴 파일이 아니라 도트인가: 게임 글자는 돋움에 들어 있는 12px 전용 1비트 비트맵(EBDT/EBLC)이다. 이 비트맵은 웹 글꼴로 내려주면
# 브라우저의 글꼴 검사(OTS)가 지워 윤곽선으로 그려지고, 윤곽선 12px 은 번져 게임과 다르다. 도트를 직접 찍으면 어느 기기에서나 같다.
#
#   public/dev/fonts/dotum12-<판>/basic.json  한글 음절 · 한자를 뺀 글자(영문 · 숫자 · 문장부호 · 자모 · 기호)
#   public/dev/fonts/dotum12-<판>/ks.json     KS X 1001 의 한글 2,350자
#   public/dev/fonts/dotum12-<판>/rest.json   나머지 한글 음절
#   public/dev/fonts/dotum12-<판>/cjk.json    한자 · 가나
#   src/lib/core/chatGlyphsKs.ts               KS 2,350자 표(11,172칸 비트 — 어느 파일에 든 음절인지 고른다. 이 스크립트가 쓴다)
# 한 글자 = [코드, 폭(advance), 왼쪽 여백(bearingX), 기준선 위 높이(bearingY), 너비, 높이, 줄마다 비트(16진수, 줄 길이 = ceil(너비/8)*2)].
# 지금은 dev 전용이라 public/dev 에 둔다(main 병합 때 빠진다).
#
# 쓰기(윈도우):  pip install fonttools  →  front 폴더에서  python scripts/font-dotum-bitmap.py
import base64, io, json, os, shutil
from fontTools.ttLib import TTCollection

VER = '1'
SRC = 'C:/Windows/Fonts/gulim.ttc'
OUT = f'public/dev/fonts/dotum12-{VER}/'
PPEM = 12

font = next(f for f in TTCollection(SRC).fonts if f['name'].getDebugName(1) == 'Dotum')
eblc, ebdt = font['EBLC'], font['EBDT']
si = next(i for i, s in enumerate(eblc.strikes) if s.bitmapSizeTable.ppemY == PPEM)
data = ebdt.strikeData[si]
cmap = font.getBestCmap()

# 형식 5 글리프는 metrics 가 글리프가 아니라 EBLC 색인에 있다(같은 묶음이 한 크기를 나눠 쓴다).
idx_metrics = {}
for t in eblc.strikes[si].indexSubTables:
    if t.imageFormat == 5:
        for n in t.names: idx_metrics[n] = t.metrics

def norm(m):
    """작은(Advance · BearingX · BearingY) · 큰(hori*) metrics 를 한 모양으로."""
    v = vars(m)
    if 'Advance' in v: return v['width'], v['height'], v['Advance'], v['BearingX'], v['BearingY']
    return v['width'], v['height'], v['horiAdvance'], v['horiBearingX'], v['horiBearingY']

memo = {}  # 같은 글리프를 여러 글자가 함께 쓴다(\ 와 ₩ 등) — 한 번 푼 것을 다시 쓴다(fontTools 는 두 번째 접근에서 metrics 가 비어 있다)
def bits(gn):
    if gn not in memo: memo[gn] = bits_(gn)
    return memo[gn]

def bits_(gn):
    """글리프 → ((너비, 높이, 폭, 왼쪽 여백, 기준선 위 높이), 줄 목록['0101…']). 조합 비트맵(형식 8 · 9)은 조각을 offset 에 겹친다.
    비트 정렬 형식(2 · 5 · 7)은 줄이 바이트에 맞춰 끊기지 않고 이어진다. 바이트 정렬 형식(1 · 6)은 줄마다 바이트를 채운다."""
    g = data[gn]
    if gn in idx_metrics:
        w, h, adv, bx, by = norm(idx_metrics[gn])
        b = ''.join(format(x, '08b') for x in g.imageData)
        return (w, h, adv, bx, by), [b[r * w:(r + 1) * w] for r in range(h)]
    w, h, adv, bx, by = norm(g.metrics)
    if hasattr(g, 'componentArray'):
        grid = [[0] * w for _ in range(h)]
        for comp in g.componentArray:
            _, rows = bits(comp.name)
            for y, row in enumerate(rows):
                for x, bit in enumerate(row):
                    if bit == '1':
                        X, Y = comp.xOffset + x, comp.yOffset + y
                        if 0 <= X < w and 0 <= Y < h: grid[Y][X] = 1
        return (w, h, adv, bx, by), [''.join(map(str, r)) for r in grid]
    fmt = int(type(g).__name__.rsplit('_', 1)[1])
    b = ''.join(format(x, '08b') for x in g.imageData)
    if fmt in (1, 6):  # 바이트 정렬
        rb = (w + 7) // 8
        return (w, h, adv, bx, by), [b[r * rb * 8:r * rb * 8 + w] for r in range(h)]
    return (w, h, adv, bx, by), [b[r * w:(r + 1) * w] for r in range(h)]

def record(cp):
    gn = cmap.get(cp)
    if gn is None or gn not in data: return None
    (w, h, adv, bx, by), rows = bits(gn)
    rb = (w + 7) // 8
    hexrows = ''.join(format(int(r.ljust(rb * 8, '0'), 2), '0%dx' % (rb * 2)) for r in rows) if w else ''
    return [cp, adv, bx, by, w, h, hexrows]

syllable = lambda c: 0xAC00 <= c <= 0xD7A3
cjk = lambda c: 0x2E80 <= c <= 0x2FDF or 0x3040 <= c <= 0x30FF or 0x31F0 <= c <= 0x31FF or 0x3400 <= c <= 0x4DBF or 0x4E00 <= c <= 0x9FFF or 0xF900 <= c <= 0xFAFF or 0x20000 <= c
ks = set()
for c in range(0xAC00, 0xD7A4):
    try:
        if len(chr(c).encode('euc_kr')) == 2: ks.add(c)
    except UnicodeEncodeError:
        pass
parts = {'basic': [], 'ks': [], 'rest': [], 'cjk': []}
for cp in sorted(cmap):
    rec = record(cp)
    if rec is None: continue
    key = 'cjk' if cjk(cp) else ('ks' if cp in ks else 'rest') if syllable(cp) else 'basic'
    parts[key].append(rec)

shutil.rmtree(f'public/dev/fonts', ignore_errors=True)
os.makedirs(OUT)
for k, recs in parts.items():
    io.open(OUT + k + '.json', 'w', encoding='utf-8', newline='\n').write(json.dumps(recs, separators=(',', ':')))
    print(k, len(recs), os.path.getsize(OUT + k + '.json') // 1024, 'KB')
mask = bytearray((11172 + 7) // 8)
for c in ks: i = c - 0xAC00; mask[i >> 3] |= 1 << (i & 7)
io.open('src/lib/core/chatGlyphsKs.ts', 'w', encoding='utf-8', newline='\n').write(
    '// scripts/font-dotum-bitmap.py 가 만든다. 손으로 고치지 않는다.\n'
    '// KS X 1001 의 한글 2,350자 표 — 음절(가~힣) 11,172칸을 한 비트씩. 그 음절의 도트가 ks 파일과 rest 파일 가운데 어디에 있는지 고른다.\n'
    f"export const DOTUM_DIR = '/dev/fonts/dotum12-{VER}/'\n"
    f"export const KS_MASK = '{base64.b64encode(bytes(mask)).decode()}'\n")
