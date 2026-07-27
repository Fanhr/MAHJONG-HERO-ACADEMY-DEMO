const fs = require('fs');
const path = require('path');
const dagre = require('dagre');

const OUT_DRAWIO = '/Users/hurryfan/CodeBuddy/原型：英雄麻将/英雄麻将-局内游戏流程.drawio';
const OUT_SVG_DIR = '/Users/hurryfan/CodeBuddy/原型：英雄麻将/svg';

// ---------- 1. 定义节点 ----------
// type: start / end / action / decision / ref
// cluster: 分区归属
const N = (id, label, type, cluster) => ({ id, label, type, cluster });

const nodes = [
  // 全局起止
  N('Start', '开始', 'start', 'g'),
  N('EndNode', '结束', 'end', 'g'),

  // 阶段一 开局准备
  N('Prep', '英雄选择', 'action', 'c1'),
  N('BuildDeck', '构筑私有技能卡池', 'action', 'c1'),
  N('Seat', '确定座次与起家', 'action', 'c1'),
  N('InitRes', '初始化HP与AP', 'action', 'c1'),

  // 阶段二 每局发牌
  N('CheckSurvive', '存活玩家 ≥ 2 ?', 'decision', 'c2'),
  N('Shuffle', '洗牌', 'action', 'c2'),
  N('DoraCheck', '角色规则要求宝牌?', 'decision', 'c2'),
  N('GenDora', '生成宝牌标记', 'action', 'c2'),
  N('SkipDora', '跳过宝牌确认', 'action', 'c2'),
  N('Deal', '发放初始手牌', 'action', 'c2'),
  N('SetOrder', '确定行动顺序', 'action', 'c2'),

  // 阶段三 标准回合
  N('TurnStart', '开始阶段', 'action', 'c3'),
  N('APRecover', 'AP恢复1点', 'action', 'c3'),
  N('SkillPhase', '技能释放阶段', 'action', 'c3'),
  N('UseSkill', '使用主动技能?', 'decision', 'c3'),
  N('CastSkill', '消耗AP释放技能', 'action', 'c3'),
  N('SkipSkill', '跳过技能释放', 'action', 'c3'),
  N('DrawPhase', '抽卡阶段', 'action', 'c3'),
  N('Cooldown', '冷却技能卡回池', 'action', 'c3'),
  N('Draw3', '抽取3张候选技能卡', 'action', 'c3'),
  N('Satisfied', '满意候选?', 'decision', 'c3'),
  N('Reroll', '消耗1AP重抽', 'action', 'c3'),
  N('Pick1', '选择1张技能卡', 'action', 'c3'),
  N('ReserveFull', '备用区已满?', 'decision', 'c3'),
  N('ToReserve', '所选卡进入备用区', 'action', 'c3'),
  N('Replace', '替换备用卡?', 'decision', 'c3'),
  N('DoReplace', '替换并回池旧卡', 'action', 'c3'),
  N('ReturnAll', '候选卡全部回池', 'action', 'c3'),
  N('CardPhase', '技能卡使用阶段', 'action', 'c3'),
  N('UseCard', '使用技能卡?', 'decision', 'c3'),
  N('PlayCard', '消耗AP打出技能卡', 'action', 'c3'),
  N('SkipCard', '跳过技能卡使用', 'action', 'c3'),
  N('HasExtra', '含效果摸切?', 'decision', 'c3'),
  N('DrawPhase2', '摸牌阶段', 'action', 'c3'),
  N('DrawTile', '从牌墙顶端摸牌', 'action', 'c3'),
  N('WallEmpty', '牌墙已空?', 'decision', 'c3'),
  N('SelfWin', '手牌和牌?', 'decision', 'c3'),
  N('DeclareSelf', '宣告自摸', 'action', 'c3'),
  N('DiscardPhase', '切牌阶段', 'action', 'c3'),
  N('MarkSafe', '指定安全牌', 'action', 'c3'),
  N('DiscardTile', '打出弃牌', 'action', 'c3'),

  // 效果摸切处理
  N('ExtraLoop', '执行效果摸切', 'action', 'c7'),
  N('ED1', '从牌墙摸1张牌', 'action', 'c7'),
  N('ED2', '立即切1张牌', 'action', 'c7'),
  N('ED3', '开启鸣牌响应窗口', 'action', 'c7'),
  N('MoreExtra', '还有剩余摸切?', 'decision', 'c7'),
  N('GoToDraw', '进入摸牌阶段', 'action', 'c7'),
  N('SourceCheck', '来自效果摸切?', 'decision', 'c7'),

  // 阶段四 鸣牌响应与副露
  N('OpenWindow', '开启4秒响应窗口', 'action', 'c4'),
  N('Collect', '收集吃碰杠荣和意向', 'action', 'c4'),
  N('HasClaim', '窗口期内有声明?', 'decision', 'c4'),
  N('ToGraveyard', '弃牌进入弃牌区', 'action', 'c4'),
  N('HasRon', '存在荣和声明?', 'decision', 'c4'),
  N('Ron', '进入荣和结算', 'action', 'c4'),
  N('ResolvePriority', '按优先级与顺序裁决请求', 'action', 'c4'),
  N('Priority', '最高优先级类型?', 'decision', 'c4'),
  N('Chi', '宣告吃', 'action', 'c4'),
  N('Pon', '宣告碰', 'action', 'c4'),
  N('CanKong', '牌墙有牌?', 'decision', 'c4'),
  N('Kong', '宣告杠', 'action', 'c4'),
  N('IllegalKong', '杠不合法', 'action', 'c4'),
  N('Expose', '副露公开面子', 'action', 'c4'),
  N('IsKong', '是否为杠?', 'decision', 'c4'),
  N('KongDraw', '从牌墙尾端补牌', 'action', 'c4'),
  N('MeldDiscard', '进入切牌阶段', 'action', 'c4'),
  N('KongWin', '补牌和牌?', 'decision', 'c4'),
  N('KongSelf', '宣告自摸', 'action', 'c4'),

  // 阶段五 和牌伤害结算
  N('WinTrigger', '和牌触发', 'action', 'c5'),
  N('WinType', '和牌方式?', 'decision', 'c5'),
  N('RecordSelf', '自摸牌背面入记录区', 'action', 'c5'),
  N('RecordRon', '点炮牌正面入记录区', 'action', 'c5'),
  N('CalcDamage', '计算基础伤害', 'action', 'c5'),
  N('Snap', '锁定伤害快照', 'action', 'c5'),
  N('Target', '伤害目标?', 'decision', 'c5'),
  N('SplitDamage', '平均分配至存活对手', 'action', 'c5'),
  N('DirectDamage', '全部施加于点炮者', 'action', 'c5'),
  N('ApplyDamage', '同步扣减目标HP', 'action', 'c5'),
  N('HPCheck', '目标HP ≤ 0 ?', 'decision', 'c5'),
  N('Eliminate', '判定淘汰', 'action', 'c5'),
  N('NoEliminate', '不淘汰', 'action', 'c5'),
  N('Rebound', '结算反弹与亡语效果', 'action', 'c5'),
  N('StillAlive', '存活玩家 = 1 ?', 'decision', 'c5'),

  // 阶段六 荒牌与局间
  N('Exhaust', '荒牌', 'action', 'c6'),
  N('Confirm', '确认伤害与HP结算完毕', 'action', 'c6'),
  N('CountSurvive', '存活玩家数量?', 'decision', 'c6'),
  N('KeepSafe', '选择安全牌', 'action', 'c6'),
  N('Reshuffle', '重洗其余麻将牌', 'action', 'c6'),
  N('Redeal', '按存活人数发牌', 'action', 'c6'),
  N('GameOver', '对局结束', 'action', 'c6'),
];

// ---------- 2. 定义边 ----------
const E = (s, t, label = '') => ({ s, t, label });
const edges = [
  E('Start', 'Prep'),
  // 阶段一
  E('Prep', 'BuildDeck'), E('BuildDeck', 'Seat'), E('Seat', 'InitRes'),
  E('InitRes', 'CheckSurvive'),
  // 阶段二
  E('CheckSurvive', 'Shuffle', '是'), E('CheckSurvive', 'GameOver', '否'),
  E('Shuffle', 'DoraCheck'),
  E('DoraCheck', 'GenDora', '是'), E('DoraCheck', 'SkipDora', '否'),
  E('GenDora', 'Deal'), E('SkipDora', 'Deal'),
  E('Deal', 'SetOrder'), E('SetOrder', 'TurnStart'),
  // 阶段三
  E('TurnStart', 'APRecover'), E('APRecover', 'SkillPhase'),
  E('SkillPhase', 'UseSkill'),
  E('UseSkill', 'CastSkill', '是'), E('UseSkill', 'SkipSkill', '否'),
  E('CastSkill', 'DrawPhase'), E('SkipSkill', 'DrawPhase'),
  E('DrawPhase', 'Cooldown'), E('Cooldown', 'Draw3'),
  E('Draw3', 'Satisfied'),
  E('Satisfied', 'Reroll', '否'), E('Reroll', 'Draw3'),
  E('Satisfied', 'Pick1', '是'),
  E('Pick1', 'ReserveFull'),
  E('ReserveFull', 'ToReserve', '否'), E('ReserveFull', 'Replace', '是'),
  E('Replace', 'DoReplace', '是'), E('Replace', 'ReturnAll', '否'),
  E('ToReserve', 'CardPhase'), E('DoReplace', 'CardPhase'), E('ReturnAll', 'CardPhase'),
  E('CardPhase', 'UseCard'),
  E('UseCard', 'PlayCard', '是'), E('UseCard', 'SkipCard', '否'),
  E('PlayCard', 'HasExtra'),
  E('HasExtra', 'DrawPhase2', '否'), E('SkipCard', 'DrawPhase2'),
  E('HasExtra', 'ExtraLoop', '是'),
  E('DrawPhase2', 'DrawTile'), E('DrawTile', 'WallEmpty'),
  E('WallEmpty', 'Exhaust', '是'), E('WallEmpty', 'SelfWin', '否'),
  E('SelfWin', 'DeclareSelf', '是'), E('SelfWin', 'DiscardPhase', '否'),
  E('DiscardPhase', 'MarkSafe'), E('MarkSafe', 'DiscardTile'),
  E('DiscardTile', 'OpenWindow'),
  E('DeclareSelf', 'WinTrigger'),
  // 效果摸切
  E('ExtraLoop', 'ED1'), E('ED1', 'ED2'), E('ED2', 'ED3'), E('ED3', 'MoreExtra'),
  E('MoreExtra', 'ExtraLoop', '是'), E('MoreExtra', 'GoToDraw', '否'),
  E('GoToDraw', 'DrawPhase2'),
  E('MeldDiscard', 'SourceCheck'),
  E('SourceCheck', 'ExtraLoop', '是'), E('SourceCheck', 'TurnStart', '否'),
  // 阶段四
  E('OpenWindow', 'Collect'), E('Collect', 'HasClaim'),
  E('HasClaim', 'ToGraveyard', '否'), E('HasClaim', 'HasRon', '是'),
  E('HasRon', 'Ron', '是'), E('HasRon', 'ResolvePriority', '否'),
  E('ResolvePriority', 'Priority'),
  E('Priority', 'Chi', '吃'), E('Priority', 'Pon', '碰'), E('Priority', 'CanKong', '杠'),
  E('CanKong', 'Kong', '是'), E('CanKong', 'IllegalKong', '否'),
  E('Chi', 'Expose'), E('Pon', 'Expose'), E('Kong', 'Expose'),
  E('IllegalKong', 'ToGraveyard'),
  E('Expose', 'IsKong'),
  E('IsKong', 'KongDraw', '是'), E('IsKong', 'MeldDiscard', '否'),
  E('KongDraw', 'KongWin'),
  E('KongWin', 'KongSelf', '是'), E('KongWin', 'MeldDiscard', '否'),
  E('KongSelf', 'WinTrigger'),
  E('Ron', 'WinTrigger'),
  E('ToGraveyard', 'TurnStart'),
  // 阶段五
  E('WinTrigger', 'WinType'),
  E('WinType', 'RecordSelf', '自摸'), E('WinType', 'RecordRon', '荣和'),
  E('RecordSelf', 'CalcDamage'), E('RecordRon', 'CalcDamage'),
  E('CalcDamage', 'Snap'), E('Snap', 'Target'),
  E('Target', 'SplitDamage', '自摸'), E('Target', 'DirectDamage', '荣和'),
  E('SplitDamage', 'ApplyDamage'), E('DirectDamage', 'ApplyDamage'),
  E('ApplyDamage', 'HPCheck'),
  E('HPCheck', 'Eliminate', '是'), E('HPCheck', 'NoEliminate', '否'),
  E('Eliminate', 'Rebound'), E('NoEliminate', 'Rebound'),
  E('Rebound', 'StillAlive'),
  E('StillAlive', 'GameOver', '是'), E('StillAlive', 'TurnStart', '否'),
  // 阶段六
  E('Exhaust', 'Confirm'), E('Confirm', 'CountSurvive'),
  E('CountSurvive', 'GameOver', '=1'), E('CountSurvive', 'KeepSafe', '≥2'),
  E('KeepSafe', 'Reshuffle'), E('Reshuffle', 'Redeal'), E('Redeal', 'SetOrder'),
  E('GameOver', 'EndNode'),
];

// ---------- 3. dagre 布局 ----------
const sizeOf = (t) => {
  if (t === 'decision') return { w: 170, h: 80 };
  if (t === 'start' || t === 'end') return { w: 130, h: 54 };
  return { w: 180, h: 54 };
};

const g = new dagre.graphlib.Graph({ compound: true });
g.setGraph({ rankdir: 'TB', nodesep: 55, ranksep: 60, marginx: 30, marginy: 30, ranker: 'network-simplex' });
g.setDefaultEdgeLabel(() => ({}));

const nodeMap = {};
nodes.forEach(n => {
  nodeMap[n.id] = n;
  const s = sizeOf(n.type);
  g.setNode(n.id, { width: s.w, height: s.h });
});
edges.forEach(e => g.setEdge(e.s, e.t, { minlen: 1 }));

dagre.layout(g);

// ---------- 4. 分区包围盒 ----------
const clusters = {
  c1: { title: '阶段一 · 开局准备', color: 'blue' },
  c2: { title: '阶段二 · 每局发牌', color: 'orange' },
  c3: { title: '阶段三 · 标准回合', color: 'purple' },
  c7: { title: '效果摸切处理', color: 'teal' },
  c4: { title: '阶段四 · 鸣牌响应与副露', color: 'green' },
  c5: { title: '阶段五 · 和牌伤害结算', color: 'red' },
  c6: { title: '阶段六 · 荒牌与局间', color: 'gray' },
};
const clusterColors = {
  blue: ['#eaf2f8', '#6c8ebf'], orange: ['#fef5e7', '#d79b00'],
  purple: ['#f4ecf7', '#9673a6'], teal: ['#e8f8f5', '#0e8088'],
  green: ['#e9f7ef', '#2e8b57'], red: ['#fdedec', '#b85450'],
  gray: ['#f4f6f6', '#666666'],
};
const typeColors = {
  start: ['#d5e8d4', '#82b366'], end: ['#f8cecc', '#b85450'],
  action: ['#dae8fc', '#6c8ebf'], decision: ['#fff2cc', '#d6b656'],
};

const box = {};
nodes.forEach(n => {
  if (n.cluster === 'g') return;
  const nd = g.node(n.id);
  const x1 = nd.x - nd.width / 2, y1 = nd.y - nd.height / 2;
  const x2 = nd.x + nd.width / 2, y2 = nd.y + nd.height / 2;
  const b = box[n.cluster] || { x1: 1e9, y1: 1e9, x2: -1e9, y2: -1e9 };
  b.x1 = Math.min(b.x1, x1); b.y1 = Math.min(b.y1, y1);
  b.x2 = Math.max(b.x2, x2); b.y2 = Math.max(b.y2, y2);
  box[n.cluster] = b;
});
const PAD = 24, TITLE = 30;
Object.values(box).forEach(b => { b.x1 -= PAD; b.x2 += PAD; b.y1 -= PAD + TITLE; b.y2 += PAD; });

// ---------- 5. 生成 drawio XML ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let cells = [];
let eid = 0;

// clusters first (background)
Object.entries(box).forEach(([cid, b]) => {
  const c = clusters[cid];
  const [fill, stroke] = clusterColors[c.color];
  cells.push(`<mxCell id="cl_${cid}" value="${esc(c.title)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fillOpacity=30;verticalAlign=top;fontStyle=1;fontSize=15;fontColor=#333333;arcSize=6;" vertex="1" parent="1"><mxGeometry x="${b.x1.toFixed(0)}" y="${b.y1.toFixed(0)}" width="${(b.x2-b.x1).toFixed(0)}" height="${(b.y2-b.y1).toFixed(0)}" as="geometry"/></mxCell>`);
});

// nodes
nodes.forEach(n => {
  const nd = g.node(n.id);
  const [fill, stroke] = typeColors[n.type];
  let shape;
  if (n.type === 'decision') shape = 'rhombus;whiteSpace=wrap;html=1;';
  else if (n.type === 'start' || n.type === 'end') shape = 'rounded=1;arcSize=50;whiteSpace=wrap;html=1;';
  else shape = 'rounded=1;arcSize=20;whiteSpace=wrap;html=1;';
  const style = `${shape}fillColor=${fill};strokeColor=${stroke};fontSize=13;align=center;verticalAlign=middle;spacing=4;`;
  const x = (nd.x - nd.width / 2).toFixed(0), y = (nd.y - nd.height / 2).toFixed(0);
  cells.push(`<mxCell id="${n.id}" value="${esc(n.label)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${nd.width}" height="${nd.height}" as="geometry"/></mxCell>`);
});

// edges (use dagre computed points for smoother orthogonal-ish routing)
edges.forEach(e => {
  eid++;
  const ge = g.edge(e.s, e.t);
  let pts = '';
  if (ge && ge.points && ge.points.length > 2) {
    const mid = ge.points.slice(1, -1);
    pts = '<Array as="points">' + mid.map(p => `<mxPoint x="${p.x.toFixed(0)}" y="${p.y.toFixed(0)}"/>`).join('') + '</Array>';
  }
  const style = `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;strokeColor=#4d4d4d;strokeWidth=1.4;jettySize=auto;`;
  cells.push(`<mxCell id="ed${eid}" value="${esc(e.label)}" style="${style}" edge="1" parent="1" source="${e.s}" target="${e.t}"><mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`);
});

const gg = g.graph();
const W = Math.ceil(gg.width + 60), H = Math.ceil(gg.height + 60);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" agent="With" version="26.0.9" type="device">
  <diagram id="flow" name="英雄麻将局内流程">
    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${W}" pageHeight="${H}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${cells.join('\n        ')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

fs.writeFileSync(OUT_DRAWIO, xml, 'utf-8');
console.log('drawio written:', OUT_DRAWIO, 'size', W, 'x', H);

// ---------- 6. 导出 SVG ----------
if (!fs.existsSync(OUT_SVG_DIR)) fs.mkdirSync(OUT_SVG_DIR);
let svg = [];
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="PingFang SC,Helvetica,Arial,sans-serif">`);
svg.push(`<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#4d4d4d"/></marker></defs>`);
svg.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
// clusters
Object.entries(box).forEach(([cid, b]) => {
  const c = clusters[cid];
  const [fill, stroke] = clusterColors[c.color];
  svg.push(`<rect x="${b.x1.toFixed(0)}" y="${b.y1.toFixed(0)}" width="${(b.x2-b.x1).toFixed(0)}" height="${(b.y2-b.y1).toFixed(0)}" rx="8" fill="${fill}" fill-opacity="0.4" stroke="${stroke}" stroke-width="1.5"/>`);
  svg.push(`<text x="${(b.x1+12).toFixed(0)}" y="${(b.y1+20).toFixed(0)}" font-size="15" font-weight="bold" fill="#333">${esc(c.title)}</text>`);
});
// edges
edges.forEach(e => {
  const ge = g.edge(e.s, e.t);
  const pts = ge.points;
  const d = 'M ' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');
  svg.push(`<path d="${d}" fill="none" stroke="#4d4d4d" stroke-width="1.4" marker-end="url(#arrow)"/>`);
  if (e.label) {
    const m = pts[Math.floor(pts.length / 2)];
    svg.push(`<rect x="${(m.x-11).toFixed(0)}" y="${(m.y-10).toFixed(0)}" width="22" height="16" fill="#fff" opacity="0.85"/>`);
    svg.push(`<text x="${m.x.toFixed(0)}" y="${(m.y+3).toFixed(0)}" text-anchor="middle" font-size="12" fill="#b85450">${esc(e.label)}</text>`);
  }
});
// nodes
const wrap = (t, w) => {
  const per = Math.max(1, Math.floor(w / 13.5));
  const out = []; let cur = '';
  for (const ch of t) { cur += ch; if (cur.length >= per) { out.push(cur); cur = ''; } }
  if (cur) out.push(cur);
  return out.length ? out : [''];
};
nodes.forEach(n => {
  const nd = g.node(n.id);
  const [fill, stroke] = typeColors[n.type];
  const x = nd.x - nd.width / 2, y = nd.y - nd.height / 2;
  if (n.type === 'decision')
    svg.push(`<polygon points="${nd.x},${y} ${x+nd.width},${nd.y} ${nd.x},${y+nd.height} ${x},${nd.y}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`);
  else
    svg.push(`<rect x="${x}" y="${y}" width="${nd.width}" height="${nd.height}" rx="${n.type==='start'||n.type==='end'?27:10}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`);
  const lines = wrap(n.label, nd.width - 16);
  const sy = nd.y - (lines.length - 1) * 8;
  lines.forEach((ln, i) => svg.push(`<text x="${nd.x}" y="${(sy + i*16 + 4).toFixed(0)}" text-anchor="middle" font-size="13" fill="#111">${esc(ln)}</text>`));
});
svg.push('</svg>');
fs.writeFileSync(path.join(OUT_SVG_DIR, '英雄麻将-局内游戏流程.svg'), svg.join('\n'), 'utf-8');
console.log('svg written');

// ---------- 7. 交叉检测 ----------
function segInter(a, b, c, d) {
  const ccw = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = ccw(c, d, a), d2 = ccw(c, d, b), d3 = ccw(a, b, c), d4 = ccw(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}
const allSegs = [];
edges.forEach((e, idx) => {
  const p = g.edge(e.s, e.t).points;
  for (let i = 0; i < p.length - 1; i++) allSegs.push({ idx, s: e.s, t: e.t, a: p[i], b: p[i + 1] });
});
let crossings = 0;
for (let i = 0; i < allSegs.length; i++)
  for (let j = i + 1; j < allSegs.length; j++) {
    const A = allSegs[i], B = allSegs[j];
    if (A.s === B.s || A.s === B.t || A.t === B.s || A.t === B.t) continue;
    if (segInter(A.a, A.b, B.a, B.b)) crossings++;
  }
console.log('edge crossings (approx):', crossings);
