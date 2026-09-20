'use client'

// 내 코디 등록 — PC·절반·태블릿은 오른쪽 컬럼에 상주, 모바일은 목록 자리에서 바뀐다(핸드오프 §3).
// 순서: 올릴 프리셋(3열 팝오버) → 미리보기 → 이름* → 설명 → 태그(최대 5) → 이미지(선택) → 등록할 곳*(위로 펼침) → (대회) 이메일 → 등록.
// 필수값이 비면 등록 버튼은 비활성(연한 핑크). `*` 는 라벨에만 붙이고 placeholder 에는 넣지 않는다.

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import bg from '@/assets/pinkbean-bg.png'
import { PLAZA_CONTEST, PLAZA_TAG_MAX } from '@/lib/plaza'
import { isNarrow } from '@/lib/useBreakpoint'
import SnapThumb from '../SnapThumb'
import { useShop, type Snapshot } from '../ShopContext'
import styles from './plaza.module.css'

const STAGE_FRACTION = 0.46
const PICK_FRACTION = 0.72

export default function PlazaUpload({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const narrow = isNarrow(s.bp)
  const [presetId, setPresetId] = useState(s.selectedPreset ?? s.presets[0]?.id ?? '')
  const [pickOpen, setPickOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [scope, setScope] = useState<'all' | 'contest' | null>(null)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [email, setEmail] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<HTMLDivElement>(null)

  // 하단 필터를 대회로 두면 등록할 곳도 대회를 따라간다(사용자가 직접 고르면 그 선택 유지).
  const contest = (scope ?? (s.plazaFilter === 'contest' ? 'contest' : 'all')) === 'contest'
  // 채워진 칸만 보여준다(빈 칸은 앞쪽 몇 개만 — 처음 쓰는 사람도 고를 게 보이도록).
  const options = useMemo(() => s.presets.filter((p, i) => s.presetData[p.id] || i < 3), [s.presets, s.presetData])
  const snapOf = (id: string): Snapshot | null => (id === s.selectedPreset ? s.snapshot() : s.presetData[id] ?? null)
  const current = options.find((p) => p.id === presetId) || options[0] || null
  const snap = current ? snapOf(current.id) : null
  const finalName = (name || current?.name || '').trim()
  const canSubmit = !!current && !!snap && !!finalName && (!contest || /.+@.+\..+/.test(email)) && !s.plazaSubmitting

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!pickRef.current?.contains(t)) setPickOpen(false)
      if (!scopeRef.current?.contains(t)) setScopeOpen(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [])

  const addTag = () => {
    const v = tagDraft.trim().replace(/^#/, '')
    if (!v) return
    if (tags.length >= PLAZA_TAG_MAX) { s.notify(`태그는 ${PLAZA_TAG_MAX}개까지 달 수 있어요`); return }
    if (tags.includes(v)) { setTagDraft(''); return }
    setTags([...tags, v]); setTagDraft('')
  }
  const submit = async () => {
    if (!canSubmit || !snap) { s.notify(contest ? '이메일을 확인해 주세요' : '프리셋과 이름을 확인해 주세요'); return }
    const ok = await s.plazaSubmit({ name: finalName, description: desc.trim(), tags, snapshot: snap, contest, email: contest ? email.trim() : '', image })
    if (ok) { setName(''); setDesc(''); setTags([]); setTagDraft(''); setImage(null); if (fileRef.current) fileRef.current.value = '' }
  }

  const submitBtn = (
    <button type="button" onClick={submit} disabled={!canSubmit} className={clsx('pb-solid', styles.submit, !canSubmit && styles.submitOff)}>
      {contest ? `${PLAZA_CONTEST}에 등록` : '코디 등록'}
    </button>
  )

  const body = (
    <div className={clsx('pb-scroll', styles.upBody, mobile && styles.upBodyM)}>
      {/* 올릴 프리셋 */}
      <div>
        <div className={clsx(styles.label, styles.labelWide)}>올릴 프리셋</div>
        <div ref={pickRef} className={styles.pickWrap}>
          <button type="button" onClick={() => setPickOpen((v) => !v)} title="등록할 프리셋 선택" aria-expanded={pickOpen}
            className={clsx('pb-ddbtn', styles.pickBtn, pickOpen && styles.pickOpen)}>
            <span className={styles.pickText}>{current ? current.name : '프리셋을 골라주세요'}</span>
            <span className={clsx(styles.pickCaret, pickOpen && styles.caretOpen)}>▾</span>
          </button>
          <div className={clsx('pb-scroll', 'pb-scroll-thin', styles.pickPanel, pickOpen && styles.panelOn)}>
            <div className={clsx(styles.pickGrid, mobile && styles.pickGridM)}>
              {options.map((p) => {
                const ps = snapOf(p.id)
                const on = current?.id === p.id
                return (
                  <button key={p.id} type="button" onClick={() => { setPresetId(p.id); setPickOpen(false) }} title={p.name}
                    className={clsx(styles.pickCell, on && styles.pickCellOn)}>
                    <span className={styles.pickSprite}>{ps && <SnapThumb snap={ps} fraction={PICK_FRACTION} />}</span>
                    <span className={clsx(styles.pickLabel, on && styles.pickLabelOn)}>{p.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 미리보기 */}
      <div className={styles.upStage}>
        <Image src={bg} alt="" fill sizes="360px" className={styles.stageImg} />
        <div className={styles.stageTone} />
        {snap && <SnapThumb snap={snap} fraction={STAGE_FRACTION} />}
      </div>

      {/* 이름 */}
      <div>
        <div className={styles.label}>이름 <span className={styles.star}>*</span></div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={current?.name || '코디 이름'} maxLength={40}
          aria-label="코디 이름" className={clsx('pb-input', styles.field, mobile && styles.fieldM)} />
      </div>

      {/* 설명 */}
      <div>
        <div className={styles.label}>설명</div>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={300} placeholder="어떤 코디인지 짧게 적어주세요"
          aria-label="코디 설명" className={clsx('pb-input', styles.textarea, mobile && styles.textareaM)} />
      </div>

      {/* 태그 */}
      <div>
        <div className={styles.label}>태그</div>
        <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder={`입력 후 Enter (최대 ${PLAZA_TAG_MAX}개)`} aria-label="태그" className={clsx('pb-input', styles.field, mobile && styles.fieldM)} />
        {tags.length > 0 && (
          <div className={styles.tagChips}>
            {tags.map((t) => (
              <button key={t} type="button" onClick={() => setTags(tags.filter((x) => x !== t))} title="태그 삭제" className={styles.tagDel}>#{t} ✕</button>
            ))}
          </div>
        )}
      </div>

      {/* 이미지 */}
      <div>
        <div className={styles.label}>이미지</div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => { if (image) { setImage(null); if (fileRef.current) fileRef.current.value = '' } else fileRef.current?.click() }}
          className={clsx(styles.imgBtn, image && styles.imgBtnOn)}>
          {image ? '이미지 1장 첨부됨 — 지우기' : '이미지 추가'}
        </button>
      </div>

      {/* 등록할 곳 */}
      <div className={styles.scopeGroup}>
        <div>
          <div className={clsx(styles.label, styles.labelWide)}>등록할 곳 {contest && <span className={styles.star}>*</span>}</div>
          <div ref={scopeRef} className={styles.pickWrap}>
            <button type="button" onClick={() => setScopeOpen((v) => !v)} title="등록할 곳 선택" aria-expanded={scopeOpen}
              className={clsx('pb-ddbtn', styles.scopeBtn, contest && styles.scopeContest, scopeOpen && styles.scopeOpen)}>
              <span className={styles.scopeText}>
                <span className={styles.scopeName}>{contest ? PLAZA_CONTEST : '코디 광장'}</span>
                <span className={styles.scopeHint}>{contest ? '대회 출품으로 등록, 이메일 필요' : '누구나 볼 수 있게 공개로 등록'}</span>
              </span>
              <span className={clsx(styles.scopeCaret, scopeOpen && styles.scopeCaretOpen)}>›</span>
            </button>
            <div className={clsx(styles.scopePanel, scopeOpen && styles.panelOn)}>
              {([{ v: 'all', label: '코디 광장', hint: '누구나 볼 수 있게 공개로 등록' }, { v: 'contest', label: PLAZA_CONTEST, hint: '대회 출품으로 등록, 이메일 필요' }] as const).map((o) => (
                <button key={o.v} type="button" onClick={() => { setScope(o.v); setScopeOpen(false) }}
                  className={clsx(styles.scopeOpt, (o.v === 'contest') === contest && styles.scopeOptOn)}>
                  <span className={styles.scopeName}>{o.label}</span>
                  <span className={styles.scopeHint}>{o.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {contest && (
          <div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" inputMode="email" aria-label="이메일"
              className={clsx('pb-input', styles.field, mobile && styles.fieldM)} />
            <div className={styles.emailHint}>당첨 안내용으로만 사용해요</div>
          </div>
        )}
      </div>

      {mobile && <div className={styles.submitWrapM}>{submitBtn}</div>}
    </div>
  )

  if (mobile) return body
  return (
    <section className={clsx(styles.upCol, s.bp === 'half' && styles.upColHalf, s.bp === 'tablet' && styles.upColTablet, narrow && undefined)}>
      <div className={styles.upPanel}>
        <div className={styles.upHead}><span className={styles.upTitle}>내 코디 등록</span></div>
        {body}
        <div className={styles.upFoot}>{submitBtn}</div>
      </div>
    </section>
  )
}
