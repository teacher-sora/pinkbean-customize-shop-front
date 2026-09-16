import Image from 'next/image'
import bg from '@/assets/pinkbean-bg.png'
import styles from './frame.module.css'

// 배경 3겹 스택: 배경 일러스트(.pb-bg, blur) → 톤 레이어(.pb-tone) → UI.
export default function Background() {
  return (
    <>
      <div className="pb-bg" aria-hidden>
        <Image src={bg} alt="" fill priority sizes="100vw" className={styles.bgImg} />
      </div>
      <div className="pb-tone" aria-hidden />
    </>
  )
}
