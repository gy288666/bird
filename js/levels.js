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

    { name: '远方来客', birds: ['yellow', 'yellow', 'yellow'],
      items: [ ...G.hut(1300, 0, 'ice', 18), ...G.tower(1480, 2, 'ice', 45),
               G.pig(1480, 0, 16), G.pig(1480, 130, 16),
               G.pig(1160, 0, 16), G.SQ(1160, 36, 44, 'ice') ] },

    // —— 第 11-15 关：石头 + 蓝鸟（分裂三只） ——
    { name: '石门', birds: ['blue', 'blue', 'red', 'red'], hint: '蓝鸟飞行中点击屏幕：一分为三！',
      items: [ G.V(950, 0, 'stone'), G.V(1070, 0, 'stone'), G.H(1010, 110, 'stone', 180),
               G.pig(1010, 0, 18),
               ...G.hut(1280, 0, 'ice'), G.pig(1280, 130, 16) ] },

    { name: '蓝色三重奏', birds: ['blue', 'blue', 'blue'],
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

  function get(n) { return list[n - 1] || null; } // n 从 1 开始

  return { get, count: list.length, GY };
})();
