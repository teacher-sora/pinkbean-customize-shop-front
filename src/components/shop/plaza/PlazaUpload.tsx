'use client'

// 내 코디 등록 — PC·절반·태블릿은 오른쪽 컬럼에 상주, 모바일은 목록 자리에서 바뀐다(핸드오프 §3).
// 순서: 올릴 프리셋(3열 팝오버) → 미리보기 → 이름* → 설명 → 태그(최대 10) → 이미지(선택) → 등록할 곳*(위로 펼침) → (대회) 이메일 → 등록.
// 필수값이 비면 등록 버튼은 비활성(연한 핑크). `*` 는 라벨에만 붙이고 placeholder 에는 넣지 않는다.

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import bg from '@/assets/pinkbean-bg.png'
import { PLAZA_CONTEST, PLAZA_CONTEST_MAX, PLAZA_OPEN, PLAZA_TAG_MAX, type RefView } from '@/lib/plaza'
import { isNarrow } from '@/lib/useBreakpoint'
import SnapThumb from '../SnapThumb'
import { sameLook } from '@/lib/plazaLook'
import { isCustomSnapshot, useShop, type Snapshot } from '../ShopContext'
import { IconCaretDown } from '../ui/Icons'
import PlazaRefViewer from './PlazaRefViewer'
import styles from './plaza.module.css'

const STAGE_FRACTION = 0.46

export default function PlazaUpload({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const narrow = isNarrow(s.bp)
  const [presetId, setPresetId] = useState(s.selectedPreset ?? s.presets[0]?.id ?? '')
  const [pickOpen, setPickOpen] = useState(false)
  const [pickSeen, setPickSeen] = useState(false) // 썸네일은 처음 열 때 한 번만 그리기 시작한다(닫혀 있는 동안 캔버스 20장을 굽지 않게)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imageView, setImageView] = useState<RefView | null>(null) // 상세를 처음 열었을 때 보일 자리
  // 고른 파일을 편집기에 보여 줄 주소(바꾸거나 지우면 이전 주소는 해제한다)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!image) { setImageUrl(null); return }
    const u = URL.createObjectURL(image)
    setImageUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [image])
  const clearImage = () => { setImage(null); setImageView(null); if (fileRef.current) fileRef.current.value = '' }
  const [scope, setScope] = useState<'all' | 'contest' | null>(null)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [email, setEmail] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<HTMLDivElement>(null)

  // 하단 필터를 대회로 두면 등록할 곳도 대회를 따라간다(사용자가 직접 고르면 그 선택 유지).
  const contest = (scope ?? (s.plazaFilter === 'contest' ? 'contest' : 'all')) === 'contest'
  // **직접 꾸민 프리셋만** 보여준다(기본 코디 그대로인 칸은 올릴 게 없다 — 사용자 지시 2026-09-21).
  // 선택된 칸은 자동저장 전이라도 지금 화면의 코디로 판단한다.
  const snapOf = (id: string): Snapshot | null => (id === s.selectedPreset ? s.snapshot() : s.presetData[id] ?? null)
  const options = useMemo(
    () => s.presets.filter((p) => { const sn = snapOf(p.id); return !!sn && isCustomSnapshot(sn) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.presets, s.presetData, s.selectedPreset, s.equipped, s.tone, s.dyePalette, s.dyeHsb, s.hidden, s.dotPos],
  )
  const current = options.find((p) => p.id === presetId) || options[0] || null
  const snap = current ? snapOf(current.id) : null
  const finalName = (name || current?.name || '').trim()
  // 대회는 기기(익명 세션)당 3개까지. 여기 셈은 안내용이고, 실제로 막는 건 DB 트리거다(supabase/0006).
  const myContest = s.plazaPosts.filter((p) => p.mine && p.contest).length
  const contestLeft = Math.max(0, PLAZA_CONTEST_MAX - myContest)
  const contestFull = contest && contestLeft === 0
  // 대회는 **같은 조합을 한 번만** 받는다(선점). 이미 올라온 출품작과 지문이 같으면 미리 막고 알린다.
  // 여기는 지금 불러온 목록 기준 안내이고, 실제로 막는 건 DB(0007 — 유일 인덱스 + 트리거)다.
  const taken = useMemo(() => {
    if (!contest || !snap) return null
    return s.plazaPosts.find((p) => p.contest && sameLook(p.snapshot, snap)) || null
  }, [contest, snap, s.plazaPosts])
  const canSubmit = !!current && !!snap && !!finalName && (!contest || /.+@.+\..+/.test(email)) && !contestFull && !taken && !s.plazaSubmitting

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
    if (contestFull) { s.notify(`${PLAZA_CONTEST}에는 이 기기에서 ${PLAZA_CONTEST_MAX}개까지 올릴 수 있어요`); return }
    if (taken) { s.notify('같은 조합이 이미 대회에 출품돼 있어요'); return }
    if (!canSubmit || !snap) { s.notify(contest ? '이메일을 확인해 주세요' : '프리셋과 이름을 확인해 주세요'); return }
    const ok = await s.plazaSubmit({ name: finalName, description: desc.trim(), tags, snapshot: snap, contest, email: contest ? email.trim() : '', image, imageView })
    if (ok) { setName(''); setDesc(''); setTags([]); setTagDraft(''); clearImage() }
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
          <button type="button" onClick={() => { setPickOpen((v) => !v); setPickSeen(true) }} title="등록할 프리셋 선택" aria-expanded={pickOpen}
            className={clsx('pb-ddbtn', styles.pickBtn, pickOpen && styles.pickOpen)}>
            <span className={styles.pickText}>{current ? current.name : '꾸민 프리셋이 없어요'}</span>
            <IconCaretDown size={13} className={clsx(styles.pickCaret, pickOpen && styles.caretOpen)} />
          </button>
          <div className={clsx(styles.pickPanel, pickOpen && styles.panelOn)}>
            {/* 3열 격자 — 꾸민 프리셋이 한눈에 들어오게. 썸네일 + 이름(좁으면 이름은 한 줄 말줄임). */}
            <div className={clsx('pb-scroll', 'pb-scroll-thin', styles.pickGrid, mobile && styles.pickGridM)}>
              {options.length === 0 && <p className={styles.pickEmpty}>프리셋 탭에서 코디를 꾸미면 여기에 나와요.</p>}
              {options.map((p) => {
                const sn = snapOf(p.id)
                return (
                  <button key={p.id} type="button" onClick={() => { setPresetId(p.id); setPickOpen(false) }} title={p.name}
                    className={clsx(styles.pickCell, current?.id === p.id && styles.pickCellOn)}>
                    {/* 칸 88px · 0.62 → DPR 1·2·3 모두 인물 64px(정수 배율). 머리·발이 잘리지 않는다. */}
                    <span className={styles.pickThumb}>{pickSeen && sn && <SnapThumb snap={sn} fraction={0.62} />}</span>
                    <span className={styles.pickName}>{p.name}</span>
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
          aria-label="코디 이름" className={clsx('pb-input', styles.field, styles.nameField, mobile && styles.fieldM)} />
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
        {/* 입력칸 옆 '추가' — Enter 를 몰라도(모바일 키보드) 눌러서 단다(2026-09-21 사용자 지시).
            AI 코디 검색(입력 + 옆 솔리드 버튼)과 같은 모양: 안에 끼운 26px 버튼보다 누르기 쉽고 글자 자리도 넓다.
            누를 때 입력칸 포커스를 뺏지 않아 모바일 키보드가 내려가지 않고 이어서 칠 수 있다. */}
        <div className={styles.tagField}>
          <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder={`입력 후 Enter (최대 ${PLAZA_TAG_MAX}개)`} aria-label="태그" className={clsx('pb-input', styles.field, styles.tagInput, mobile && styles.fieldM)} />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addTag} disabled={!tagDraft.trim()} title="태그 추가"
            className={clsx('pb-solid', styles.tagAdd, !tagDraft.trim() && styles.tagAddOff)}>추가</button>
        </div>
        {tags.length > 0 && (
          <div className={styles.tagChips}>
            {tags.map((t) => (
              // 바깥 버튼은 자리만 잡고(hover 판정 고정), 안쪽 알약만 살짝 줄어 '누르면 사라진다'를 암시한다.
              <button key={t} type="button" onClick={() => setTags(tags.filter((x) => x !== t))} title="태그 삭제" className={styles.tagDel}>
                <span className={styles.tagDelPill}>#{t}<span className={styles.tagDelX} aria-hidden>✕</span></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 이미지 */}
      <div>
        <div className={styles.label}>이미지</div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f) { setImage(f); setImageView(null) } }} />
        {/* 칸은 고르기 전부터 편집기 크기 그대로 잡아 둔다 — 이미지를 넣어도 아래 요소가 밀리지 않는다(2026-09-21).
            이미지를 고르면 끌고 확대해 **처음 보일 부분**을 가운데 정사각형 점선에 맞춘다(원본은 자르지 않는다).
            아래 줄도 늘 자리를 차지하고, 이미지가 없을 땐 보이지만 않는다. */}
        {imageUrl ? (
          <div className={styles.upRefBox}><PlazaRefViewer src={imageUrl} edit onChange={setImageView} /></div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className={clsx(styles.upRefBox, styles.imgBtn)}>
            <span className={styles.imgBtnMain}>이미지 추가</span>
            <span className={styles.imgBtnSub}>코스프레 원본처럼 나란히 비교할 그림</span>
          </button>
        )}
        <div className={clsx(styles.upRefFoot, !imageUrl && styles.upRefFootOff)} aria-hidden={!imageUrl}>
          <span className={styles.upRefHint}>처음 보일 부분을 맞춰 주세요</span>
          <button type="button" tabIndex={imageUrl ? 0 : -1} onClick={() => fileRef.current?.click()} className={styles.upRefBtn}>변경</button>
          <button type="button" tabIndex={imageUrl ? 0 : -1} onClick={clearImage} className={clsx(styles.upRefBtn, styles.upRefDel)}>제거</button>
        </div>
      </div>

      {/* 등록할 곳 */}
      <div className={styles.scopeGroup}>
        <div>
          <div className={clsx(styles.label, styles.labelWide)}>등록할 곳 {contest && <span className={styles.star}>*</span>}</div>
          <div ref={scopeRef} className={styles.pickWrap}>
            <button type="button" onClick={() => setScopeOpen((v) => !v)} title="등록할 곳 선택" aria-expanded={scopeOpen}
              className={clsx('pb-ddbtn', styles.pickBtn, contest && styles.pickContest, scopeOpen && styles.pickOpen)}>
              <span className={styles.pickText}>{contest ? PLAZA_CONTEST : PLAZA_OPEN}</span>
              <IconCaretDown size={13} className={clsx(styles.pickCaret, scopeOpen && styles.caretOpen)} />
            </button>
            {/* 폼 맨 아래에 있는 항목이라 위(빈 공간이 많은 쪽)로 펼친다. */}
            <div className={clsx(styles.pickPanel, styles.pickPanelUp, scopeOpen && styles.panelOn)}>
              <div className={styles.pickList}>
                {([{ v: 'all', label: PLAZA_OPEN }, { v: 'contest', label: PLAZA_CONTEST }] as const).map((o) => (
                  <button key={o.v} type="button" onClick={() => { setScope(o.v); setScopeOpen(false) }}
                    className={clsx(styles.pickOpt, (o.v === 'contest') === contest && styles.pickOptOn)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={clsx(styles.scopeHint, (contestFull || taken) && styles.scopeHintWarn)}>
            {!contest ? '누구나 볼 수 있게 공개로 등록해요.'
              : contestFull ? `이 기기에서는 이미 ${PLAZA_CONTEST_MAX}개를 올렸어요.`
              : taken ? `[${taken.name}] 똑같은 조합이 이미 있어요! 같은 조합으로는 못 올려요.`
              : `대회 출품으로 등록해요. 이메일이 필요하고, ${contestLeft}개 더 올릴 수 있어요.`}
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

    </div>
  )

  // 모바일은 목록 자리에서 폼으로 바뀌므로, 닫기도 폼 안에 있어야 한다(위쪽 '닫기'만으로는 멀다 — 사용자 지시).
  // PC 는 오른쪽에 상주하는 컬럼이라 닫을 대상이 없어 등록만 둔다.
  if (mobile) return (
    <>
      {body}
      <div className={styles.upFootM}>
        <button type="button" onClick={() => s.setPlazaUpload(false)} className={clsx('pb-soft', styles.upCloseM)}>닫기</button>
        <div className={styles.upSubmitM}>{submitBtn}</div>
      </div>
    </>
  )
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
