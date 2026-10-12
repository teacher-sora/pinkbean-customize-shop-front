import clsx from 'clsx'
import Image from 'next/image'
import { Fragment } from 'react'
import { SCENE_SRC, STILL } from '@/components/shop/scene/sceneSrc'
import type { SeoPage } from '@/lib/seoPages'
import styles from './guide.module.css'

// 안내 글의 틀. 검색엔진이 읽으라고 둔 글이라(정식 페이지가 아니다) 가볍게 둔다:
// 배경은 15번가 거리의 움직이지 않는 그림 석 장(먼 빌딩, 탑, 거리)이고 WebGL 장면은 띄우지 않는다. 본문은 서버가 그려 HTML 에 담긴다.
export default function GuideShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <div aria-hidden className={styles.street}>
        {STILL.sky.map((l) => (
          <Image key={l.i} src={SCENE_SRC.sky[l.i]} alt="" width={l.w} height={l.h} unoptimized loading="lazy" draggable={false} className={styles.still} style={l.style} />
        ))}
      </div>
      <div className={styles.col}>
        <header className={styles.head}>
          <a href="/" title="핑크빈 커마샵으로" className={styles.logo}>
            <Image src="/logo.png" alt="핑크빈 커마샵 로고" width={30} height={30} priority className={styles.logoImg} />
            <span className={styles.logoText}>핑크빈 커마샵</span>
          </a>
          <OpenShop />
        </header>
        <main className={styles.panel}>{children}</main>
      </div>
    </div>
  )
}

export function OpenShop({ big }: { big?: boolean }) {
  return <a href="/" className={clsx('pb-solid', styles.open, big && styles.openBig)}>커마샵 열기</a>
}

// 글마다 붙는 알림: 이 글은 정식 페이지가 아니고, 적힌 기능은 모두 홈에서 쓴다.
export function GuideNote() {
  return (
    <p className={styles.note}>
      검색을 위해 둔 안내 글이며 정식 페이지가 아닙니다.<br />
      여기 적힌 기능은 모두 <a href="/">핑크빈 커마샵</a>에서 바로 쓸 수 있습니다.
    </p>
  )
}

// 문장마다 줄을 바꾼다(한 문단이 한 덩어리로 흐르지 않게).
export function Lines({ text }: { text: string }) {
  const parts = text.split(/(?<=[.?!])\s+/)
  return <>{parts.map((t, i) => <Fragment key={i}>{i > 0 && <br />}{t}</Fragment>)}</>
}

export function GuideList({ pages }: { pages: SeoPage[] }) {
  return (
    <ul className={styles.list}>
      {pages.map((p) => (
        <li key={p.slug}>
          <a href={`/guide/${p.slug}`} className={styles.item}>
            <span className={styles.itemT}>{p.h1}</span>
            <span className={styles.itemD}>{p.summary}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
