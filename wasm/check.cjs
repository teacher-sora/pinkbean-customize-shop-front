// 염색의 WebAssembly(wasm/dye.c)가 JS 루프(src/lib/core/dye.ts — 정본)와 **바이트까지 같은 결과**를 내는지 검사한다.
//   node wasm/check.cjs [wasm 파일]        파일을 주지 않으면 src/lib/core/dyeWasmBin.ts 의 것을 검사한다
// scripts/build-wasm.sh 가 빌드 끝에 돌린다. dye.ts 의 루프를 고쳤을 때도 돌린다(다르면 dye.c 를 맞춘다).
// 넣는 것: 16단계 색 전부(4096색) · 아무 색 · 투명 칸 · 검정과 흰색을, 아무 값의 색조 · 채도 · 명도 · 계열 · 테두리로.
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const src = fs.readFileSync(path.join(root, 'src/lib/core/dye.ts'), 'utf8')
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('dye.ts 에서 자리를 찾지 못했다: ' + a); return src.slice(i, j) }
const code = cut('interface Rgb', '// Recolor one sprite exactly like the game') +
  'function hsbJs(a: Uint8ClampedArray, hue: number, saturation: number, brightness: number, type: number, edge: boolean) {\n' + cut('// [hsb 루프 시작]', '// [hsb 루프 끝]') + '}\n' +
  'function blendJs(A: Uint8ClampedArray, B: Uint8ClampedArray, t: number) {\n' + cut('// [blend 루프 시작]', '// [blend 루프 끝]') + '}\nmodule.exports = { hsbJs, blendJs }\n'
const m = { exports: {} }
new Function('module', 'exports', ts.transpileModule(code, { compilerOptions: { target: 'ES2020', module: 'CommonJS' } }).outputText)(m, m.exports)
const { hsbJs, blendJs } = m.exports

let bytes
if (process.argv[2]) bytes = fs.readFileSync(process.argv[2])
else bytes = Buffer.from(/DYE_WASM = "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'src/lib/core/dyeWasmBin.ts'), 'utf8'))[1], 'base64')
const mod = new WebAssembly.Module(bytes)
if (WebAssembly.Module.imports(mod).length) { console.error('✗ WASM 이 바깥 함수를 요구한다(가져오는 것 없이 떠야 한다):', WebAssembly.Module.imports(mod).map((i) => i.name).join(', ')); process.exit(1) }
const ex = new WebAssembly.Instance(mod, {}).exports
const pa = ex.slotA(), pb = ex.slotB()

let seed = 12345
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const px = []
for (let r = 0; r < 16; r++) for (let g = 0; g < 16; g++) for (let b = 0; b < 16; b++) px.push(r * 17, g * 17, b * 17, 255)
for (let i = 0; i < 20000; i++) px.push(ri(0, 255), ri(0, 255), ri(0, 255), rnd() < 0.1 ? 0 : ri(1, 255))
px.push(0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 0)
const base = Uint8ClampedArray.from(px), other = Uint8ClampedArray.from(px.map(() => ri(0, 255)))

let bad = 0, runs = 0
const cases = [[0, 100, 150, 0, false], [0, 100, 50, 0, true], [359, 199, 199, 6, true], [1, 1, 1, 1, false], [180, 100, 100, 3, false]]
for (let i = 0; i < 400; i++) cases.push([ri(0, 359), ri(1, 199), ri(1, 199), ri(0, 6), rnd() < 0.3])
for (const p of cases) {
  const a = new Uint8ClampedArray(base)
  hsbJs(a, ...p)
  const w = new Uint8Array(ex.memory.buffer, pa, base.length)
  w.set(base); ex.hsb(pa, base.length, p[0], p[1], p[2], p[3], p[4] ? 1 : 0)
  runs++
  for (let k = 0; k < a.length; k++) if (a[k] !== w[k]) { if (bad++ < 5) console.error(`✗ hsb ${JSON.stringify(p)} 칸 ${k >> 2}(${[...base.subarray(k & ~3, (k & ~3) + 4)]}): JS ${a[k]} WASM ${w[k]}`); break }
}
for (let r = 0; r <= 100; r++) {
  const a = new Uint8ClampedArray(base)
  blendJs(a, other, r / 100)
  const w = new Uint8Array(ex.memory.buffer, pa, base.length)
  w.set(base); new Uint8Array(ex.memory.buffer, pb, base.length).set(other); ex.blend(pa, pb, base.length, r / 100)
  runs++
  for (let k = 0; k < a.length; k++) if (a[k] !== w[k]) { if (bad++ < 5) console.error(`✗ blend ${r}% 칸 ${k >> 2}: JS ${a[k]} WASM ${w[k]}`); break }
}
if (bad) { console.error(`✗ ${runs}번 가운데 ${bad}번이 다르다`); process.exit(1) }
console.log(`· WASM 과 JS 의 결과가 같다(${runs}번, 한 번에 ${base.length / 4}칸)`)
