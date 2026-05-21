// ============================================================
// AUTH — JWT ユーティリティ（HMAC-SHA256）
// Workers の crypto.subtle を使用。外部ライブラリ不要。
// ============================================================

const _ENC = new TextEncoder();

function _b64url(buffer) {
  const bytes = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(s + '='.repeat((4 - s.length % 4) % 4));
}

async function _hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', _ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  );
}

// JWT を生成して返す（HS256）
export async function signJwt(payload, secret) {
  const key    = await _hmacKey(secret);
  const header = _b64url(_ENC.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = _b64url(_ENC.encode(JSON.stringify(payload)));
  const data   = `${header}.${body}`;
  const sig    = await crypto.subtle.sign('HMAC', key, _ENC.encode(data));
  return `${data}.${_b64url(sig)}`;
}

// JWT を検証してペイロードを返す。無効・期限切れなら null
export async function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const key  = await _hmacKey(secret);
    const data = `${parts[0]}.${parts[1]}`;
    const sig  = Uint8Array.from(_b64urlDecode(parts[2]), c => c.charCodeAt(0));
    const ok   = await crypto.subtle.verify('HMAC', key, sig, _ENC.encode(data));
    if (!ok) return null;
    const payload = JSON.parse(_b64urlDecode(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}
