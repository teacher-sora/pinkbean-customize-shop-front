#!/bin/sh
# 염색의 픽셀 연산(wasm/dye.c)을 WebAssembly 로 만들어 src/lib/core/dyeWasmBin.ts 에 넣는다.
#   sh scripts/build-wasm.sh
# emsdk 가 있어야 한다(기본 C:/Requires/emsdk, 다른 곳이면 EMSDK=<폴더>). wasm/dye.c 를 고쳤을 때만 돌린다.
# 끝에 JS 루프와 결과가 바이트까지 같은지 검사한다(wasm/check.cjs). 다르면 실패한다.
set -e
cd "$(dirname "$0")/.."
EMSDK="${EMSDK:-C:/Requires/emsdk}"
PY="$(ls "$EMSDK"/python/*/python.exe 2>/dev/null | head -1)"
[ -n "$PY" ] || { echo "✗ emsdk 를 찾지 못했다: $EMSDK (EMSDK 로 지정)"; exit 1; }
export EM_CONFIG="$EMSDK/.emscripten"
OUT="$(mktemp -d)"
"$PY" "$EMSDK/upstream/emscripten/emcc.py" -O3 wasm/dye.c -o "$OUT/dye.wasm" --no-entry \
  -sSTANDALONE_WASM=1 -sALLOW_MEMORY_GROWTH=0 -sINITIAL_MEMORY=16MB \
  -sEXPORTED_FUNCTIONS=_hsb,_blend,_slotA,_slotB,_cap
node wasm/check.cjs "$OUT/dye.wasm"
node -e '
const fs = require("fs"), b = fs.readFileSync(process.argv[1])
fs.writeFileSync("src/lib/core/dyeWasmBin.ts", "// 염색 연산의 WebAssembly(base64). scripts/build-wasm.sh 가 wasm/dye.c 로 만든다 — 손으로 고치지 않는다.\n// 따로 떨어진 조각으로 나가도록 dye.ts 가 import() 로 부른다(염색을 쓰기 전에는 받지 않는다).\nexport const DYE_WASM = \"" + b.toString("base64") + "\"\n")
console.log("· dyeWasmBin.ts", b.length, "bytes")' "$OUT/dye.wasm"
rm -rf "$OUT"
