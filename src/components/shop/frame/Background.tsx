import SceneCanvas from '../scene/SceneCanvas'
import sceneStyles from '../scene/scene.module.css'

// 앱 배경: 실제 시각에 따라 바뀌는 도트 하늘(scene/). 모바일은 화면 전체가 흰 컬럼에 덮여 보이지 않으므로 띄우지 않는다.
export default function Background({ mobile }: { mobile: boolean }) {
  if (mobile) return null
  return <SceneCanvas kind="sky" className={sceneStyles.app} />
}
