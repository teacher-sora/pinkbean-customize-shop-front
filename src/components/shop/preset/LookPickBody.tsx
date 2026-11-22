'use client'

// 닉네임으로 불러온 코디 고르기(서피스 'look' 본문). 늘 지금 코디를 가져온다 — 시점(날짜) 고르기는 없다.
// 짜임은 코디 프로필 창과 같다: PC · 절반 · 태블릿은 왼쪽 = 치장 프리셋 카드, 오른쪽 = 설정 줄. 모바일은 설정 줄이 위, 카드가 아래 —
//   두 벌의 프리셋 수가 달라 카드 줄 수가 바뀌어도 설정 줄이 밀리지 않게.
// 카드는 공유받은 코디 창과 같은 부품(plaza/PlazaTakeBody 의 PickCard + SnapThumb), 설정 줄은 코디 프로필의 줄(라벨 + 스위치)이다.
// 카드를 누르면 그 한 벌을 지금 프리셋에 넣고 닫는다(ShopContext.chooseLook).

import clsx from 'clsx'
import { useState } from 'react'
import { readUiPref, writeUiPref } from '@/lib/uiState'
import { PickCard } from '../plaza/PlazaTakeBody'
import SnapThumb from '../SnapThumb'
import { CARD_FIT_W_M, PRESET_FRACTION, PRESET_FRACTION_M } from '@/lib/shopData'
import { NICK_TAKE_SLOTS, useShop, type LookOption, type Snapshot } from '../ShopContext'
import { Seg, Switch } from '../ui/controls'
import styles from './lookPick.module.css'

// 켤 수 없는 까닭(그 벌에 그 장식이 없다)
const NONE: Record<string, string> = { title: '칭호가 없어요', nameTag: '명찰이 없어요', medal: '훈장이 없어요', chatBalloon: '말풍선이 없어요' }

export default function LookPickBody({ nick, options, mobile }: { nick: string; options: LookOption[]; mobile: boolean }) {
  const s = useShop()
  // 두 벌(제로 알파/베타, 엔젤릭버스터 일반/드레스업)이면 처음에는 두 번째 벌
  const [lookKey, setLookKey] = useState(() => (options.find((o) => o.key === 'additional') ?? options[0])?.key ?? '')
  const look = options.find((o) => o.key === lookKey) ?? options[0]
  // 가져올 장식 — 고른 값은 늘 유지(lib/uiState 의 UiPref.nickTake). 기본은 꺼짐(사용자 지시) — 켠 것만 가져온다
  const [take, setTake] = useState<Record<string, boolean>>(() => readUiPref().nickTake ?? {})
  const flip = (slot: string) => { const n = { ...take, [slot]: take[slot] !== true }; setTake(n); writeUiPref({ nickTake: n }) }
  if (!look) return null
  // 꺼 둔 장식은 빼고 그린다 — 스위치가 무엇을 바꾸는지 카드에서 바로 보인다(가져올 때도 같은 규칙 — chooseLook)
  const takeSnap = (sn: Snapshot): Snapshot => { const eq = { ...sn.equipped }; for (const t of NICK_TAKE_SLOTS) if (take[t.slot] !== true) delete eq[t.slot]; return { ...sn, equipped: eq } }

  const side = (
    <div className={mobile ? styles.sideM : clsx('pb-scroll', 'pb-gutter', 'pb-fade', styles.side)}>
      {options.length > 1 && <>
        <div className={styles.group}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>코디</span>
            <Seg variant={mobile ? 'mobileFit' : 'pc'} opts={options.map((o) => ({ v: o.key, l: o.label }))} value={look.key} onPick={setLookKey} />
          </div>
        </div>
        <hr className={styles.rule} />
      </>}
      <div className={clsx(styles.group, mobile && styles.decoM)}>
        {NICK_TAKE_SLOTS.map((t) => {
          // 이 벌의 어느 프리셋에도 없는 장식은 켤 수 없다(코디 프로필의 칭호 · 훈장과 같다)
          const has = look.presets.some((p) => !!p.snap.equipped[t.slot])
          return (
            <div key={t.slot} className={styles.row} title={has ? undefined : NONE[t.slot]}>
              <span className={styles.rowLabel}>{t.label}</span>
              <Switch on={has && take[t.slot] === true} onToggle={() => flip(t.slot)} disabled={!has} title={has ? `${t.label} 가져오기` : NONE[t.slot]} />
            </div>
          )
        })}
      </div>
    </div>
  )
  const cards = (
    <div className={mobile ? styles.cardsM : clsx('pb-scroll', 'pb-gutter', 'pb-fade', styles.cards)}>
      <div className={clsx(styles.grid, mobile && styles.gridM)}>
        {look.presets.map((p) => (
          <PickCard key={`${look.key}:${p.key}`} name={p.label} title={`'${p.label}' 가져오기`} onPick={() => s.chooseLook(look.key, p.key)}>
            {/* 명찰은 닉네임으로(명찰 반지가 없으면 기본 명찰 — 사용자 지시) */}
            {/* 프리셋 탭 카드와 같은 캐릭터 비율 — 기본(0.45)이면 켠 칭호가 카드 위로 잘렸다 */}
            <SnapThumb snap={takeSnap(p.snap)} tagName={nick} baseTag deco fraction={mobile ? PRESET_FRACTION_M : PRESET_FRACTION} fitW={mobile ? CARD_FIT_W_M : undefined} />
            {p.active && <span className={styles.badge}>착용 중</span>}
          </PickCard>
        ))}
      </div>
    </div>
  )
  return mobile
    ? <div className={clsx('pb-scroll', 'pb-fade', styles.bodyM)}>{side}{cards}</div>
    : <div className={styles.body}>{cards}{side}</div>
}
