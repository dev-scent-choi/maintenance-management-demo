# 유지보수사이트 — 데모

시설/설비 유지보수 관리 시스템 프론트엔드 포트폴리오 데모입니다. 백엔드 없이 목업 데이터로 전체 UI를 체험할 수 있습니다.

**Live Demo:** https://dev-scent-choi.github.io/maintenance-management-demo/

## 데모 계정

- 일반 사용자 — 아이디: `dohyun.kim` (또는 목업 데이터의 다른 사용자), 비밀번호: `demo1234`, 인증코드: `123456`
- 관리자 — 아이디: `admin`, 비밀번호: `admin1234`

전체 계정 목록은 `src/mocks/data/users.ts`를 참고하세요.

## 로컬 실행

```bash
npm install
npm run dev
```

`src/mocks/mockFetch.ts`가 `fetch`를 가로채 목업 데이터를 반환하므로 별도의 백엔드/DB 설정이 필요 없습니다.

## 참고

- 파일 업로드가 필요한 일부 기능(OCR, PPT/엑셀/도면 뷰어, 실시간 협업 채팅 등)은 정적 샘플로 대체되어 있습니다.
- 이 저장소는 포트폴리오 공개용으로 정리된 프론트엔드 전용 스냅샷입니다.
