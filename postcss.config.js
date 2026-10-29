// CSS 빌드 단계(Next 가 읽는다). 아래 두 줄 flexbugs · preset-env 는 Next 의 기본값 그대로다(이 파일이 있으면 기본값을 대신한다).
// light-dark(라이트, 다크): 모르는 브라우저(iOS 17.4 이하 사파리 · 그 위의 앱 내 브라우저, 크롬 122 이하, 옛 삼성 인터넷)가 있어
// 빌드에서 CSS 변수 토글로 바꾼다 — 그런 브라우저에서도 같은 색 · 같은 다크 모드(테마 버튼 포함)로 그린다.
//  · preserve: false — 모든 브라우저가 같은 토글로 그린다(light-dark 를 남기면 @supports 블록으로 뒤에 붙어 같은 규칙 안의 선언 순서가 바뀐다).
//  · 소스에 '앞 줄 대체 값'을 따로 적지 않는다 — 플러그인이 그 줄을 보면 변환을 건너뛰고, 압축기(cssnano)가 테두리 계열의 그 줄을 지워
//    옛 브라우저에서 버튼이 기본 테두리(굵은 검은 선)로 보였다(2026-10-29 문의).
//  · 토글은 color-scheme 선언(globals.css 의 :root · data-theme)을 따라 켜진다. 인라인 스타일은 lib/style 의 css() 가 같은 토글을 만든다.
module.exports = {
  plugins: {
    '@csstools/postcss-light-dark-function': { preserve: false },
    'next/dist/compiled/postcss-flexbugs-fixes': {},
    'next/dist/compiled/postcss-preset-env': {
      browsers: ['defaults'],
      autoprefixer: { flexbox: 'no-2009' },
      stage: 3,
      features: { 'custom-properties': false },
    },
  },
}
