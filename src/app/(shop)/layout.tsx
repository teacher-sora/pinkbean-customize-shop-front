// 앱 본문(ShopHome)은 이 레이아웃에 한 번만 놓는다. 탭마다 주소가 있지만(/, /search, /info, /preset, /plaza, 공유 링크용 /share)
// 그 페이지들은 메타만 내고 본문은 비어 있다 — 어느 주소로 들어오든, 주소 사이를 오가든 앱은 다시 뜨지 않는다.
import ShopHome from '@/components/ShopHome'

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ShopHome />
      {children}
    </>
  )
}
