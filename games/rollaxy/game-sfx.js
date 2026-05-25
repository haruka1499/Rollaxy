'use strict';

// ============================================================
// SOUND — 合成効果音（HTMLAudioElement プール + busy フラグ方式）
// paused は play() 直後でも true になる瞬間があるため信頼できない。
// 代わりに _busy フラグで使用中を管理し、ended / play失敗で解放する。
// WAV ファイルは冒頭無音を削除済みのため currentTime seek は不要。
// ============================================================
let sfxVolume = parseFloat(localStorage.getItem(STORAGE_KEYS.SFX_VOL) ?? String(CFG.SOUND.DEFAULT_VOL));
if (!isFinite(sfxVolume) || sfxVolume < 0 || sfxVolume > 1) sfxVolume = CFG.SOUND.DEFAULT_VOL;

const _sfxPool = Array.from({ length: 16 }, () => {
  const a = new Audio('sounds/merge_sound.wav');
  a.preload = 'auto';
  a._busy = false;
  a.addEventListener('ended', () => { a._busy = false; });
  return a;
});
let _sfxPoolIdx = 0;

function playMergeSound(chain) {
  const semitones = Math.min(chain - 1, 6) * 2; // 1〜7連鎖: 0,2,4,6,8,10,12半音
  const rate = Math.pow(2, semitones / 12);
  const vol  = Math.max(0, Math.min(1, sfxVolume));

  // busy でない要素を優先して選ぶ。全て busy なら最も古い要素を上書き
  let chosen = _sfxPoolIdx;
  for (let i = 0; i < _sfxPool.length; i++) {
    const idx = (_sfxPoolIdx + i) % _sfxPool.length;
    if (!_sfxPool[idx]._busy) { chosen = idx; break; }
  }
  _sfxPoolIdx = (chosen + 1) % _sfxPool.length;

  const snd = _sfxPool[chosen];
  snd._busy = true;
  snd.playbackRate = rate;
  snd.volume = vol;
  snd.play().catch(() => { snd._busy = false; });
}

// ── 追加効果音（単発再生） ──
function _makeSfx(path) {
  const a = new Audio(path);
  a.preload = 'auto';
  return a;
}

const _sfxSkillSelect  = _makeSfx('sounds/スキル選択音.wav');
const _sfxBack         = _makeSfx('sounds/戻るときの音全般.wav');
const _sfxUpgrade      = _makeSfx('sounds/指定アップグレード.wav');
const _sfxDelete       = _makeSfx('sounds/指定削除の音.wav');
const _sfxDecision     = _makeSfx('sounds/決定音全般.wav');
const _sfxExplosion    = _makeSfx('sounds/爆発音.wav');
const _sfxNotification = _makeSfx('sounds/通知系の音.wav');

function _playSfx(snd) {
  snd.volume = Math.max(0, Math.min(1, sfxVolume));
  snd.currentTime = 0;
  snd.play().catch(() => {});
}

function playSkillSelectSound()  { _playSfx(_sfxSkillSelect); }
function playBackSound()         { _playSfx(_sfxBack); }
function playUpgradeSound()      { _playSfx(_sfxUpgrade); }
function playDeleteSound()       { _playSfx(_sfxDelete); }
function playDecisionSound()     { _playSfx(_sfxDecision); }
function playExplosionSound()    { _playSfx(_sfxExplosion); }
function playNotificationSound() { _playSfx(_sfxNotification); }

// スタートボタン押下（ユーザー操作）のタイミングで pool[0] を無音で一瞬再生する。
// これによりブラウザの autoplay 制限が解除され、以降 rAF ループ内からも play() が通る。
function _unlockAudio() {
  const snd = _sfxPool[0];
  snd._busy = true;
  const prevVol = snd.volume;
  snd.volume = 0;
  snd.play().then(() => {
    snd.pause();
    snd.volume = prevVol;
    snd._busy = false;
  }).catch(() => {
    snd.volume = prevVol;
    snd._busy = false;
  });
}
