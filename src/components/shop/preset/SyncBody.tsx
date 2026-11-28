'use client'

// 프리셋 동기화(서피스 'sync' — 프리셋 탭 머리의 [동기화]). 로그인하면 이 기기에 저장하는 값 대부분을 계정에 함께 둔다(사용자 지시).
// 짜임은 닉네임으로 불러온 코디 고르기(LookPickBody)와 같다: PC · 절반 · 태블릿은 왼쪽 = 이어 쓰는 것, 오른쪽 = 계정(300px). 모바일은 계정이 위.
// 지금은 dev 에서 자리 · 디자인만 본다 — 로그인 수단(구글 · 카카오 앱 등록)이 없어 단추는 꺼져 있다(까닭은 title).
import clsx from 'clsx'
import styles from './sync.module.css'

// 계정에 함께 두는 것 — 이 기기의 저장소(localStorage) 값과 짝이다(괄호는 키)
const SYNCED: { label: string; sub: string }[] = [
  { label: '프리셋', sub: '100칸의 코디, 이름, 순서' }, // pb_presets_v1
  { label: '북마크', sub: '담아 둔 아이템' }, // pb_bookmarks_v1
  { label: '즐겨찾기', sub: '별을 붙인 아이템' }, // pb_favorites_v1
  { label: '저장한 염색', sub: '염색 창의 보관함' }, // pb_dye_vault_v1
  { label: '코디 비교', sub: '비교 칸의 코디' }, // pb_compare_v2
  { label: '보기 설정', sub: '정렬, 넘기는 방향, 카드 크기' }, // pb_ui_pref_v1
  { label: '카테고리 순서', sub: '부위 줄의 순서' }, // pb_cat_order_v1
  { label: '연출 설정', sub: '액션, 표정, 배율' }, // pb_pv_v1
  { label: '미리보기 배경', sub: '고른 배경, 올린 그림' }, // pb_stage_bg_v1
  { label: '화면', sub: '밝은 화면, 어두운 화면' }, // pb_theme_v1
  { label: '코디 프로필', sub: '카드 디자인, QR' }, // pb_card_theme_v1 · pb_card_qr_v1
  { label: '이미지 저장', sub: '저장 배율' }, // pb_save_scale_v1
]
const OFF = '로그인 준비 중이에요 — 로그인 앱 등록 뒤 열려요'

export default function SyncBody({ mobile }: { mobile: boolean }) {
  const list = (
    <div className={mobile ? styles.cardsM : clsx('pb-scroll', 'pb-gutter', 'pb-fade', styles.cards)}>
      <div className={styles.lead}>로그인하면 기기마다 이어 써요</div>
      <div className={clsx(styles.grid, mobile && styles.gridM)}>
        {SYNCED.map((x) => (
          <div key={x.label} className={styles.cell}>
            <span className={styles.cellLabel}>{x.label}</span>
            <span className={styles.cellSub}>{x.sub}</span>
          </div>
        ))}
      </div>
      <div className={styles.note}>되돌리기 기록과 지금 보던 탭은 기기마다 따로예요</div>
    </div>
  )
  const side = (
    <div className={mobile ? styles.sideM : clsx('pb-scroll', 'pb-gutter', 'pb-fade', styles.side)}>
      <div className={styles.group}>
        <span className={styles.sideTitle}>계정</span>
        <button type="button" disabled title={OFF} className={clsx('pb-soft', styles.login)}>구글로 계속</button>
        <button type="button" disabled title={OFF} className={clsx('pb-soft', styles.login)}>카카오로 계속</button>
        <span className={styles.sideNote}>로그인하지 않으면 지금처럼 이 기기에만 저장돼요</span>
      </div>
    </div>
  )
  return mobile
    ? <div className={clsx('pb-scroll', 'pb-fade', styles.bodyM)}>{side}{list}</div>
    : <div className={styles.body}>{list}{side}</div>
}
