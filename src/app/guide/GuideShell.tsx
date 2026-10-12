import clsx from 'clsx'
import Image from 'next/image'
import type { SeoPage } from '@/lib/seoPages'
import GuideScene from './GuideScene'
import styles from './guide.module.css'

// 안내 페이지의 틀: 배경 장면 + 머리(로고 · 커마샵 열기) + 흰 패널. 본문은 서버에서 그려 HTML 에 그대로 담긴다.
export default function GuideShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={clsx('pb-scroll', styles.page)}>
      <GuideScene />
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
