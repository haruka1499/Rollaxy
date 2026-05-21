'use strict';

// ============================================================
// PLAYER — GA4 イベント / プレイヤーID / 表示名管理
// ============================================================

// すべての gtag('event', ...) はこの関数を経由することで
// ・呼び出し漏れチェック（typeof gtag）
// ・パラメータ共通化（game_id 等）
// ・将来のイベント名変更をここ1か所で吸収できる。
function logEvent(eventName, params = {}) {
  if (typeof gtag !== 'function') return;
  gtag('event', eventName, params);
}

// ============================================================
// プレイヤー識別（ゲストID）
// フォーマット: guest_{12文字英数字}
// 将来の Google/Discord/NOVORA ログイン統合時は novora_player_id を上書きするだけ
// ============================================================
const _ID_CHARS_LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';

function getPlayerId() {
  let id = localStorage.getItem('novora_player_id');
  if (!id) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)),
      b => _ID_CHARS_LOWER[b % _ID_CHARS_LOWER.length]).join('');
    id = `guest_${rand}`;
    localStorage.setItem('novora_player_id', id);
  }
  return id;
}

// ── 表示名（ランキングに載る名前・日本語可・最大15文字） ──
const DISPLAY_NAME_MAX = 15;

const _GUEST_PREFIX = { ja: 'ゲスト_', en: 'guest_', zh: '访客_' };

function getDisplayName() {
  let name = localStorage.getItem('novora_display_name');
  if (!name) {
    // 初回: 言語に合わせたプレフィックス + player_id サフィックス先頭6文字
    const pid    = getPlayerId();
    const suffix = pid.includes('_') ? pid.split('_').slice(1).join('').slice(0, 6) : pid.slice(0, 6);
    const prefix = _GUEST_PREFIX[typeof currentLang !== 'undefined' ? currentLang : 'en'] ?? 'guest_';
    name = prefix + suffix;
    localStorage.setItem('novora_display_name', name);
  }
  return name;
}

function saveDisplayName(rawName) {
  const name = rawName.replace(/[<>"&]/g, '').trim().slice(0, DISPLAY_NAME_MAX);
  if (name.length === 0) return false;
  localStorage.setItem('novora_display_name', name);
  localStorage.setItem('novora_name_set', '1');
  return true;
}

// 表示名をサーバーの players テーブルに即時同期
// ゲームプレイ時は share POST で自動 upsert されるが、
// 設定・プロフィールページでの変更はこちらで明示的に送信する
async function syncDisplayNameToServer() {
  try {
    await fetch('/api/rollaxy/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: getPlayerId(), display_name: getDisplayName() }),
    });
  } catch (_) {}
}

// ゲストコード（player_id のサフィックス部分を表示用に取り出す）
function getGuestCode() {
  const pid = getPlayerId();
  return pid.includes('_') ? pid.split('_').slice(1).join('') : pid;
}

// 自分のシェアID一覧を localStorage に追記（最大50件）
// ベストスコア更新時は best_share_id / best_score も更新
function addMyShareId(shareId, currentScore) {
  const ids = JSON.parse(localStorage.getItem('novora_share_ids') || '[]');
  if (!ids.includes(shareId)) ids.push(shareId);
  localStorage.setItem('novora_share_ids', JSON.stringify(ids.slice(-50)));
  const best = Number(localStorage.getItem('novora_best_score') || 0);
  if (currentScore >= best) {
    localStorage.setItem('novora_best_score', String(currentScore));
    localStorage.setItem('novora_best_share_id', shareId);
  }
}
