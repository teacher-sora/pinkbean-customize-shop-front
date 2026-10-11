# 앱 글꼴(Wanted Sans 가변, OFL)을 두 파일로 나눈다 — 첫 화면에서 받는 양을 줄이려는 것(통짜 1.26MB → 0.38MB).
#
#   src/assets/fonts/WantedSansVariable-common.woff2  자주 쓰는 글자. 첫 화면에서 미리 받는다(app/layout.tsx 의 next/font).
#   src/assets/fonts/WantedSansVariable-rest.woff2    나머지 한글 음절. 화면에 그 글자가 나올 때만 받는다(app/fonts.css 의 unicode-range).
#   src/app/fonts.css                                 나머지 파일의 @font-face(이 스크립트가 쓴다. 손으로 고치지 않는다)
#
# 자주 쓰는 글자 = 한글 음절이 아닌 모든 글자 + KS X 1001 의 한글 2,350자 + 앱 소스에 나오는 글자 + 지금 CDN 의 아이템 이름에 나오는 글자.
# 여기에 없는 글자도 깨지지 않는다 — 나머지 파일이 받아져 같은 글꼴로 나온다. 그래서 패치마다 다시 돌릴 필요는 없고,
# 새 이름의 드문 글자 때문에 나머지 파일을 받는 일이 잦아졌다 싶을 때 다시 돌리면 된다.
#
# 쓰기:  pip install fonttools brotli  →  front 폴더에서  python scripts/font-subset.py
import glob, io, json, os, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont

UPSTREAM = 'https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/variable/complete/woff2/WantedSansVariable.woff2'
CDN = 'https://cdn.pinkbean-customize.com/'
OUT = 'src/assets/fonts/'
UA = {'User-Agent': 'Mozilla/5.0'}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read()

src = io.BytesIO(get(UPSTREAM))
cmap = set(TTFont(src).getBestCmap())
syllable = lambda c: 0xAC00 <= c <= 0xD7A3

ks = set()   # KS X 1001 의 한글 2,350자 = EUC-KR 두 바이트로 적히는 음절
for c in range(0xAC00, 0xD7A4):
    try:
        if len(chr(c).encode('euc_kr')) == 2: ks.add(c)
    except UnicodeEncodeError:
        pass

used = set()
for p in glob.glob('src/**/*', recursive=True) + glob.glob('public/**/*.json', recursive=True):
    if os.path.isfile(p) and p.rsplit('.', 1)[-1] in ('ts', 'tsx', 'css', 'json'):
        try: used |= {ord(ch) for ch in io.open(p, encoding='utf-8').read()}
        except UnicodeDecodeError: pass
index = json.loads(get(CDN + 'index.json').decode('utf-8'))
for s in index['slots']:
    for it in json.loads(get(CDN + s['file']).decode('utf-8')):
        used |= {ord(ch) for ch in (it.get('name') or '')}
for t in index['base']['tones']:
    used |= {ord(ch) for ch in (t.get('name') or '')}

common = ({c for c in cmap if not syllable(c)} | ks | {c for c in used if syllable(c)}) & cmap
rest = cmap - common

def make(cps, name):
    o = subset.Options()
    o.flavor = 'woff2'; o.layout_features = ['*']; o.name_IDs = ['*']; o.notdef_outline = True; o.glyph_names = False; o.hinting = True
    src.seek(0)
    f = TTFont(src)
    sb = subset.Subsetter(o); sb.populate(unicodes=sorted(cps)); sb.subset(f)
    f.flavor = 'woff2'; f.save(OUT + name)
    print(name, len(cps), '글자', os.path.getsize(OUT + name) // 1024, 'KB')

def ranges(cps):
    c = sorted(cps); out = []; a = b = c[0]
    for x in c[1:]:
        if x == b + 1: b = x
        else: out.append((a, b)); a = b = x
    out.append((a, b))
    return ','.join(('U+%X' % a) if a == b else ('U+%X-%X' % (a, b)) for a, b in out)

make(common, 'WantedSansVariable-common.woff2')
make(rest, 'WantedSansVariable-rest.woff2')
io.open('src/app/fonts.css', 'w', encoding='utf-8', newline='\n').write(
    '/* scripts/font-subset.py 가 만든다. 손으로 고치지 않는다. 자주 쓰지 않는 한글 음절 — 화면에 나올 때만 받는다. */\n'
    '@font-face { font-family: "Wanted Sans Rest"; font-style: normal; font-display: swap; font-weight: 400 1000; '
    'src: url("../assets/fonts/WantedSansVariable-rest.woff2") format("woff2"); unicode-range: ' + ranges(rest) + '; }\n')
