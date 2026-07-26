/* 入口：初始化引擎与 UI */
(function () {
  const canvas = document.getElementById('game');
  Game.init(canvas);
  UI.init();

  // 首次任意交互解锁音频（移动端浏览器要求用户手势）
  const unlock = () => { AudioSys.unlock(); document.removeEventListener('pointerdown', unlock); };
  document.addEventListener('pointerdown', unlock);

  // 菜单装饰小鸟
  const deco = document.querySelector('.menu-birds');
  if (deco) deco.textContent = '🔴 🟡 🔵 ⚫ ⚪ 🐷';
})();
