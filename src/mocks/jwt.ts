// 데모용 가짜 JWT 생성기 — 실제 백엔드 서명 없이 클라이언트 파싱(jwtUtils.ts)만 통과하면 됨
function base64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function makeFakeJwt(userId: string, hoursValid = 8): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    iat: now,
    exp: now + hoursValid * 3600,
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const fakeSignature = base64url('mock-signature-not-verified');
  return `${encodedHeader}.${encodedPayload}.${fakeSignature}`;
}
