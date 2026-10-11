// 배경 장면을 메인 스레드 밖에서 그린다. 하는 일은 sceneCore 에 메시지를 이어 주는 것뿐이다(sceneGl 이 띄운다).
import { createCore, type CoreIn } from './sceneCore'

const scope = self as unknown as { postMessage: (m: unknown) => void; onmessage: ((e: MessageEvent<CoreIn>) => void) | null }
const core = createCore((m) => scope.postMessage(m))
scope.onmessage = (e) => core(e.data)
