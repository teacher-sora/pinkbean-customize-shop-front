# 핑크빈 커마샵 Front — 작업 가이드 (모든 세션 공통)

메이플 스타일 코디(외형) 세팅 서비스의 프론트엔드. Next.js 14 (App Router) · React 18 · TypeScript.
Vercel에 이 저장소의 `main`을 배포한다.

## 구조
```
src/
  app/            # layout.tsx, page.tsx, globals.css (공유 CSS)
  components/
    PinkbeanShop.tsx      # 조합 루트 (ShopProvider + Shell)
    shop/
      ShopContext.tsx     # 모든 상태·핸들러의 단일 출처 (useShop())
      Header.tsx / CodiScreen.tsx / InfoScreen.tsx / PresetScreen.tsx
      PreviewPanel.tsx / DyeDialog.tsx / Toast.tsx
  lib/
    catalog.ts      # 정적 데이터 + 공유 타입 (부위/팔레트/연출 옵션/상수)
    color.ts        # 염색·색상 계산 (디자인 재현용 근사)
    style.ts        # css() 인라인 헬퍼 + 공유 스타일 빌더
    core/           # ⚠️ 합성·정밀염색 코어 (레거시 아님, CDN 단계에서 연결). core/README.md 참고.
```
상태 추가/변경은 `ShopContext`, 데이터 추가는 `catalog.ts`, 색 계산은 `color.ts`에서.

## 🎨 스타일링 컨벤션 (중요 — 새 작업 시 준수)
현재 화면 코드는 디자인 정본(`design_handoff_pinkbean_shop`)을 충실히 옮기느라 **상태 기반 인라인
스타일**을 `style.ts`의 `css('...')` 문자열로 쓴다. 정본이 hover/선택/열림 상태로 색·보더를 바꾸는
구조라 이렇게 시작했다.

**앞으로 디자인을 바꾸거나 새 컴포넌트를 만들 때는 다음을 우선한다:**
1. **정적 스타일**(레이아웃/컨테이너/타이포 등 상태와 무관한 것)은 컴포넌트 옆에 **`Xxx.module.css`**
   를 만들어 `className`으로 적용한다. (예: `CodiScreen.tsx` ↔ `CodiScreen.module.css`)
2. **상태 기반 동적 스타일**(hover/선택/열림/드래그 오프셋 등)만 인라인(`css()` 또는 CSS 변수)로 둔다.
   토글되는 값은 CSS 변수(`style={{ '--x': ... }}`)로 넘기고 나머지는 module.css에서 처리하면 깔끔하다.
3. 여러 컴포넌트가 공유하는 원시 스타일/애니메이션(스크롤바, 카드 hover, 다이얼로그 애니메이션,
   `pb-select`, 아코디언 등)은 이미 `app/globals.css`에 있으니 재사용한다.
4. 기존 `css()` 인라인을 **대량으로 한꺼번에 module.css로 옮기지는 말 것**(시각 회귀 위험). 대신
   **건드리는 컴포넌트부터 점진적으로** 위 규칙으로 전환한다.

판단이 애매하면: "상태에 따라 바뀌는가?" → 예면 인라인, 아니면 module.css.

## 데이터 / CDN (현 단계 = 디자인 재현)
- 지금 아이템/캐릭터는 **플레이스홀더**(mock 60종, 점선 미리보기, 근사 염색).
- CDN 연동 단계에서: `NEXT_PUBLIC_DATA_BASE`(기본값 이미 R2 CDN `https://cdn.pinkbean-customize.com`)로
  index/slots/meta 로드 → 미리보기를 `lib/core`(assemble/render/dye)로 실제 스프라이트 합성·정밀염색.
- 임포트: 닉네임=넥슨 OpenAPI, 코드=Supabase 공유코드(백엔드는 `../back` 예정).

## 명령
```bash
npm install
npm run dev      # http://localhost:80  (포트 80)
npm run build    # 프로덕션 빌드/타입체크 검증 — 커밋 전 통과 확인
```

## 커밋
- git 신원은 이 저장소 로컬 config에 `teacher-sora <sora05153@gmail.com>` 로 설정돼 있다(멀티계정 주의).
- 작업 브랜치에서 커밋·푸시 후 `main`에 병합하는 흐름을 따른다.
