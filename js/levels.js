/* 关卡数据：30 关，数据驱动 + 结构生成器
 * 世界坐标：1600 x 900，地面顶部 y = 830，弹弓在 x ≈ 230
 * 材质：wood(木) / ice(冰) / stone(石)
 * 小鸟：red(基础) yellow(加速) blue(分裂) black(爆炸) white(下蛋)
 * on(g)：以 y=g 为支撑面的建造工具集；base = 底部距支撑面的高度
 */
const Levels = (() => {
  const GY = 830; // 地面顶部

  function on(g) {
    const rect = (x, yc, w, h, mat, a = 0) => ({ t: 'rect', x, y: yc, w, h, mat, a });
    const o = {
      rect,
      V:  (x, base, mat) => rect(x, g - base - 55, 20, 110, mat),          // 竖板 20x110
      H:  (x, base, mat, w = 150) => rect(x, g - base - 10, w, 20, mat),   // 横板
      SQ: (x, base, s, mat) => rect(x, g - base - s / 2, s, s, mat),       // 方块
      plank: (x, base, w, h, mat, a = 0) => rect(x, g - base - h / 2, w, h, mat, a),
      ball: (x, base, r, mat) => ({ t: 'circle', x, y: g - base - r, r, mat }),
      pig:  (x, base, r = 18, king = false) => ({ t: 'pig', x, y: g - base - r - 2, r, king }),
      tnt:  (x, base) => ({ t: 'tnt', x, y: g - base - 21 }),
    };

    // 小屋：两竖板 + 横梁，内藏猪
    o.hut = (x, base, mat, pigR = 18, span = 55) => [
      o.V(x - span, base, mat), o.V(x + span, base, mat),
      o.H(x, base + 110, mat, span * 2 + 60),
      o.pig(x, base, pigR),
    ];
    // 空屋（无猪）
    o.frame = (x, base, mat, span = 55) => [
      o.V(x - span, base, mat), o.V(x + span, base, mat),
      o.H(x, base + 110, mat, span * 2 + 60),
    ];
    // 多层塔：每层高 130
    o.tower = (x, floors, mat, span = 55) => {
      const out = [];
      for (let i = 0; i < floors; i++) {
        const b = i * 130;
        out.push(o.V(x - span, b, mat), o.V(x + span, b, mat), o.H(x, b + 110, mat, span * 2 + 60));
      }
      return out;
    };
    // 方块金字塔
    o.pyramid = (x, base, rows, mat, s = 48) => {
      const out = [];
      for (let r = 0; r < rows; r++) {
        const n = rows - r;
        for (let i = 0; i < n; i++) {
          out.push(o.SQ(x + (i - (n - 1) / 2) * (s + 2), base + r * (s + 2), s, mat));
        }
      }
      return out;
    };
    return o;
  }

  const G = on(GY); // 地面坐标系
  // 静态平台：yTop 为平台面绝对 y 坐标；其上建造用 on(yTop)
  const ledge = (x, yTop, w, h = 34) => ({ t: 'ledge', x, y: yTop + h / 2, w, h });

  // ======================= 30 个关卡 =======================
  const list = [

    // —— 第 1-5 关：木头 + 红鸟（教学） ——
    { name: '第一击', birds: ['red', 'red', 'red'], hint: '拖住小鸟向后拉，松手发射！',
      items: [ ...G.hut(1050, 0, 'wood') ] },

    { name: '双子小屋', birds: ['red', 'red', 'red'],
      items: [ ...G.hut(950, 0, 'wood'), ...G.hut(1250, 0, 'wood') ] },

    { name: '叠罗汉', birds: ['red', 'red', 'red'],
      items: [ ...G.tower(1100, 2, 'wood'), G.pig(1100, 260, 20), G.pig(1100, 0, 18) ] },

    { name: '木金字塔', birds: ['red', 'red', 'red', 'red'],
      items: [ ...G.pyramid(1150, 0, 3, 'wood'), G.pig(1150, 152, 18),
               G.pig(980, 0, 18), G.SQ(980, 40, 48, 'wood') ] },

    { name: '板凳阵', birds: ['red', 'red', 'red'],
      items: [ G.SQ(900, 0, 44, 'wood'), G.SQ(1030, 0, 44, 'wood'), G.H(965, 44, 'wood', 180),
               G.pig(965, 66, 18),
               G.SQ(1180, 0, 44, 'wood'), G.SQ(1310, 0, 44, 'wood'), G.H(1245, 44, 'wood', 180),
               G.pig(1245, 66, 18), G.pig(1105, 0, 16) ] },

    // —— 第 6-10 关：冰块 + 黄鸟（点击加速） ——
    { name: '初见寒冰', birds: ['red', 'yellow', 'yellow'], hint: '黄鸟飞行中点击屏幕：瞬间加速！',
      items: [ ...G.hut(1000, 0, 'ice'), ...G.hut(1280, 0, 'wood') ] },

    { name: '冰塔', birds: ['yellow', 'yellow', 'red'],
      items: [ ...G.tower(1120, 3, 'ice'), G.pig(1120, 0, 18), G.pig(1120, 130, 16), G.pig(1120, 390, 20) ] },

    { name: '冰封堡垒', birds: ['yellow', 'red', 'yellow', 'red'],
      items: [ G.V(940, 0, 'wood'), G.V(1060, 0, 'ice'), G.V(1180, 0, 'wood'),
               G.H(1000, 110, 'ice', 160), G.H(1120, 110, 'ice', 160),
               G.pig(1000, 0, 17), G.pig(1120, 0, 17),
               ...G.pyramid(1330, 0, 2, 'ice'), G.pig(1330, 102, 16) ] },

    { name: '高台冰屋', birds: ['yellow', 'yellow', 'red', 'red'],
      items: [ ledge(1150, 620, 340),
               ...on(620).hut(1150, 0, 'ice'),
               G.pig(1000, 0, 18), G.SQ(1000, 38, 40, 'ice'),
               ...G.hut(1400, 0, 'ice') ] },

    { name: '远方来客', birds: ['yellow', 'yellow', 'yellow', 'red'],
      items: [ ...G.hut(1300, 0, 'ice', 18), ...G.tower(1480, 2, 'ice', 45),
               G.pig(1480, 0, 16), G.pig(1480, 130, 16),
               G.pig(1160, 0, 16), G.SQ(1160, 36, 44, 'ice') ] },

    // —— 第 11-15 关：石头 + 蓝鸟（分裂三只） ——
    { name: '石门', birds: ['blue', 'blue', 'red', 'red'], hint: '蓝鸟飞行中点击屏幕：一分为三！',
      items: [ G.V(950, 0, 'stone'), G.V(1070, 0, 'stone'), G.H(1010, 110, 'stone', 180),
               G.pig(1010, 0, 18),
               ...G.hut(1280, 0, 'ice'), G.pig(1280, 130, 16) ] },

    { name: '蓝色三重奏', birds: ['blue', 'blue', 'blue', 'blue'],
      items: [ ...G.hut(920, 0, 'ice', 15, 42), ...G.hut(1130, 0, 'ice', 15, 42),
               ...G.hut(1340, 0, 'ice', 15, 42),
               G.pig(1025, 0, 14), G.pig(1235, 0, 14) ] },

    { name: '碉堡', birds: ['blue', 'yellow', 'red', 'red'],
      items: [ ...G.tower(1150, 2, 'stone', 60), G.pig(1150, 0, 20), G.pig(1150, 130, 18),
               G.SQ(990, 0, 48, 'stone'), G.pig(990, 48, 16),
               ...G.pyramid(1380, 0, 2, 'ice'), G.pig(1380, 102, 15) ] },

    { name: '滚石险境', birds: ['yellow', 'blue', 'blue', 'red'],
      items: [ ledge(1080, 560, 260),
               on(560).ball(1010, 0, 26, 'stone'), on(560).ball(1140, 0, 26, 'stone'),
               G.V(920, 0, 'stone'), G.V(1240, 0, 'stone'),
               G.pig(1080, 0, 20), G.pig(1400, 0, 18), G.SQ(1400, 40, 44, 'ice') ] },

    { name: '空中楼阁', birds: ['blue', 'blue', 'yellow', 'yellow'],
      items: [ ledge(1000, 500, 220), ledge(1350, 640, 240),
               ...on(500).hut(1000, 0, 'ice', 16, 45),
               ...on(640).hut(1350, 0, 'ice', 16, 45),
               G.pig(1180, 0, 18), G.SQ(1180, 38, 44, 'wood') ] },

    // —— 第 16-20 关：黑鸟（爆炸）+ TNT ——
    { name: '爆破专家', birds: ['black', 'red', 'red'], hint: '黑鸟点击屏幕或撞击后爆炸！',
      items: [ ...G.tower(1150, 2, 'stone', 60), G.pig(1150, 0, 20), G.pig(1150, 130, 18),
               G.V(1000, 0, 'stone'), G.V(1300, 0, 'stone') ] },

    { name: 'TNT 仓库', birds: ['red', 'yellow', 'red'], hint: '打爆 TNT 引发连锁爆炸！',
      items: [ G.tnt(1000, 0), G.SQ(1070, 0, 44, 'wood'), G.tnt(1140, 0),
               ...G.hut(1290, 0, 'wood', 18), G.tnt(1290, 130),
               G.pig(930, 0, 16) ] },

    { name: '铜墙铁壁', birds: ['black', 'black', 'yellow'],
      items: [ G.plank(960, 0, 26, 190, 'stone'), G.plank(1010, 0, 26, 190, 'stone'),
               G.pig(1100, 0, 20), G.pig(1200, 0, 18),
               G.plank(1290, 0, 26, 190, 'stone'), G.plank(1340, 0, 26, 190, 'stone'),
               G.H(1150, 190, 'stone', 420) ] },

    { name: '矿洞奇兵', birds: ['black', 'blue', 'black'],
      items: [ ledge(1250, 600, 480),
               G.V(1060, 0, 'stone'), G.V(1440, 0, 'stone'),
               G.pig(1180, 0, 18), G.pig(1320, 0, 18), G.tnt(1250, 0),
               ...on(600).hut(1250, 0, 'stone', 18) ] },

    { name: '连环爆', birds: ['black', 'yellow', 'black'],
      items: [ ...G.tower(1000, 2, 'wood', 50), G.tnt(1000, 0), G.pig(1000, 130, 16),
               ...G.tower(1250, 2, 'stone', 50), G.tnt(1250, 0), G.pig(1250, 130, 18),
               G.pig(1450, 0, 20), G.SQ(1450, 44, 48, 'stone') ] },

    // —— 第 21-25 关：白鸟（下蛋）+ 混合 ——
    { name: '天降正义', birds: ['white', 'white', 'red'], hint: '白鸟飞行中点击屏幕：投下炸弹蛋！',
      items: [ G.plank(950, 0, 24, 160, 'stone'), G.plank(1180, 0, 24, 160, 'stone'),
               G.pig(1065, 0, 20), G.pig(1065, 44, 15),
               G.plank(1300, 0, 24, 160, 'stone'), G.plank(1500, 0, 24, 160, 'stone'),
               G.pig(1400, 0, 18) ] },

    { name: '战壕', birds: ['white', 'white', 'yellow'],
      items: [ G.plank(960, 0, 24, 150, 'stone'), G.pig(1050, 0, 17),
               G.plank(1140, 0, 24, 150, 'stone'), G.pig(1230, 0, 17),
               G.plank(1320, 0, 24, 150, 'stone'), G.pig(1410, 0, 17),
               G.plank(1490, 0, 24, 150, 'stone') ] },

    { name: '双塔奇兵', birds: ['white', 'black', 'blue', 'yellow'],
      items: [ ...G.tower(1020, 3, 'wood', 50), G.pig(1020, 0, 16), G.pig(1020, 260, 16),
               ...G.tower(1300, 3, 'ice', 50), G.pig(1300, 130, 16), G.pig(1300, 390, 18) ] },

    { name: '龟壳阵', birds: ['black', 'white', 'yellow', 'red'],
      items: [ ...G.pyramid(1150, 0, 4, 'stone', 46),
               G.pig(985, 0, 16), G.pig(1315, 0, 16), G.pig(1150, 200, 16) ] },

    { name: '五鸟合璧', birds: ['red', 'yellow', 'blue', 'black', 'white'],
      items: [ ...G.tower(1080, 2, 'stone', 55), G.pig(1080, 0, 18), G.pig(1080, 260, 18),
               ...G.hut(1320, 0, 'ice', 16), G.tnt(1320, 130),
               ledge(1490, 560, 200), on(560).pig(1490, 0, 18) ] },

    // —— 第 26-30 关：终局挑战 ——
    { name: '大堡垒', birds: ['yellow', 'black', 'blue', 'white'],
      items: [ G.V(950, 0, 'stone'), G.V(1100, 0, 'stone'), G.H(1025, 110, 'stone', 210),
               G.pig(1025, 0, 18),
               ...G.tower(1300, 2, 'wood', 55), G.pig(1300, 0, 16), G.pig(1300, 130, 16),
               ...G.pyramid(1490, 0, 2, 'stone', 44), G.pig(1490, 94, 15) ] },

    { name: '空城计', birds: ['blue', 'blue', 'yellow', 'yellow'],
      items: [ ledge(980, 470, 150), on(470).pig(980, 0, 16),
               ledge(1200, 590, 150), on(590).pig(1200, 0, 16),
               ledge(1420, 430, 150), on(430).pig(1420, 0, 16),
               G.pig(1200, 0, 14) ] },

    { name: '铁桶阵', birds: ['black', 'black', 'white', 'red'],
      items: [ G.plank(1000, 0, 26, 170, 'stone'), G.plank(1130, 0, 26, 170, 'stone'),
               G.H(1065, 170, 'stone', 200), G.pig(1065, 0, 18), G.tnt(1065, 40),
               G.plank(1280, 0, 26, 170, 'stone'), G.plank(1410, 0, 26, 170, 'stone'),
               G.H(1345, 170, 'stone', 200), G.pig(1345, 0, 18), G.tnt(1345, 40) ] },

    { name: '终极要塞', birds: ['red', 'yellow', 'black', 'blue', 'white'],
      items: [ ...G.tower(1050, 3, 'stone', 55), G.pig(1050, 0, 18), G.pig(1050, 260, 16),
               ...G.tower(1330, 3, 'wood', 55), G.pig(1330, 130, 16), G.pig(1330, 390, 18),
               G.tnt(1190, 0), G.pig(1190, 46, 15),
               ledge(1520, 520, 160), on(520).pig(1520, 0, 16) ] },

    { name: '猪王城堡', birds: ['yellow', 'blue', 'black', 'white', 'red'],
      items: [ G.plank(1000, 0, 30, 230, 'stone'), G.plank(1400, 0, 30, 230, 'stone'),
               G.H(1200, 230, 'stone', 460),
               ...on(GY - 250).frame(1200, 0, 'wood', 60),
               on(GY - 250).pig(1200, 0, 34, true),
               G.pig(1090, 0, 16), G.pig(1310, 0, 16), G.tnt(1200, 0),
               ...G.pyramid(870, 0, 2, 'ice', 42), G.pig(870, 94, 14) ] },
  ];

  // ======================= 第 31-100 关：程序化扩展 =======================
  // 沿用同一套结构生成器 DSL，按 7 个篇章 × 10 关推进难度：
  // 31-40 混合材质回归 / 41-50 高台空战 / 51-60 TNT 连锁 / 61-70 石堡
  // 71-80 猪群平原 / 81-90 天空堡垒 / 91-100 传奇挑战
  (function extend() {
    // 确定性伪随机（同一种子永远生成同一关卡）
    function rng(seed) {
      let s = seed >>> 0;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    }
    const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

    // 篇章配置：可用小鸟、主材质、结构偏移、起始编号
    const chapters = [
      { start: 31, birds: ['red', 'yellow', 'blue'],            mats: ['wood', 'ice'],          names: ['回马枪', '冰火交织', '双色阵', '林间伏击', '斜风细雨', '旧部重集', '碎冰连营', '风语塔', '霜降', '木石前盟'] },
      { start: 41, birds: ['yellow', 'blue', 'black', 'red'],   mats: ['ice', 'stone'],         names: ['悬崖哨所', '浮空岛', '云端步道', '峭壁猪堡', '天桥惊魂', '断崖', '空中花园', '层云塔', '临渊一击', '天堑'] },
      { start: 51, birds: ['red', 'black', 'yellow', 'white'],  mats: ['wood', 'stone'],        names: ['火药库', '雷区', '爆裂走廊', '双重引信', '轰然作响', '火线突击', '爆破连营', '轰顶之雷', '震地者', '灰烬要塞'] },
      { start: 61, birds: ['black', 'blue', 'yellow', 'red'],   mats: ['stone'],                names: ['磐石阵', '花岗岩墙', '采石场', '巨石碉楼', '石像守卫', '壁垒森严', '坚不可摧', '石中剑', '碎石机', '岩石王座'] },
      { start: 71, birds: ['red', 'yellow', 'blue', 'white'],   mats: ['wood', 'ice'],          names: ['猪群平原', '万猪奔腾', '绿潮', '猪海战术', '连绵村落', '集市日', '养猪场', '绿皮小镇', '群猪乱舞', '人海尽头'] },
      { start: 81, birds: ['yellow', 'black', 'blue', 'white', 'red'], mats: ['stone', 'ice'],  names: ['浮空要塞', '云上城堡', '天穹塔', '风暴之眼', '苍穹壁垒', '云端王庭', '雷云平台', '天阶', '翱翔之地', '天空之城'] },
      { start: 91, birds: ['red', 'yellow', 'blue', 'black', 'white'], mats: ['wood', 'ice', 'stone'], names: ['传奇之门', '史诗回廊', '英雄试炼', '诸神黄昏', '最后壁垒', '混沌要塞', '王之挑战', '终极回廊', '百万猪王', '传说中的猪堡'] },
    ];

    let lastTmpl = -1; // 记录上一关模板，避免相邻关卡重复
    for (const ch of chapters) {
      for (let i = 0; i < ch.names.length; i++) {
        const n = ch.start + i;
        const r = rng(n * 7919 + 13);
        const items = [];
        const pigs = [];
        const pig = (x, base, rad = 16, on_ = G) => pigs.push(on_.pig(x, base, rad));

        // —— 难度曲线：d 从 0（第 31 关）线性递增到 1（第 100 关） ——
        const d = (n - 31) / 69;
        const pigsN = 3 + Math.round(d * 5);   // 目标猪数：3 → 8
        const hardP = 0.15 + 0.65 * d;         // 石材占比随难度上升
        const matPick = () => (r() < hardP && ch.mats.includes('stone')) ? 'stone' : pick(r, ch.mats);
        const floors = () => Math.min(4, 2 + Math.round(d * 2) + (r() < 0.3 ? 1 : 0)); // 塔高 2→4 层
        const pigR = (max = 22) => Math.min(max, 14 + Math.floor(r() * (5 + Math.round(d * 4)))); // 后期猪更大

        const cx = 1000 + Math.floor(r() * 60);
        const dx = 300 + Math.floor(r() * 80);

        // —— 10 套场景模板：相邻关卡不重复，高难度倾向复杂模板 ——
        // 每套模板向 slots 提供候选猪位（[x, base, 支撑面, 半径上限]），按难度目标取前 pigsN 个
        const T = [
          () => { // 0 双塔 + 金字塔
            const f = floors(), rows = 2 + Math.round(d);
            items.push(...G.tower(cx, f, matPick(), 55));
            items.push(...G.hut(cx + dx, 0, matPick()));
            items.push(...G.pyramid(cx - dx, 0, rows, matPick(), 44));
            if (d > 0.5) items.push(G.tnt(cx + dx + 130, 0));
            return [[cx, 0, G, 20], [cx, 130, G, 18], [cx, f * 130, G, 16],
                    [cx + dx, 0, G, 20], [cx + dx, 130, G, 16], [cx - dx, rows * 46, G, 15],
                    [cx - dx - 80, 0, G, 18], [cx + dx + 190, 0, G, 16]];
          },
          () => { // 1 大屋 + TNT + 副屋
            items.push(...G.hut(cx, 0, matPick(), 20, 60));
            items.push(...G.frame(cx + dx, 0, matPick()));
            items.push(G.tnt(cx + dx, 130));
            items.push(...G.pyramid(cx - dx - 60, 0, 3, matPick(), 42));
            return [[cx, 0, G, 20], [cx, 130, G, 16], [cx + dx, 0, G, 20],
                    [cx - dx - 60, 152, G, 15], [cx - dx - 140, 0, G, 18],
                    [cx + dx + 150, 0, G, 16], [cx - dx + 60, 0, G, 16], [cx, 260, G, 15]];
          },
          () => { // 2 战壕：石墙隔出的猪排
            const wxs = [];
            for (let k = 0; k < 4; k++) {
              const wx = 920 + k * 160 + Math.floor(r() * 20);
              wxs.push(wx);
              items.push(G.plank(wx, 0, 24, 150 + Math.floor(r() * 40) + Math.round(d * 50), matPick()));
            }
            return wxs.map((wx, k) => [wx + 80, 0, G, 15 + k % 3]).concat([[1560, 0, G, 20], [860, 0, G, 16], [1240, 200, G, 15]]);
          },
          () => { // 3 高台空战 + 地面混合
            const ly = 470 + Math.floor(r() * 160);
            items.push(ledge(cx, ly, 260));
            items.push(...on(ly).hut(cx, 0, matPick(), 15, 42));
            items.push(...G.tower(cx + dx, floors(), matPick(), 50));
            if (d > 0.4) items.push(G.tnt(cx - dx + 90, 0));
            return [[cx, 0, on(ly), 17], [cx - 100, 0, on(ly), 15], [cx + 100, 0, on(ly), 15],
                    [cx + dx, 0, G, 18], [cx + dx, 130, G, 15], [cx - dx, 0, G, 18],
                    [cx - dx + 100, 0, G, 15], [cx + dx + 160, 0, G, 16]];
          },
          () => { // 4 重型要塞：双层围护 + TNT 核心（收官关带猪王）
            items.push(G.plank(cx - 140, 0, 28, 200, matPick() === 'ice' ? 'wood' : matPick()));
            items.push(G.plank(cx + 140, 0, 28, 200, matPick() === 'ice' ? 'wood' : matPick()));
            items.push(G.H(cx, 200, matPick(), 340));
            items.push(...on(GY - 200).frame(cx, 0, matPick(), 55));
            items.push(G.tnt(cx, 0));
            const king = (i === ch.names.length - 1 || n === 100);
            const slots = [[cx, 224, on(GY - 200), king ? 34 : 20], [cx - 220, 0, G, 18], [cx + 220, 0, G, 18],
                           [cx - 70, 0, G, 16], [cx + 70, 0, G, 16], [cx + 320, 0, G, 15],
                           [cx - 110, 224, on(GY - 200), 15], [cx + 110, 224, on(GY - 200), 15]];
            return slots;
          },
          () => { // 5 三屋连营
            const xs = [950, 1180, 1410];
            for (const hx of xs) items.push(...G.hut(hx, 0, matPick(), 18, 52));
            if (d > 0.4) items.push(G.tnt(1180, 130));
            if (d > 0.7) items.push(...G.pyramid(1580 - 60, 0, 2, matPick(), 40));
            return xs.map(hx => [[hx, 0, G, 18], [hx, 130, G, 15]]).flat()
                     .concat([[870, 0, G, 16], [1520, 0, G, 16]]);
          },
          () => { // 6 阶梯浮岛
            const l1 = 640 - Math.round(d * 60), l2 = l1 - 130 - Math.floor(r() * 40);
            items.push(ledge(cx, l1, 200));
            items.push(ledge(cx + dx, l2, 200));
            if (d > 0.5) items.push(ledge(cx - dx, l1 - 60, 180));
            items.push(...G.tower(cx - 100, floors(), matPick(), 45));
            const slots = [[cx, 0, on(l1), 17], [cx + dx, 0, on(l2), 17],
                           [cx - 100, 0, G, 16], [cx - 100, 130, G, 15],
                           [cx + 120, 0, G, 18], [cx + 260, 0, G, 15]];
            if (d > 0.5) slots.push([cx - dx, 0, on(l1 - 60), 15]);
            slots.push([cx + 340, 0, G, 16]);
            return slots;
          },
          () => { // 7 金字塔堡垒：护墙夹着大金字塔
            const rows = 3 + (d > 0.5 ? 1 : 0);
            const ph = 120 + Math.round(d * 80);
            items.push(G.plank(cx - 160 - rows * 8, 0, 26, ph, matPick()));
            items.push(G.plank(cx + 160 + rows * 8, 0, 26, ph, matPick()));
            items.push(...G.pyramid(cx, 0, rows, matPick(), 44));
            if (d > 0.6) items.push(G.tnt(cx, 0));
            return [[cx, rows * 46, G, 20], [cx - 250, 0, G, 17], [cx + 250, 0, G, 17],
                    [cx - 330, 0, G, 15], [cx + 330, 0, G, 15], [cx, 0, G, 15],
                    [cx - 250, 200, G, 14], [cx + 250, 200, G, 14]];
          },
          () => { // 8 远方猪岛：够不着的岛上猪 + 地面重兵
            const iy = 380 + Math.floor(r() * 120);
            items.push(ledge(1470, iy, 200));
            items.push(...G.tower(cx, floors(), matPick(), 55));
            items.push(G.plank(cx - 160, 0, 26, 170, matPick()));
            if (d > 0.5) items.push(G.tnt(cx + 160, 0));
            return [[1470, 0, on(iy), 18], [cx, 0, G, 20], [cx, 130, G, 16],
                    [cx - 240, 0, G, 17], [cx + 240, 0, G, 17], [cx - 100, 0, G, 15],
                    [cx + 100, 0, G, 15], [cx, 260, G, 15]];
          },
          () => { // 9 大乱斗：塔 + 屋 + 金字塔 + TNT 全家福
            const f = floors();
            items.push(...G.tower(cx, f, matPick(), 50));
            items.push(...G.hut(cx + dx, 0, matPick()));
            items.push(...G.pyramid(cx - dx, 0, 2 + Math.round(d * 0.5), matPick(), 44));
            items.push(G.tnt(cx + dx + 150, 0));
            items.push(...G.frame(cx - dx - 180, 0, matPick()));
            return [[cx, 0, G, 18], [cx, 130, G, 16], [cx, f * 130, G, 15],
                    [cx + dx, 0, G, 18], [cx + dx, 130, G, 15], [cx - dx, 2 * 46, G, 15],
                    [cx - dx - 180, 0, G, 16], [cx + dx + 220, 0, G, 15]];
          },
        ];

        // 模板选择：低难度只用 0-5，之后全套；相邻关不重复
        const allowed = d < 0.25 ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let ti = allowed[Math.floor(r() * allowed.length)];
        if (ti === lastTmpl) ti = allowed[Math.floor(r() * allowed.length)];
        lastTmpl = ti;        // 按难度目标取猪位并放置
        const slots = T[ti]();
        for (let p = 0; p < Math.min(pigsN, slots.length); p++) {
          const [sx, sbase, son, smax] = slots[p];
          pig(sx, sbase, Math.min(smax, p === 0 && ti === 4 && (i === ch.names.length - 1 || n === 100) ? smax : pigR(smax)), son);
        }

        // 鸟数：按实际总猪数（含小屋内藏猪）计算，前期宽裕、后期收紧
        const totalPigs = pigs.length + items.filter(it => it.t === 'pig').length;
        const cap = totalPigs >= 10 ? 6 : 5; // 猪海关卡放宽到 6 鸟
        const nb = Math.max(3, Math.min(cap, Math.round(totalPigs * (1.35 - 0.5 * d))));
        const birds = [];
        for (let b = 0; b < nb; b++) birds.push(ch.birds[b % ch.birds.length]);

        list.push({ name: ch.names[i], birds, items: [...items, ...pigs] });
      }
    }
  })();

  function get(n) { return list[n - 1] || null; } // n 从 1 开始

  return { get, count: list.length, GY };
})();
