'use strict';

// ============================================================
// SHARE — シェアページ投稿・X（Twitter）シェア
// ============================================================
const shareBtn = document.getElementById('share-btn');

function _restoreShareButton() {
  shareBtn.disabled = false;
  shareBtn.textContent = T('shareBtn');
  shareBtn.classList.remove('loading');
}

// 盤面スナップショットを Worker に POST して共有 URL を取得する（失敗しても UI に影響しない）
// 成功・失敗どちらでも finally でシェアボタンを復元する。
async function _createShare() {
  const controller  = new AbortController();
  const timeoutId   = setTimeout(() => controller.abort(), 10000);
  // await 前に同期収集（_startGameOverAnim() が非同期で bmap を消していく前に取得）
  const elapsed_ms  = Date.now() - _gameStartTime;
  const drop_count  = _dropCount;
  let highestTier = 0;
  const bodies = [];
  for (const d of bmap.values()) {
    if (d.bi > highestTier) highestTier = d.bi;
    bodies.push({
      tier:  d.bi,
      x:     Math.round(d.body.position.x * 10) / 10,
      y:     Math.round(d.body.position.y * 10) / 10,
      angle: Math.round(d.body.angle * 100) / 100,
    });
  }
  const shareScore = score; // クロージャ保持（addMyShareId 用）
  try {
    const res = await fetch('/api/rollaxy/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score,
        highest_body_tier: highestTier,
        snapshot_payload:  {
          bodies,
          // replay / anti-cheat metadata（将来の server-side validation 用）
          elapsed_ms,
          drop_count,
          body_count: bodies.length,
        },
        ui_lang:       typeof currentLang !== 'undefined' ? currentLang : 'ja',
        version:       CFG.GAME_VERSION,
        player_id:     getPlayerId(),    // guest_xxx 形式（将来ログイン統合時は差し替え）
        display_name:  getDisplayName(), // ランキングに表示する表示名
        session_token: typeof _sessionToken !== 'undefined' ? _sessionToken : null,
      }),
      signal: controller.signal,
    });
    if (res.ok) {
      const { id } = await res.json();
      _pendingShareId = id;
      addMyShareId(id, shareScore); // share_ids / best_share_id を localStorage に記録
      // OGP 画像生成を完了まで待つ（最大 8 秒）
      // fire-and-forget ではなく await することで、_restoreShareButton() が呼ばれる時点で
      // 必ず KV キャッシュに乗っている状態を保証する。
      // → Twitter クローラーがシェア URL にアクセスした時に画像が確実に存在する。
      // タイムアウトしても finally でボタンは有効化されるので UI はブロックしない。
      try {
        const ogpCtrl    = new AbortController();
        const ogpTimeout = setTimeout(() => ogpCtrl.abort(), 8000);
        await fetch(`/games/rollaxy/ogp/${id}`, { signal: ogpCtrl.signal });
        clearTimeout(ogpTimeout);
      } catch (_) {
        // タイムアウト or ネットワークエラー → OGP なしでシェア可能（URL は有効）
      }
    }
  } catch (_) {
    // タイムアウト・ネットワークエラー等 → フォールバックURLでシェア可能
  } finally {
    clearTimeout(timeoutId);
    _restoreShareButton();
  }
}

// ============================================================
// X（Twitter）シェア
// canvas.toDataURL()（同期）でキャプチャし、非同期処理を一切挟まないことで
// ポップアップブロッカーを回避する。
// ① Twitter Intent を先に開く（ユーザー操作直後の最初のアクション）
// ② 盤面画像をダウンロード（ツイートに手動添付できるよう）
// 定型文は lang.js の tweetText、URL は CFG.SHARE.URL で変更可能。
// ============================================================

// data URL → Blob 同期変換（ユーザージェスチャーコンテキストを保つため同期で行う）
function _dataURLtoBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function shareToX() {
  logEvent('share_click', {
    game_id:       'rollaxy',
    score,
    has_share_url: _pendingShareId ? 1 : 0, // OGP付きURLが発行済みか
  });
  const text    = T('tweetText')(score);
  // 共有 URL: 個別シェアページ（生成済み）> ゲームトップページ > なし
  // サーバー側で OGP 画像を生成するので canvas スクショは不要
  const shareId  = _pendingShareId;
  const shareUrl = shareId
    ? `${CFG.SHARE.URL.replace(/\/$/, '')}/share/${shareId}`
    : (CFG.SHARE.URL || '');

  const tweetUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text)
    + (shareUrl ? '&url=' + encodeURIComponent(shareUrl) : '');
  window.open(tweetUrl, '_blank');
}

shareBtn.addEventListener('click',    () => shareToX());
shareBtn.addEventListener('touchend', e => { e.preventDefault(); shareToX(); });
