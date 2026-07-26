/* 游戏核心：物理模拟(Matter.js) + Canvas 渲染 + 输入 + 计分
 * 世界固定 1600x900，整体缩放适配屏幕（无摄像机，全局可见，操作直观）
 */
const Game = (() => {
  const { Engine, Composite, Bodies, Body, Events, Vector } = Matter;

  const W = 1600, H = 900;
  const GY = 830;                       // 地面顶部
  const SLING = { x: 230, y: GY - 155 }; // 弹弓皮筋中心
  const MAX_STRETCH = 115;
  const LAUNCH_K = 19 / MAX_STRETCH;    // 最大初速 19 px/frame
  const GRAV_A = 0.2777;                // Matter 每帧重力加速度（gravity.y=1, dt=16.66ms）

  // 材质参数
  const MATS = {
    wood:  { density: 0.0020, hpArea: 0.024, friction: 0.6, restitution: 0.1, score: 500 },
    ice:   { density: 0.0014, hpArea: 0.012, friction: 0.25, restitution: 0.05, score: 500 },
    stone: { density: 0.0034, hpArea: 0.048, friction: 0.7, restitution: 0.05, score: 800 },
  };
  const BIRDS = {
    red:    { r: 22, density: 0.0042, color: '#e33d2b', dmgMul: 1.0 },
    yellow: { r: 21, density: 0.0040, color: '#f7c331', dmgMul: 1.15 },
    blue:   { r: 14, density: 0.0038, color: '#4aa8e0', dmgMul: 0.8 },
    black:  { r: 24, density: 0.0052, color: '#3a3a42', dmgMul: 1.1 },
    white:  { r: 23, density: 0.0036, color: '#f2ece2', dmgMul: 0.9 },
  };
  const BIRD_NAMES = { red: '红鸟', yellow: '黄鸟', blue: '蓝鸟', black: '黑鸟', white: '白鸟' };

  // ---------------- 状态 ----------------
  let canvas, ctx, dpr = 1, viewScale = 1;
  let engine, world;
  let running = false, paused = false, rafId = 0, lastT = 0, acc = 0, simTime = 0;

  let levelNum = 0, levelDef = null;
  let birdsQueue = [];        // 待发射小鸟类型
  let currentBird = null;     // 当前小鸟 body
  let extraBirds = [];        // 蓝鸟分裂出的小鸟
  let state = 'idle';         // idle | aiming | flying | over
  let flightStart = 0, calmFrames = 0;
  let abilityUsed = false;
  let score = 0, pigsTotal = 0, pigsDead = 0;
  let over = false, overTimer = 0, wonFlag = false;
  let shakeT = 0, shakeMag = 0;

  let dragging = false, dragPos = { x: 0, y: 0 };
  const particles = [], floaters = [];
  const clouds = [];
  const pendingRemove = new Set();
  const pendingExplode = [];

  const callbacks = { onEnd: null, onScore: null, onHint: null };

  // ---------------- 初始化 ----------------
  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    for (let i = 0; i < 6; i++) {
      clouds.push({ x: Math.random() * W, y: 60 + Math.random() * 240, s: 0.6 + Math.random() * 0.9, v: 0.1 + Math.random() * 0.2 });
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) pause(); });
  }

  function resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    viewScale = Math.min(ww / W, wh / H);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = (W * viewScale) + 'px';
    canvas.style.height = (H * viewScale) + 'px';
    canvas.width = Math.round(W * viewScale * dpr);
    canvas.height = Math.round(H * viewScale * dpr);
  }

  function toWorld(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / viewScale, y: (e.clientY - rect.top) / viewScale };
  }

  // ---------------- 实体创建 ----------------
  function tag(body, data) { body.plugin.game = data; return body; }
  const dataOf = b => b.plugin && b.plugin.game;

  function makeBlock(it) {
    const m = MATS[it.mat];
    let body, area;
    if (it.t === 'circle') {
      body = Bodies.circle(it.x, it.y, it.r, { density: m.density, friction: m.friction, restitution: m.restitution });
      area = Math.PI * it.r * it.r;
    } else {
      body = Bodies.rectangle(it.x, it.y, it.w, it.h, { angle: (it.a || 0) * Math.PI / 180, density: m.density, friction: m.friction, restitution: m.restitution });
      area = it.w * it.h;
    }
    const hp = Math.max(18, area * m.hpArea);
    return tag(body, { kind: 'block', mat: it.mat, hp, maxHp: hp, w: it.w, h: it.h, r: it.r, shape: it.t });
  }

  function makePig(it) {
    const body = Bodies.circle(it.x, it.y, it.r, { density: 0.0012, friction: 0.5, restitution: 0.15 });
    const hp = it.king ? 140 : (it.r >= 26 ? 70 : it.r >= 20 ? 45 : 28);
    return tag(body, { kind: 'pig', hp, maxHp: hp, r: it.r, king: !!it.king, blink: Math.random() * 4 });
  }

  function makeTnt(it) {
    const body = Bodies.rectangle(it.x, it.y, 42, 42, { density: 0.0018, friction: 0.6, restitution: 0.05 });
    return tag(body, { kind: 'tnt', hp: 12, maxHp: 12, w: 42, h: 42 });
  }

  function makeBird(type, x, y, small = false) {
    const cfg = BIRDS[type];
    const r = small ? 12 : cfg.r;
    const body = Bodies.circle(x, y, r, { density: cfg.density, friction: 0.7, restitution: 0.35, frictionAir: 0.004 });
    // 小鸟是主角，禁止休眠：静置在弹弓上超过 1 秒会被引擎判睡眠，
    // 而 setVelocity 不会唤醒睡眠刚体，导致发射后凝固在半空
    body.sleepThreshold = Infinity;
    return tag(body, { kind: 'bird', type, r, launched: false, dead: false });
  }

  // ---------------- 关卡装载 ----------------
  function loadLevel(n) {
    levelNum = n;
    levelDef = Levels.get(n);
    if (engine) Engine.clear(engine);
    engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 1;
    world = engine.world;

    // 地面与边界（左墙在画面外，右墙防止飞出）
    const ground = Bodies.rectangle(W / 2, GY + 35, W + 800, 70, { isStatic: true, friction: 0.8 });
    tag(ground, { kind: 'ground' });
    const rightWall = Bodies.rectangle(W + 60, H / 2, 120, H * 2, { isStatic: true });
    tag(rightWall, { kind: 'ground' });
    Composite.add(world, [ground, rightWall]);

    for (const it of levelDef.items) {
      let b = null;
      if (it.t === 'rect' || it.t === 'circle') b = makeBlock(it);
      else if (it.t === 'pig') b = makePig(it);
      else if (it.t === 'tnt') b = makeTnt(it);
      else if (it.t === 'ledge') {
        b = Bodies.rectangle(it.x, it.y, it.w, it.h, { isStatic: true, friction: 0.8 });
        tag(b, { kind: 'ledge', w: it.w, h: it.h });
      }
      if (b) Composite.add(world, b);
    }

    pigsTotal = levelDef.items.filter(i => i.t === 'pig').length;
    pigsDead = 0;
    score = 0;
    birdsQueue = levelDef.birds.slice();
    currentBird = null; extraBirds = [];
    particles.length = 0; floaters.length = 0;
    pendingRemove.clear(); pendingExplode.length = 0;
    over = false; wonFlag = false; overTimer = 0;
    state = 'idle'; dragging = false; abilityUsed = false;
    simTime = 0; shakeT = 0;

    Events.on(engine, 'collisionStart', onCollision);
    nextBird();
    if (levelDef.hint && callbacks.onHint) callbacks.onHint(levelDef.hint);

    if (!running) { running = true; lastT = performance.now(); acc = 0; rafId = requestAnimationFrame(loop); }
    paused = false;
  }

  function nextBird() {
    if (!birdsQueue.length) { currentBird = null; state = 'idle'; return; }
    const type = birdsQueue[0];
    currentBird = makeBird(type, SLING.x, SLING.y);
    Body.setStatic(currentBird, true);
    Composite.add(world, currentBird);
    state = 'idle';
    abilityUsed = false;
    if (type !== 'red' && callbacks.onHint) {
      const hints = { yellow: '黄鸟：飞行中点击加速', blue: '蓝鸟：飞行中点击分裂', black: '黑鸟：点击立即引爆', white: '白鸟：飞行中点击投蛋' };
      callbacks.onHint(hints[type]);
    }
  }

  // ---------------- 输入 ----------------
  let dragId = null;
  function onDown(e) {
    if (!running || paused || over) return;
    AudioSys.unlock();
    const p = toWorld(e);
    // 'aiming' 且 !dragging：上一次拖拽的 pointerup 丢失（如在 iframe 外松手）后自愈
    if ((state === 'idle' || (state === 'aiming' && !dragging)) && currentBird) {
      const d = Math.hypot(p.x - currentBird.position.x, p.y - currentBird.position.y);
      if (d < 90) {
        dragging = true; dragId = e.pointerId; state = 'aiming'; dragPos = p;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 部分环境不支持 */ }
        AudioSys.stretch();
        return;
      }
      if (state === 'aiming') { // 点了别处：把鸟放回弹弓
        Body.setPosition(currentBird, { x: SLING.x, y: SLING.y });
        state = 'idle';
        return;
      }
    }
    if (state === 'flying') triggerAbility();
  }

  function onMove(e) {
    if (!dragging || e.pointerId !== dragId) return;
    dragPos = toWorld(e);
  }

  function onUp(e) {
    if (!dragging) return;
    if (e && e.pointerId !== undefined && e.pointerId !== dragId) return;
    dragging = false; dragId = null;
    const stretch = clampStretch(dragPos);
    const dx = SLING.x - stretch.x, dy = SLING.y - stretch.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 18) { // 拉得太少，放回弹弓
      Body.setPosition(currentBird, { x: SLING.x, y: SLING.y });
      state = 'idle';
      return;
    }
    launch(dx / dist * dist * LAUNCH_K, dy / dist * dist * LAUNCH_K);
  }

  function clampStretch(p) {
    let dx = p.x - SLING.x, dy = p.y - SLING.y;
    const d = Math.hypot(dx, dy);
    if (d > MAX_STRETCH) { dx = dx / d * MAX_STRETCH; dy = dy / d * MAX_STRETCH; }
    return { x: SLING.x + dx, y: SLING.y + dy };
  }

  function launch(vx, vy) {
    const d = dataOf(currentBird);
    d.launched = true;
    Body.setStatic(currentBird, false);
    Matter.Sleeping.set(currentBird, false); // 双保险：确保发射瞬间是唤醒状态
    Body.setVelocity(currentBird, { x: vx, y: vy });
    Body.setAngularVelocity(currentBird, 0.2);
    birdsQueue.shift();
    state = 'flying';
    flightStart = simTime; calmFrames = 0;
    AudioSys.shoot();
  }

  // ---------------- 技能 ----------------
  function triggerAbility() {
    if (abilityUsed || !currentBird || dataOf(currentBird).dead) return;
    const d = dataOf(currentBird);
    const v = currentBird.velocity;
    abilityUsed = true;
    switch (d.type) {
      case 'yellow': {
        const sp = Math.max(Math.hypot(v.x, v.y), 6);
        const nx = v.x / (Math.hypot(v.x, v.y) || 1), ny = v.y / (Math.hypot(v.x, v.y) || 1);
        Body.setVelocity(currentBird, { x: nx * sp * 1.75, y: ny * sp * 1.75 });
        spawnTrailBurst(currentBird.position, '#f7c331');
        AudioSys.ability();
        break;
      }
      case 'blue': {
        const p = currentBird.position;
        for (const ang of [-0.28, 0.28]) {
          const cos = Math.cos(ang), sin = Math.sin(ang);
          const nb = makeBird('blue', p.x, p.y - (ang < 0 ? 18 : -18), true);
          dataOf(nb).launched = true;
          Body.setVelocity(nb, { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos });
          Composite.add(world, nb);
          extraBirds.push(nb);
        }
        spawnTrailBurst(p, '#4aa8e0');
        AudioSys.ability();
        break;
      }
      case 'black':
        explode(currentBird.position.x, currentBird.position.y, 170, 300, currentBird);
        killBird(currentBird);
        break;
      case 'white': {
        const p = currentBird.position;
        const egg = Bodies.circle(p.x, p.y + 26, 13, { density: 0.006, restitution: 0 });
        tag(egg, { kind: 'egg' });
        Body.setVelocity(egg, { x: v.x * 0.3, y: Math.max(v.y, 4) + 8 });
        Composite.add(world, egg);
        Body.setVelocity(currentBird, { x: v.x * 1.2 + 3, y: -13 });
        AudioSys.eggDrop();
        break;
      }
      default: abilityUsed = false; // 红鸟无技能
    }
  }

  // ---------------- 碰撞与伤害 ----------------
  function onCollision(evt) {
    for (const pair of evt.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const da = dataOf(a), db = dataOf(b);
      if (!da || !db) continue;
      const rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (rel < 2.2) continue;

      applyImpact(a, da, b, db, rel);
      applyImpact(b, db, a, da, rel);

      if (rel > 4.5) AudioSys.hit(rel / 6);

      // 蛋落地即炸
      if (da.kind === 'egg') { pendingExplode.push({ x: a.position.x, y: a.position.y, r: 130, power: 220, src: a }); pendingRemove.add(a); }
      if (db.kind === 'egg') { pendingExplode.push({ x: b.position.x, y: b.position.y, r: 130, power: 220, src: b }); pendingRemove.add(b); }

      // 黑鸟高速撞击自动引爆
      if (da.kind === 'bird' && da.type === 'black' && da.launched && rel > 7 && !da.dead) {
        pendingExplode.push({ x: a.position.x, y: a.position.y, r: 170, power: 300, src: a });
        da.dead = true; pendingRemove.add(a);
        if (a === currentBird) abilityUsed = true;
      }
      if (db.kind === 'bird' && db.type === 'black' && db.launched && rel > 7 && !db.dead) {
        pendingExplode.push({ x: b.position.x, y: b.position.y, r: 170, power: 300, src: b });
        db.dead = true; pendingRemove.add(b);
        if (b === currentBird) abilityUsed = true;
      }
    }
  }

  // victim 受到 other 撞击
  function applyImpact(victim, dv, other, dOther, rel) {
    if (!dv || dv.hp === undefined) return;
    if (dv.kind === 'bird') return;
    let mass = Math.min(other.mass || 1, 26);
    let dmg = rel * mass * 0.42;
    if (dOther.kind === 'bird') dmg *= 2.2 * (BIRDS[dOther.type] ? BIRDS[dOther.type].dmgMul : 1);
    if (dOther.kind === 'ground' || dOther.kind === 'ledge') dmg = rel * Math.min(victim.mass, 26) * (dv.kind === 'pig' ? 0.55 : 0.28);
    if (dmg < 3) return;
    damage(victim, dmg);
  }

  function damage(body, dmg) {
    const d = dataOf(body);
    if (!d || d.hp === undefined || d.hp <= 0) return;
    d.hp -= dmg;
    if (d.hp <= 0) destroy(body);
  }

  function destroy(body) {
    const d = dataOf(body);
    if (!d || d.destroyed) return;
    d.destroyed = true;
    const p = body.position;

    if (d.kind === 'pig') {
      pigsDead++;
      addScore(d.king ? 10000 : 5000, p.x, p.y);
      spawnPigPop(p, d.r);
      AudioSys.pigPop();
    } else if (d.kind === 'block') {
      addScore(MATS[d.mat].score, p.x, p.y);
      spawnDebris(body, d);
      if (d.mat === 'wood') AudioSys.woodBreak();
      else if (d.mat === 'ice') AudioSys.iceBreak();
      else AudioSys.stoneBreak();
    } else if (d.kind === 'tnt') {
      pendingExplode.push({ x: p.x, y: p.y, r: 190, power: 340, src: body });
      addScore(1000, p.x, p.y);
    }
    pendingRemove.add(body);
  }

  function explode(x, y, radius, power, src) {
    AudioSys.boom();
    shakeT = 0.45; shakeMag = 10;
    spawnExplosion(x, y, radius);
    const bodies = Composite.allBodies(world);
    for (const b of bodies) {
      if (b.isStatic || b === src) continue;
      const dx = b.position.x - x, dy = b.position.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + 60) continue;
      const fall = Math.max(0.25, 1 - dist / (radius + 60));
      const d = dataOf(b);
      if (d && d.hp !== undefined) damage(b, power * fall * 0.5);
      // 冲击波
      const push = 16 * fall;
      const nx = dist > 1 ? dx / dist : 0, ny = dist > 1 ? dy / dist : -1;
      Matter.Sleeping.set(b, false);
      Body.setVelocity(b, { x: b.velocity.x + nx * push, y: b.velocity.y + ny * push - 3 * fall });
    }
  }

  function killBird(bird) {
    const d = dataOf(bird);
    if (d.dead) return;
    d.dead = true;
    spawnTrailBurst(bird.position, '#555');
    pendingRemove.add(bird);
  }

  function addScore(v, x, y) {
    score += v;
    if (x !== undefined) floaters.push({ x, y: y - 30, v, life: 1.2 });
    if (callbacks.onScore) callbacks.onScore(score);
    AudioSys.score();
  }

  // ---------------- 粒子 ----------------
  function spawnDebris(body, d) {
    const colors = { wood: ['#b07b3e', '#8a5a26', '#c99a5e'], ice: ['#bfe6f5', '#8fd0ea', '#e8f8ff'], stone: ['#9aa2a8', '#767e85', '#b8bfc5'] };
    const cs = colors[d.mat] || colors.wood;
    const n = 10;
    for (let i = 0; i < n; i++) {
      particles.push({
        x: body.position.x + (Math.random() - 0.5) * (d.w || d.r * 2 || 40),
        y: body.position.y + (Math.random() - 0.5) * (d.h || d.r * 2 || 40),
        vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 6 - 1,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        size: 4 + Math.random() * 8, color: cs[i % cs.length],
        life: 0.9 + Math.random() * 0.5, shape: 'rect',
      });
    }
  }

  function spawnPigPop(p, r) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
      particles.push({
        x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
        size: 3 + Math.random() * 6, color: i % 3 ? '#7ec850' : '#5aa838',
        life: 0.7 + Math.random() * 0.4, shape: 'circle', rot: 0, vr: 0,
      });
    }
    floaters.push({ x: p.x, y: p.y - r - 10, v: '💨', life: 0.8, emoji: true });
  }

  function spawnExplosion(x, y, r) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 10;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        size: 6 + Math.random() * 12,
        color: ['#ff9d3c', '#ffd23c', '#ff5722', '#777'][i % 4],
        life: 0.5 + Math.random() * 0.5, shape: 'circle', rot: 0, vr: 0, fade: true,
      });
    }
  }

  // 小鸟退场：明显的白色羽毛云，让"消失"读起来是回合结束而非 bug
  function spawnBirdPoof(p) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, sp = 1.5 + Math.random() * 3.5;
      particles.push({
        x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5,
        size: 6 + Math.random() * 9, color: i % 2 ? 'rgba(255,255,255,0.95)' : '#eee',
        life: 0.55 + Math.random() * 0.35, shape: 'circle', rot: 0, vr: 0,
      });
    }
    floaters.push({ x: p.x, y: p.y - 26, v: '💨', life: 0.7, emoji: true });
    AudioSys.flap();
  }

  function spawnTrailBurst(p, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
      particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 3 + Math.random() * 5, color, life: 0.5, shape: 'circle', rot: 0, vr: 0 });
    }
  }

  // ---------------- 主循环 ----------------
  const DT = 1000 / 60;
  function loop(t) {
    rafId = requestAnimationFrame(loop);
    if (paused) { lastT = t; return; }
    acc += Math.min(t - lastT, 100);
    lastT = t;
    let steps = 0;
    while (acc >= DT && steps < 4) {
      step();
      acc -= DT; steps++;
    }
    render();
  }

  function step() {
    simTime += DT / 1000;
    Engine.update(engine, DT);

    // 延迟删除 / 爆炸（避免在碰撞回调中改世界）
    if (pendingExplode.length) {
      const list = pendingExplode.splice(0);
      for (const ex of list) { if (ex.src) pendingRemove.add(ex.src); explode(ex.x, ex.y, ex.r, ex.power, ex.src); }
    }
    if (pendingRemove.size) {
      for (const b of pendingRemove) Composite.remove(world, b);
      pendingRemove.clear();
    }

    // 拖拽跟随
    if (dragging && currentBird) {
      const p = clampStretch(dragPos);
      Body.setPosition(currentBird, p);
    }

    // 飞行小鸟落地静止 / 出界 → 回合结束
    if (state === 'flying' && currentBird) {
      const b = currentBird;
      const d = dataOf(b);
      const off = b.position.x > W + 40 || b.position.x < -100 || b.position.y > H + 60;
      const slow = Math.hypot(b.velocity.x, b.velocity.y) < 0.6;
      if (slow) calmFrames++; else calmFrames = 0;
      if (d.dead || off || calmFrames > 70 || simTime - flightStart > 12) {
        if (!d.dead && !off) { spawnBirdPoof(b.position); }
        pendingRemove.add(b);
        for (const eb of extraBirds) pendingRemove.add(eb);
        extraBirds = [];
        currentBird = null;
        state = 'settle';
        settleTimer = 1.0;
      }
    } else if (state === 'settle') {
      settleTimer -= DT / 1000;
      if (settleTimer <= 0) { nextBird(); }
    } else if (state === 'idle' && !currentBird && birdsQueue.length && !over) {
      nextBird(); // 兜底自愈：任何异常导致弹弓空置时自动装填下一只
    }

    // 掉出世界的物体清理
    for (const b of Composite.allBodies(world)) {
      if (!b.isStatic && b.position.y > H + 200) {
        const d = dataOf(b);
        if (d && (d.kind === 'pig')) destroy(b);
        else Composite.remove(world, b);
      }
    }

    // 胜负判定
    if (!over) {
      if (pigsDead >= pigsTotal) {
        over = true; wonFlag = true; overTimer = 1.0;
      } else if (!currentBird && !birdsQueue.length && state !== 'settle') {
        over = true; wonFlag = false; overTimer = 2.4;
      }
    } else if (overTimer > 0) {
      // 结算倒计时中若余震补刀清光了猪，反转为胜利
      if (!wonFlag && pigsDead >= pigsTotal) { wonFlag = true; overTimer = Math.max(overTimer, 0.8); }
      overTimer -= DT / 1000;
      if (overTimer <= 0) finishLevel();
    }

    // 粒子更新
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.rot += p.vr;
      p.life -= DT / 1000;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.y -= 0.8; f.life -= DT / 1000;
      if (f.life <= 0) floaters.splice(i, 1);
    }
    if (shakeT > 0) shakeT -= DT / 1000;
  }

  let settleTimer = 0;

  function finishLevel() {
    if (state === 'over') return;
    state = 'over';
    let finalScore = score;
    let stars = 0;
    if (wonFlag) {
      const bonus = birdsQueue.length * 10000 + (currentBird && !dataOf(currentBird).launched ? 10000 : 0);
      finalScore += bonus;
      score = finalScore;
      const base = pigsTotal * 5000;
      stars = 1;
      if (finalScore >= base + 4000) stars = 2;
      if (finalScore >= base + 11000) stars = 3;
      AudioSys.win();
    } else {
      AudioSys.lose();
    }
    if (callbacks.onEnd) callbacks.onEnd({ won: wonFlag, score: finalScore, stars, level: levelNum });
  }

  // ---------------- 渲染 ----------------
  function render() {
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, 0, 0);
    if (shakeT > 0) {
      const m = shakeMag * (shakeT / 0.45);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    drawBackground();
    drawSlingBack();
    drawQueueBirds();

    for (const b of Composite.allBodies(world)) {
      const d = dataOf(b);
      if (!d) continue;
      if (d.kind === 'block') drawBlock(b, d);
      else if (d.kind === 'pig') drawPig(b, d);
      else if (d.kind === 'tnt') drawTnt(b);
      else if (d.kind === 'bird') drawBird(b, d);
      else if (d.kind === 'egg') drawEgg(b);
      else if (d.kind === 'ledge') drawLedge(b, d);
    }

    drawSlingFront();
    if (dragging && currentBird) drawTrajectory();
    drawParticles();
    drawFloaters();
  }

  function drawBackground() {
    // 天空
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#6bb7e8'); sky.addColorStop(0.55, '#a8dcf5'); sky.addColorStop(1, '#d8f0fa');
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // 太阳
    ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
    ctx.beginPath(); ctx.arc(1450, 110, 55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 240, 180, 0.25)';
    ctx.beginPath(); ctx.arc(1450, 110, 85, 0, Math.PI * 2); ctx.fill();

    // 云
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of clouds) {
      c.x -= c.v; if (c.x < -160) c.x = W + 160;
      drawCloud(c.x, c.y, c.s);
    }

    // 远山
    ctx.fillStyle = '#9fd0a8';
    ctx.beginPath();
    ctx.moveTo(-20, GY);
    for (let x = -20; x <= W + 20; x += 40) {
      ctx.lineTo(x, GY - 90 - 60 * Math.sin(x * 0.004) - 35 * Math.sin(x * 0.011 + 2));
    }
    ctx.lineTo(W + 20, GY); ctx.closePath(); ctx.fill();

    // 地面
    const gnd = ctx.createLinearGradient(0, GY, 0, H);
    gnd.addColorStop(0, '#8ec358'); gnd.addColorStop(0.12, '#7bab4a'); gnd.addColorStop(1, '#6c5334');
    ctx.fillStyle = gnd;
    ctx.fillRect(-20, GY, W + 40, H - GY + 20);
    // 草皮
    ctx.fillStyle = '#79c14e';
    ctx.fillRect(-20, GY, W + 40, 14);
  }

  function drawCloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 28 * s, 0, Math.PI * 2);
    ctx.arc(x + 30 * s, y + 6 * s, 22 * s, 0, Math.PI * 2);
    ctx.arc(x - 30 * s, y + 8 * s, 20 * s, 0, Math.PI * 2);
    ctx.arc(x + 6 * s, y - 14 * s, 20 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // 弹弓：Y 字形，皮筋分前后两层夹住小鸟
  const FORK_L = { x: SLING.x - 20, y: SLING.y + 2 };
  const FORK_R = { x: SLING.x + 20, y: SLING.y + 2 };
  const bandActive = () => currentBird && (state === 'idle' || state === 'aiming');

  function drawSlingBack() {
    // 右侧（远端）叉臂
    ctx.strokeStyle = '#5a3a1e';
    ctx.lineWidth = 13; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(FORK_R.x, FORK_R.y);
    ctx.quadraticCurveTo(SLING.x + 16, SLING.y + 55, SLING.x + 2, SLING.y + 80);
    ctx.stroke();
    // 后侧皮筋
    if (bandActive()) {
      ctx.strokeStyle = '#3d2413'; ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(FORK_R.x, FORK_R.y);
      ctx.lineTo(currentBird.position.x, currentBird.position.y);
      ctx.stroke();
    }
  }

  function drawSlingFront() {
    // 前侧皮筋
    if (bandActive()) {
      ctx.strokeStyle = '#553318'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(FORK_L.x, FORK_L.y);
      ctx.lineTo(currentBird.position.x, currentBird.position.y);
      ctx.stroke();
    }
    // 主干 + 左侧叉臂
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(SLING.x, GY + 6);
    ctx.lineTo(SLING.x, SLING.y + 78);
    ctx.stroke();
    ctx.strokeStyle = '#7a4f28';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(FORK_L.x, FORK_L.y);
    ctx.quadraticCurveTo(SLING.x - 16, SLING.y + 55, SLING.x - 2, SLING.y + 80);
    ctx.stroke();
  }

  function drawQueueBirds() {
    // 弹弓上的鸟未发射时占据 birdsQueue[0]，等待队列从 1 开始；发射后从 0 开始
    const start = (currentBird && !dataOf(currentBird).launched) ? 1 : 0;
    let x = SLING.x - 90;
    for (let i = start; i < birdsQueue.length; i++) {
      const type = birdsQueue[i];
      const r = BIRDS[type].r * 0.85;
      drawBirdShape(x, GY - r, r, type, 0);
      x -= r * 2 + 14;
    }
  }

  function drawTrajectory() {
    const p = clampStretch(dragPos);
    const dx = SLING.x - p.x, dy = SLING.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 18) return;
    let vx = dx / dist * dist * LAUNCH_K, vy = dy / dist * dist * LAUNCH_K;
    let x = SLING.x, y = SLING.y;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 90; i++) {
      vy += GRAV_A; vx *= 0.996; vy *= 0.996;
      x += vx; y += vy;
      if (i % 5 === 0) {
        const r = 5.5 - i * 0.035;
        ctx.beginPath(); ctx.arc(x, y, Math.max(2, r), 0, Math.PI * 2); ctx.fill();
      }
      if (y > GY + 10) break;
    }
  }

  // 方块材质
  function drawBlock(b, d) {
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    const hpRatio = Math.max(0, d.hp / d.maxHp);

    if (d.shape === 'circle') {
      const r = d.r;
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
      grad.addColorStop(0, '#b8bfc5'); grad.addColorStop(1, '#7d858c');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.stroke();
    } else {
      const w = d.w, h = d.h;
      if (d.mat === 'wood') {
        ctx.fillStyle = '#c08a4a';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = '#8a5a26'; ctx.lineWidth = 3;
        ctx.strokeRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3);
        // 木纹
        ctx.strokeStyle = 'rgba(122, 78, 30, 0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (w >= h) { for (let i = 1; i <= 2; i++) { ctx.moveTo(-w / 2 + 4, -h / 2 + h * i / 3); ctx.lineTo(w / 2 - 4, -h / 2 + h * i / 3); } }
        else { for (let i = 1; i <= 2; i++) { ctx.moveTo(-w / 2 + w * i / 3, -h / 2 + 4); ctx.lineTo(-w / 2 + w * i / 3, h / 2 - 4); } }
        ctx.stroke();
      } else if (d.mat === 'ice') {
        ctx.fillStyle = 'rgba(160, 220, 245, 0.85)';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5;
        ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(-w / 2 + 3, -h / 2 + 3, Math.max(4, w * 0.25), Math.max(4, h * 0.25));
      } else { // stone
        ctx.fillStyle = '#98a1a8';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = '#666e75'; ctx.lineWidth = 3;
        ctx.strokeRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, Math.max(3, h * 0.18));
      }
    }

    // 裂纹（受损表现）
    if (hpRatio < 0.66) {
      ctx.strokeStyle = 'rgba(30, 20, 10, 0.55)';
      ctx.lineWidth = 1.6;
      const s = (d.w || d.r * 2) / 2, sh = (d.h || d.r * 2) / 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -sh * 0.6); ctx.lineTo(-s * 0.1, -sh * 0.1); ctx.lineTo(-s * 0.45, sh * 0.4);
      if (hpRatio < 0.33) {
        ctx.moveTo(s * 0.5, -sh * 0.5); ctx.lineTo(s * 0.05, sh * 0.05); ctx.lineTo(s * 0.5, sh * 0.55);
        ctx.moveTo(-s * 0.1, -sh * 0.1); ctx.lineTo(s * 0.05, sh * 0.05);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLedge(b, d) {
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    const w = d.w, h = d.h;
    ctx.fillStyle = '#7d6547';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#79c14e';
    ctx.fillRect(-w / 2, -h / 2, w, 9);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawTnt(b) {
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-21, -21, 42, 42);
    ctx.strokeStyle = '#7f1d12'; ctx.lineWidth = 3;
    ctx.strokeRect(-19.5, -19.5, 39, 39);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 0, 1);
    ctx.restore();
  }

  function drawPig(b, d) {
    const p = b.position, r = d.r;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(b.angle * 0.3);
    const hurt = d.hp / d.maxHp < 0.55;

    // 耳朵
    ctx.fillStyle = '#6db63f';
    ctx.beginPath(); ctx.arc(-r * 0.5, -r * 0.85, r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.85, r * 0.28, 0, Math.PI * 2); ctx.fill();

    // 身体
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
    grad.addColorStop(0, '#96d96a'); grad.addColorStop(1, '#5fae35');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40, 80, 20, 0.5)'; ctx.lineWidth = 2; ctx.stroke();

    // 王冠（猪王）
    if (d.king) {
      ctx.fillStyle = '#f5c400';
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.95);
      ctx.lineTo(-r * 0.55, -r * 1.35); ctx.lineTo(-r * 0.25, -r * 1.1);
      ctx.lineTo(0, -r * 1.45); ctx.lineTo(r * 0.25, -r * 1.1);
      ctx.lineTo(r * 0.55, -r * 1.35); ctx.lineTo(r * 0.55, -r * 0.95);
      ctx.closePath(); ctx.fill();
    }

    // 眼睛
    const eyeY = -r * 0.32, eyeX = r * 0.42;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-eyeX, eyeY, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(eyeX, eyeY, r * 0.22, 0, Math.PI * 2); ctx.fill();
    d.blink -= 1 / 60;
    const blinking = d.blink < 0.12;
    if (d.blink < 0) d.blink = 2.5 + Math.random() * 3;
    if (!blinking) {
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-eyeX - r * 0.05, eyeY, r * 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(eyeX - r * 0.05, eyeY, r * 0.1, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-eyeX - r * 0.15, eyeY); ctx.lineTo(-eyeX + r * 0.15, eyeY);
      ctx.moveTo(eyeX - r * 0.15, eyeY); ctx.lineTo(eyeX + r * 0.15, eyeY); ctx.stroke();
    }

    // 鼻子
    ctx.fillStyle = '#7dc353';
    ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.42, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,80,20,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#4d8a2a';
    ctx.beginPath(); ctx.arc(-r * 0.15, r * 0.1, r * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.15, r * 0.1, r * 0.07, 0, Math.PI * 2); ctx.fill();

    // 受伤表情：淤青 + 皱眉
    if (hurt) {
      ctx.strokeStyle = 'rgba(30,60,15,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-eyeX - r * 0.2, eyeY - r * 0.3); ctx.lineTo(-eyeX + r * 0.12, eyeY - r * 0.16);
      ctx.moveTo(eyeX + r * 0.2, eyeY - r * 0.3); ctx.lineTo(eyeX - r * 0.12, eyeY - r * 0.16);
      ctx.stroke();
      ctx.fillStyle = 'rgba(90, 60, 120, 0.35)';
      ctx.beginPath(); ctx.arc(r * 0.5, r * 0.45, r * 0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBird(b, d) {
    drawBirdShape(b.position.x, b.position.y, d.r, d.type, b.angle, state === 'aiming' && b === currentBird);
  }

  function drawBirdShape(x, y, r, type, angle, tense = false) {
    const cfg = BIRDS[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * 0.6);

    // 身体
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r * 1.05);
    grad.addColorStop(0, lighten(cfg.color, 0.25));
    grad.addColorStop(1, cfg.color);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.8; ctx.stroke();

    // 肚皮
    ctx.fillStyle = type === 'black' ? '#8a8a95' : 'rgba(255, 244, 220, 0.9)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 0.62, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();

    // 头羽
    ctx.strokeStyle = cfg.color === '#f2ece2' ? '#d8ccb8' : darken(cfg.color, 0.25);
    ctx.lineWidth = Math.max(2.5, r * 0.14); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.05, -r * 0.9); ctx.quadraticCurveTo(-r * 0.3, -r * 1.45, -r * 0.45, -r * 1.25);
    ctx.moveTo(r * 0.1, -r * 0.95); ctx.quadraticCurveTo(r * 0.1, -r * 1.5, -r * 0.12, -r * 1.42);
    ctx.stroke();

    // 尾羽
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.1); ctx.lineTo(-r * 1.35, -r * 0.1);
    ctx.moveTo(-r * 0.9, r * 0.3); ctx.lineTo(-r * 1.3, r * 0.35);
    ctx.stroke();

    // 眼睛（紧张时眯眼）
    const ex = r * 0.32, ey = -r * 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex, ey, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + r * 0.5, ey, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1c1c';
    const px = tense ? r * 0.1 : r * 0.06;
    ctx.beginPath(); ctx.arc(ex + px, ey, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + r * 0.5 + px, ey, r * 0.1, 0, Math.PI * 2); ctx.fill();

    // 眉毛（愤怒！）
    ctx.strokeStyle = type === 'white' ? '#b09a70' : '#5a1408';
    ctx.lineWidth = Math.max(2.5, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(ex - r * 0.35, ey - r * 0.45); ctx.lineTo(ex + r * 0.75, ey - r * 0.2);
    ctx.stroke();

    // 喙
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.moveTo(r * 0.85, -r * 0.08);
    ctx.lineTo(r * 1.45, r * 0.08);
    ctx.lineTo(r * 0.82, r * 0.34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120, 70, 0, 0.5)'; ctx.lineWidth = 1.2; ctx.stroke();

    ctx.restore();
  }

  function drawEgg(b) {
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.fillStyle = '#fff8ea';
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    ctx.textAlign = 'center';
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 1.6);
      if (f.emoji) {
        ctx.font = '28px sans-serif';
        ctx.fillText(f.v, f.x, f.y);
      } else {
        ctx.font = '900 26px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(120, 60, 0, 0.8)';
        ctx.lineWidth = 4;
        ctx.strokeText('+' + f.v, f.x, f.y);
        ctx.fillText('+' + f.v, f.x, f.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  function lighten(hex, amt) { return shade(hex, amt); }
  function darken(hex, amt) { return shade(hex, -amt); }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(Math.min(255, Math.max(0, r + 255 * amt)));
    g = Math.round(Math.min(255, Math.max(0, g + 255 * amt)));
    b = Math.round(Math.min(255, Math.max(0, b + 255 * amt)));
    return `rgb(${r},${g},${b})`;
  }

  // ---------------- 对外接口 ----------------
  function pause() { paused = true; }
  function resume() { paused = false; lastT = performance.now(); acc = 0; }
  function stop() { running = false; paused = false; cancelAnimationFrame(rafId); }
  function isPaused() { return paused; }

  return {
    init, loadLevel, pause, resume, stop, isPaused,
    get score() { return score; },
    get levelNum() { return levelNum; },
    get state() { return state; },
    get birdsLeft() { return birdsQueue.length; },
    callbacks,
  };
})();
