/* UI 管理：菜单 / 选关 / HUD / 暂停 / 结算 + 存档 */
const UI = (() => {
  const SAVE_KEY = 'furiousFowlSave.v1';
  let save = { unlocked: 1, stars: {}, best: {}, sound: true };

  const $ = id => document.getElementById(id);
  let els = {};
  let hintTimer = 0;

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) save = Object.assign(save, JSON.parse(raw));
    } catch (e) { /* 隐私模式等场景忽略 */ }
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function init() {
    els = {
      menu: $('menu'), levelSelect: $('levelSelect'), hud: $('hud'),
      pauseOverlay: $('pauseOverlay'), result: $('result'),
      lsGrid: $('lsGrid'), lsStars: $('lsStars'),
      hudScore: $('hudScore'), hudLevel: $('hudLevel'), hudHint: $('hudHint'),
      resTitle: $('resTitle'), resStars: $('resStars'), resScore: $('resScore'), resBest: $('resBest'),
      btnResNext: $('btnResNext'),
    };
    loadSave();
    AudioSys.setEnabled(save.sound);

    // 主菜单
    $('btnPlay').onclick = () => { AudioSys.click(); showLevelSelect(); };
    $('btnSound').onclick = () => { toggleSound($('btnSound')); };
    $('btnBackMenu').onclick = () => { AudioSys.click(); hide(els.levelSelect); show(els.menu); };

    // HUD
    $('btnPause').onclick = () => { AudioSys.click(); Game.pause(); syncSoundBtn($('btnPauseSound')); show(els.pauseOverlay); };
    $('btnRestartHud').onclick = () => { AudioSys.click(); startLevel(Game.levelNum); };

    // 暂停面板
    $('btnResume').onclick = () => { AudioSys.click(); hide(els.pauseOverlay); Game.resume(); };
    $('btnRestartPause').onclick = () => { AudioSys.click(); hide(els.pauseOverlay); startLevel(Game.levelNum); };
    $('btnPauseSound').onclick = () => { toggleSound($('btnPauseSound')); };
    $('btnQuitPause').onclick = () => { AudioSys.click(); hide(els.pauseOverlay); quitToSelect(); };

    // 结算面板
    $('btnResMenu').onclick = () => { AudioSys.click(); hide(els.result); quitToSelect(); };
    $('btnResRetry').onclick = () => { AudioSys.click(); hide(els.result); startLevel(Game.levelNum); };
    els.btnResNext.onclick = () => { AudioSys.click(); hide(els.result); startLevel(Game.levelNum + 1); };

    // 游戏回调
    Game.callbacks.onScore = v => { els.hudScore.textContent = v.toLocaleString(); };
    Game.callbacks.onHint = showHint;
    Game.callbacks.onEnd = onLevelEnd;

    syncSoundBtn($('btnSound'));
  }

  function toggleSound(btn) {
    save.sound = !save.sound;
    AudioSys.setEnabled(save.sound);
    persist();
    syncSoundBtn($('btnSound'));
    syncSoundBtn($('btnPauseSound'));
    if (save.sound) AudioSys.click();
  }
  function syncSoundBtn(btn) {
    if (btn) btn.textContent = save.sound ? '🔊 音效：开' : '🔇 音效：关';
  }

  function totalStars() {
    return Object.values(save.stars).reduce((a, b) => a + b, 0);
  }

  function showLevelSelect() {
    hide(els.menu); hide(els.hud); hide(els.result); hide(els.pauseOverlay);
    Game.stop();
    els.lsStars.textContent = `★ ${totalStars()} / ${Levels.count * 3}`;
    const grid = els.lsGrid;
    grid.innerHTML = '';
    for (let i = 1; i <= Levels.count; i++) {
      const def = Levels.get(i);
      const locked = i > save.unlocked;
      const cell = document.createElement('button');
      cell.className = 'ls-cell' + (locked ? ' locked' : '');
      const stars = save.stars[i] || 0;
      cell.innerHTML = locked
        ? `<span class="num">🔒</span>`
        : `<span class="num">${i}</span><span class="name">${def.name}</span>` +
          `<span class="cell-stars">${[1, 2, 3].map(s => `<span class="${s <= stars ? 'on' : ''}">★</span>`).join('')}</span>`;
      if (!locked) cell.onclick = () => { AudioSys.click(); startLevel(i); };
      grid.appendChild(cell);
    }
    show(els.levelSelect);
  }

  function startLevel(n) {
    if (n > Levels.count) { showLevelSelect(); return; }
    hide(els.menu); hide(els.levelSelect); hide(els.result); hide(els.pauseOverlay);
    show(els.hud);
    els.hudScore.textContent = '0';
    els.hudLevel.textContent = `第 ${n} 关 · ${Levels.get(n).name}`;
    hideHint();
    Game.loadLevel(n);
  }

  function quitToSelect() {
    showLevelSelect();
  }

  function showHint(text) {
    els.hudHint.textContent = text;
    show(els.hudHint);
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHint, 4000);
  }
  function hideHint() { hide(els.hudHint); }

  function onLevelEnd({ won, score, stars, level }) {
    hideHint();
    if (won) {
      save.unlocked = Math.max(save.unlocked, Math.min(level + 1, Levels.count));
      save.stars[level] = Math.max(save.stars[level] || 0, stars);
      const prevBest = save.best[level] || 0;
      save.best[level] = Math.max(prevBest, score);
      persist();

      els.resTitle.textContent = level === Levels.count ? '通关全部关卡！' : '过关！';
      els.resScore.textContent = `得分：${score.toLocaleString()}`;
      els.resBest.textContent = score > prevBest && prevBest > 0 ? '🎉 新纪录！' : (prevBest > 0 ? `最佳：${Math.max(prevBest, score).toLocaleString()}` : '');
      const spans = els.resStars.querySelectorAll('span');
      spans.forEach((sp, i) => sp.classList.toggle('on', i < stars));
      show(els.resStars);
      if (level < Levels.count) show(els.btnResNext); else hide(els.btnResNext);
    } else {
      els.resTitle.textContent = '小猪在嘲笑你…';
      els.resScore.textContent = '再试一次吧！';
      els.resBest.textContent = '';
      hide(els.resStars);
      hide(els.btnResNext);
    }
    show(els.result);
  }

  return { init, showLevelSelect, startLevel };
})();
