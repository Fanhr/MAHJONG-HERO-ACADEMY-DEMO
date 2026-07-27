from xml.etree.ElementTree import Element, SubElement, ElementTree
from pathlib import Path

OUT = Path('/Users/hurryfan/CodeBuddy/原型：英雄麻将/英雄麻将-局内游戏流程.drawio')

EDGE_SEQ = [0]

COLORS = {
    'start': ('#d5e8d4', '#82b366'),
    'action': ('#dae8fc', '#6c8ebf'),
    'decision': ('#fff2cc', '#d6b656'),
    'sub': ('#e1d5e7', '#9673a6'),
    'end': ('#f8cecc', '#b85450'),
    'note': ('#f5f5f5', '#666666'),
    'phase1': ('#eaf2f8', '#6c8ebf'),
    'phase2': ('#fef5e7', '#d79b00'),
    'phase3': ('#f4ecf7', '#9673a6'),
    'phase4': ('#e8f8f5', '#0e8088'),
}

class Diagram:
    def __init__(self, mxfile, name, did, w=1800, h=2400):
        self.diagram = SubElement(mxfile, 'diagram', {'id': did, 'name': name})
        self.model = SubElement(self.diagram, 'mxGraphModel', {
            'dx': '1200', 'dy': '900', 'grid': '1', 'gridSize': '10', 'guides': '1',
            'tooltips': '1', 'connect': '1', 'arrows': '1', 'fold': '1', 'page': '1',
            'pageScale': '1', 'pageWidth': str(w), 'pageHeight': str(h), 'math': '0', 'shadow': '0'
        })
        self.root = SubElement(self.model, 'root')
        SubElement(self.root, 'mxCell', {'id': '0'})
        SubElement(self.root, 'mxCell', {'id': '1', 'parent': '0'})
        self.n = 1
        self.cells = {}

    def phase(self, key, title, x, y, w, h, color='phase1'):
        fill, stroke = COLORS[color]
        cell = SubElement(self.root, 'mxCell', {
            'id': key, 'value': title,
            'style': f'swimlane;html=1;rounded=1;startSize=34;horizontal=1;fillColor={fill};strokeColor={stroke};fontStyle=1;fontSize=15;collapsible=0;whiteSpace=wrap;',
            'vertex': '1', 'parent': '1'
        })
        SubElement(cell, 'mxGeometry', {'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h), 'as': 'geometry'})
        self.cells[key] = cell
        return key

    def node(self, key, text, x, y, w=190, h=56, kind='action', parent='1'):
        fill, stroke = COLORS[kind]
        shape = 'rhombus' if kind == 'decision' else 'ellipse' if kind in ('start', 'end') else 'rounded=1'
        extra = 'arcSize=18;' if kind in ('action', 'sub', 'note') else ''
        dashed = 'dashed=1;' if kind == 'note' else ''
        cell = SubElement(self.root, 'mxCell', {
            'id': key, 'value': text,
            'style': f'{shape};whiteSpace=wrap;html=1;{extra}{dashed}fillColor={fill};strokeColor={stroke};fontSize=13;align=center;verticalAlign=middle;spacing=6;',
            'vertex': '1', 'parent': parent
        })
        SubElement(cell, 'mxGeometry', {'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h), 'as': 'geometry'})
        self.cells[key] = cell
        return key

    def edge(self, source, target, label='', color='#4d4d4d', dashed=False, points=None):
        EDGE_SEQ[0] += 1
        style = f'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;strokeWidth=1.4;strokeColor={color};'
        if dashed:
            style += 'dashed=1;'
        cell = SubElement(self.root, 'mxCell', {
            'id': f'edge{EDGE_SEQ[0]}', 'value': label, 'style': style,
            'edge': '1', 'parent': '1', 'source': source, 'target': target
        })
        geo = SubElement(cell, 'mxGeometry', {'relative': '1', 'as': 'geometry'})
        if points:
            arr = SubElement(geo, 'Array', {'as': 'points'})
            for x, y in points:
                SubElement(arr, 'mxPoint', {'x': str(x), 'y': str(y)})
        return cell


def chain(d, ids):
    for a, b in zip(ids, ids[1:]):
        d.edge(a, b)

mxfile = Element('mxfile', {'host': 'app.diagrams.net', 'modified': '2026-07-21T00:00:00.000Z', 'agent': 'With', 'version': '26.0.9', 'type': 'device', 'compressed': 'false'})

# Page 1: overall flow
D = Diagram(mxfile, '01 对局总览', 'overview', 1800, 2500)
D.phase('p1', 'A. 开局准备（整场仅执行一次）', 40, 40, 520, 700, 'phase1')
D.phase('p2', 'B. 每局发牌', 620, 40, 520, 700, 'phase2')
D.phase('p3', 'C. 进行与即时胜负', 1200, 40, 540, 1460, 'phase3')
D.phase('p4', 'D. 荒牌与跨局', 620, 820, 520, 1380, 'phase4')
D.node('s', '对局开始', 190, 90, 210, 54, 'start')
D.node('a1', '每位玩家选择英雄', 200, 175)
D.node('a2', '生成私有技能卡池', 200, 265)
D.node('a3', '确定座次', 200, 355)
D.node('a4', '确定起家', 200, 445)
D.node('a5', '设置玩家HP', 200, 535)
D.node('a6', '设置玩家AP', 200, 625)
chain(D, ['s','a1','a2','a3','a4','a5','a6'])
D.node('b1', '洗匀136张麻将牌', 785, 90)
D.node('b2', '存在特殊牌机制？', 775, 185, 210, 90, 'decision')
D.node('b3', '确定特殊牌标记', 655, 330)
D.node('b4', '展示特殊牌标记', 655, 420)
D.node('b5', '向每位玩家发13张牌', 895, 420)
D.node('b6', '设置本局行动顺序', 775, 535)
D.node('b7', '指定起家为当前玩家', 775, 625)
D.edge('b1','b2'); D.edge('b2','b3','是'); D.edge('b3','b4'); D.edge('b4','b5'); D.edge('b2','b5','否'); D.edge('b5','b6'); D.edge('b6','b7')
D.edge('a6','b1', points=[(590,660),(590,115)])
D.node('c1', '执行当前行动链\n参见第02、04、05页', 1370, 110, 200, 76, 'sub')
D.node('c2', '完成即时伤害结算？', 1360, 245, 220, 90, 'decision')
D.node('c3', '存活玩家仅1人？', 1360, 395, 220, 90, 'decision')
D.node('c4', '公开终局结算明细', 1375, 555)
D.node('c5', '宣布最终胜利者', 1375, 650)
D.node('c6', '对局结束', 1385, 750, 170, 54, 'end')
D.node('c7', '牌墙已耗尽？', 1360, 900, 220, 90, 'decision')
D.node('c8', '完成末次获牌相关流程？', 1360, 1050, 220, 90, 'decision')
D.node('c9', '切换当前玩家', 1375, 1200)
D.edge('b7','c1', points=[(1170,660),(1170,148)])
D.edge('c1','c2'); D.edge('c2','c3','是'); D.edge('c3','c4','是'); D.edge('c4','c5'); D.edge('c5','c6')
D.edge('c2','c7','否'); D.edge('c3','c7','否'); D.edge('c7','c8','是'); D.edge('c7','c9','否'); D.edge('c8','c9','否'); D.edge('c9','c1', points=[(1650,1230),(1650,148)])
D.node('d1', '确认后续效果已结算', 785, 875)
D.node('d2', '确认各玩家HP', 785, 965)
D.node('d3', '存活玩家仅1人？', 775, 1060, 210, 90, 'decision')
D.node('d4', '保留玩家HP', 785, 1210)
D.node('d5', '保留玩家AP', 785, 1300)
D.node('d6', '保留技能卡区域状态', 785, 1390)
D.node('d7', '移除已淘汰席位', 785, 1480)
D.node('d8', '存活玩家数为4？', 775, 1580, 210, 90, 'decision')
D.node('d9', '每位玩家选择保留手牌', 650, 1730)
D.node('d10', '收集其余麻将牌', 650, 1820)
D.node('d11', '每位玩家重发13张牌', 650, 1910)
D.node('d12', '每位玩家选择保留手牌', 900, 1730)
D.node('d13', '收集其余麻将牌', 900, 1820)
D.node('d14', '按座次补足13张牌', 900, 1910)
D.node('d15', '确定上一局起家的下家', 775, 2040)
D.node('d16', '跳过已淘汰席位', 775, 2130)
D.node('d17', '设置新局起家', 775, 2220)
D.edge('c8','d1','是', points=[(1180,1095),(1180,903)])
chain(D, ['d1','d2','d3'])
D.edge('d3','c4','是', points=[(1190,1105),(1190,583)])
D.edge('d3','d4','否'); chain(D, ['d4','d5','d6','d7','d8'])
D.edge('d8','d9','是'); chain(D, ['d9','d10','d11']); D.edge('d8','d12','否'); chain(D, ['d12','d13','d14'])
D.edge('d11','d15'); D.edge('d14','d15'); chain(D, ['d15','d16','d17'])
D.edge('d17','b1', points=[(590,2250),(590,115)])

# Page 2: standard turn
D = Diagram(mxfile, '02 标准回合', 'turn', 1900, 2700)
D.phase('tpa', '1. 开始阶段', 40, 40, 360, 520, 'phase1')
D.phase('tpb', '2. 技能释放阶段', 430, 40, 360, 520, 'phase2')
D.phase('tpc', '3. 抽卡阶段', 820, 40, 520, 1260, 'phase3')
D.phase('tpd', '4. 技能卡使用阶段', 1370, 40, 480, 1260, 'phase4')
D.phase('tpe', '5. 摸牌阶段', 430, 1380, 500, 1050, 'phase1')
D.phase('tpf', '6. 切牌阶段', 1010, 1380, 600, 1050, 'phase2')
D.node('ts','当前玩家回合开始',115,90,210,54,'start')
D.node('t1','结算回合开始效果',125,190)
D.node('t2','恢复1点AP',125,290)
D.node('t3','限制AP至上限',125,390)
chain(D,['ts','t1','t2','t3'])
D.node('t4','选择释放主动技能？',505,150,210,90,'decision')
D.node('t5','检查技能所需AP',515,300)
D.node('t6','扣除技能AP',515,390)
D.node('t7','结算主动技能',515,480)
D.edge('t3','t4'); D.edge('t4','t5','是'); chain(D,['t5','t6','t7'])
D.node('t8','返还到期冷却卡',985,100)
D.node('t9','抽取3张候选卡',985,190)
D.node('t10','选择重抽？',975,290,210,90,'decision')
D.node('t11','AP至少1点？',975,430,210,90,'decision')
D.node('t12','返还全部候选卡',855,570)
D.node('t13','扣除1点AP',855,660)
D.node('t14','选择1张候选卡？',1085,570,210,90,'decision')
D.node('t15','备用区已满？',1085,710,210,90,'decision')
D.node('t16','所选卡进入备用区',960,860)
D.node('t17','选择替换备用卡？',1190,850,210,90,'decision')
D.node('t18','返还被替换卡',1185,990)
D.node('t19','所选卡进入备用区',1185,1080)
D.node('t20','返还全部候选卡',960,1130)
D.edge('t4','t8','否'); D.edge('t7','t8'); chain(D,['t8','t9','t10'])
D.edge('t10','t11','是'); D.edge('t11','t12','是'); D.edge('t12','t13'); D.edge('t13','t9', points=[(835,705),(835,218)])
D.edge('t11','t14','否'); D.edge('t10','t14','否'); D.edge('t14','t15','是'); D.edge('t14','t20','否'); D.edge('t15','t16','否'); D.edge('t15','t17','是'); D.edge('t17','t18','是'); D.edge('t18','t19'); D.edge('t17','t20','否')
D.node('u1','选择打出技能卡？',1505,160,210,90,'decision')
D.node('u2','AP足够？',1505,310,210,90,'decision')
D.node('u3','扣除技能卡AP',1515,450)
D.node('u4','结算技能卡效果',1515,540)
D.node('u5','效果实际激活？',1505,640,210,90,'decision')
D.node('u6','公开已激活效果',1515,780)
D.node('u7','包含效果摸切？',1505,880,210,90,'decision')
D.node('u8','执行效果摸切\n参见第05页',1510,1020,200,70,'sub')
D.node('u9','技能卡进入冷却区',1515,1150)
for src in ['t16','t19','t20']:
    D.edge(src,'u1')
D.edge('u1','u2','是'); D.edge('u2','u3','是'); chain(D,['u3','u4','u5']); D.edge('u5','u6','是'); D.edge('u6','u7'); D.edge('u5','u7','否'); D.edge('u7','u8','是'); D.edge('u8','u9'); D.edge('u7','u9','否'); D.edge('u9','u1', points=[(1770,1180),(1770,205)])
D.node('m1','牌墙有牌？',575,1440,210,90,'decision')
D.node('m2','从牌墙顶端摸1张牌',585,1590)
D.node('m3','手牌构成合法牌型？',575,1690,210,90,'decision')
D.node('m4','玩家宣告自摸？',575,1830,210,90,'decision')
D.node('m5','执行和牌结算\n参见第03页',580,1970,200,70,'sub')
D.node('m6','移出本次自摸牌',585,2080)
D.node('m7','本回合结束',595,2200,170,54,'end')
D.edge('u1','m1','否'); D.edge('u2','m1','否'); D.edge('m1','m2','是'); chain(D,['m2','m3']); D.edge('m3','m4','是'); D.edge('m4','m5','是'); D.edge('m5','m6'); D.edge('m6','m7')
D.node('x0','触发荒牌检查\n参见第06页',690,1480,190,70,'sub'); D.edge('m1','x0','否')
D.node('q1','重新指定0至4张安全牌',1135,1450,230,60)
D.node('q2','选择1张手牌',1155,1560)
D.node('q3','将所选牌置入弃牌区',1155,1660)
D.node('q4','开启4秒响应窗口',1155,1760)
D.node('q5','执行鸣牌响应\n参见第04页',1150,1870,200,70,'sub')
D.node('q6','行动权被副露转移？',1145,1990,210,90,'decision')
D.node('q7','指定座次下一人为当前玩家',1135,2140,230,60)
D.node('q8','当前行动链结束',1165,2250,170,54,'end')
for src in ['m3','m4']:
    D.edge(src,'q1','否')
chain(D,['q1','q2','q3','q4','q5','q6']); D.edge('q6','q7','否'); D.edge('q7','q8'); D.edge('q6','q8','是')

# Page 3: win settlement
D = Diagram(mxfile, '03 和牌与即时伤害结算', 'win', 1700, 2400)
D.phase('wp1','A. 建立快照',40,40,500,940,'phase1')
D.phase('wp2','B. 分配伤害',590,40,500,940,'phase2')
D.phase('wp3','C. 同步结算',1140,40,500,1600,'phase3')
D.node('ws','收到和牌宣告',175,90,220,54,'start')
D.node('w1','验证牌型合法性',190,190)
D.node('w2','计算基础伤害',190,290)
D.node('w3','锁定和牌者',190,390)
D.node('w4','锁定伤害值',190,490)
D.node('w5','锁定目标状态',190,590)
D.node('w6','锁定存活人数',190,690)
D.node('w7','锁定防御状态',190,790)
chain(D,['ws','w1','w2','w3','w4','w5','w6','w7'])
D.node('w8','和牌方式为荣和？',735,120,210,90,'decision')
D.node('w9','收集全部合法荣和者',745,280)
D.node('w10','指定点炮者为目标',745,380)
D.node('w11','生成正面荣和记录',745,480)
D.node('w12','统计存活对手人数',745,610)
D.node('w13','平均分配自摸伤害',745,710)
D.node('w14','生成背面自摸记录',745,810)
D.edge('w7','w8'); D.edge('w8','w9','是'); chain(D,['w9','w10','w11']); D.edge('w8','w12','否'); chain(D,['w12','w13','w14'])
D.node('w15','同步扣减目标HP',1295,130)
D.node('w16','统一判定HP≤0',1295,250)
D.node('w17','存在淘汰玩家？',1285,370,210,90,'decision')
D.node('w18','标记淘汰玩家',1295,520)
D.node('w19','移除淘汰玩家',1295,620)
D.node('w20','向淘汰者公开相关明细',1280,720,220,60)
D.node('w21','结算反弹效果',1295,850)
D.node('w22','结算后续效果',1295,950)
D.node('w23','公开本次伤害数值',1295,1050)
D.node('w24','存活玩家仅1人？',1285,1170,210,90,'decision')
D.node('w25','公开全场和牌明细',1295,1320)
D.node('w26','宣布最终胜利者',1295,1420)
D.node('we','对局结束',1305,1530,170,54,'end')
D.node('wr','返回原行动链',1305,1660,170,54,'end')
D.edge('w11','w15'); D.edge('w14','w15'); chain(D,['w15','w16','w17']); D.edge('w17','w18','是'); chain(D,['w18','w19','w20','w21']); D.edge('w17','w21','否'); chain(D,['w21','w22','w23','w24']); D.edge('w24','w25','是'); chain(D,['w25','w26','we']); D.edge('w24','wr','否')

# Page 4: response and meld
D = Diagram(mxfile, '04 鸣牌响应与副露打断', 'response', 2000, 2900)
D.phase('rp1','A. 收集与裁决',40,40,600,1600,'phase1')
D.phase('rp2','B. 执行最高优先级请求',690,40,620,2100,'phase2')
D.phase('rp3','C. 恢复行动链',1360,40,580,2100,'phase3')
D.node('rs','弃牌进入弃牌区',225,90,220,54,'start')
D.node('r1','开启4秒响应窗口',240,190)
D.node('r2','收集最终确认意向',240,290)
D.node('r3','关闭响应窗口',240,390)
D.node('r4','存在合法荣和？',230,500,210,90,'decision')
D.node('r5','存在合法碰或杠？',230,650,210,90,'decision')
D.node('r6','选择顺位最先请求者',240,800)
D.node('r7','存在合法吃？',230,920,210,90,'decision')
D.node('r8','选择合法吃请求者',240,1070)
D.node('r9','存在合法区域变更效果？',220,1190,230,90,'decision')
D.node('r10','选择最高优先级效果',240,1340)
D.node('r11','无请求成立',250,1480)
chain(D,['rs','r1','r2','r3','r4']); D.edge('r4','r5','否'); D.edge('r5','r6','是'); D.edge('r5','r7','否'); D.edge('r7','r8','是'); D.edge('r7','r9','否'); D.edge('r9','r10','是'); D.edge('r9','r11','否')
D.node('rr1','收集全部荣和者',855,130)
D.node('rr2','执行荣和结算\n参见第03页',850,240,200,70,'sub')
D.node('rr3','弃牌不再响应其他请求',835,360,230,60)
D.edge('r4','rr1','是'); chain(D,['rr1','rr2','rr3'])
D.node('rm1','请求类型为杠？',855,510,210,90,'decision')
D.node('rm2','公开副露面子',865,650)
D.node('rm3','转移行动权',865,750)
D.node('rm4','牌墙仍有牌？',855,860,210,90,'decision')
D.node('rm5','从牌墙尾端摸1张牌',865,1010)
D.node('rm6','补牌构成合法牌型？',855,1120,210,90,'decision')
D.node('rm7','玩家宣告自摸？',855,1270,210,90,'decision')
D.node('rm8','执行和牌结算\n参见第03页',860,1410,200,70,'sub')
D.node('rm9','重新指定安全牌',865,1540)
D.node('rm10','选择1张手牌',865,1640)
D.node('rm11','将所选牌置入弃牌区',865,1740)
D.node('rm12','递归开启响应窗口',865,1840)
D.node('ro1','执行区域变更效果',865,1980)
D.edge('r6','rm1'); D.edge('r8','rm2'); D.edge('rm1','rm2','否'); chain(D,['rm2','rm3'])
D.edge('rm1','rm4','是'); D.edge('rm4','rm5','是'); chain(D,['rm5','rm6']); D.edge('rm6','rm7','是'); D.edge('rm7','rm8','是'); D.edge('rm6','rm9','否'); D.edge('rm7','rm9','否'); chain(D,['rm9','rm10','rm11','rm12'])
D.edge('r10','ro1')
D.node('rc1','弃牌来源为效果摸切？',1510,230,230,90,'decision')
D.node('rc2','副露链已完全结束？',1510,390,230,90,'decision')
D.node('rc3','返回效果发动玩家',1525,550)
D.node('rc4','恢复被中断位置',1525,650)
D.node('rc5','继续原效果',1525,750)
D.node('rc6','指定副露玩家的下一位',1510,940,220,60)
D.node('rc7','结束当前行动链',1535,1050,170,54,'end')
D.node('rc8','保持原行动顺序',1525,1210)
D.node('rc9','返回调用流程',1535,1320,170,54,'end')
for src in ['rr3','rm8','rm12','ro1','r11']:
    D.edge(src,'rc1')
D.edge('rc1','rc2','是'); D.edge('rc2','rc3','是'); chain(D,['rc3','rc4','rc5']); D.edge('rc5','rc9'); D.edge('rc2','rc1','否', points=[(1840,435),(1840,275)])
D.edge('rc1','rc6','否，发生副露'); D.edge('rc6','rc7'); D.edge('r11','rc8', points=[(1320,1510),(1320,1240)]); D.edge('rc8','rc9')
D.node('rn','规则：荣和 ＞ 碰/杠 ＞ 吃 ＞ 区域变更效果',1450,1510,400,70,'note')

# Page 5: effect draw-discard
D = Diagram(mxfile, '05 效果摸切与中断恢复', 'effect', 1600, 2300)
D.phase('ep1','A. 执行单次效果摸切',40,40,700,1500,'phase1')
D.phase('ep2','B. 恢复原效果',790,40,760,1500,'phase2')
D.node('es','技能效果要求摸切',260,90,220,54,'start')
D.node('e1','记录原效果位置',275,190)
D.node('e2','记录剩余摸切次数',275,290)
D.node('e3','牌墙有牌？',265,400,210,90,'decision')
D.node('e4','从牌墙顶端摸1张牌',275,550)
D.node('e5','选择1张手牌',275,650)
D.node('e6','将所选牌置入弃牌区',275,750)
D.node('e7','减少1次剩余摸切',275,850)
D.node('e8','执行鸣牌响应\n参见第04页',270,960,200,70,'sub')
D.node('e9','发生副露打断？',265,1090,210,90,'decision')
D.node('e10','执行副露必要行动',275,1240)
D.node('e11','等待副露链结束',275,1340)
D.node('ex','触发荒牌检查\n参见第06页',505,420,190,70,'sub')
chain(D,['es','e1','e2','e3']); D.edge('e3','e4','是'); chain(D,['e4','e5','e6','e7','e8','e9']); D.edge('e9','e10','是'); D.edge('e10','e11'); D.edge('e3','ex','否')
D.node('er1','行动权返回发动玩家',1040,180)
D.node('er2','恢复原效果位置',1040,280)
D.node('er3','仍有剩余摸切？',1030,400,210,90,'decision')
D.node('er4','继续原效果下一步骤',1040,570)
D.node('er5','原效果已完成？',1030,690,210,90,'decision')
D.node('er6','进入原定下一阶段',1040,850)
D.node('ee','返回标准回合',1050,970,170,54,'end')
D.edge('e11','er1'); chain(D,['er1','er2','er3']); D.edge('er3','e3','是', points=[(780,445),(780,445)]); D.edge('er3','er4','否'); D.edge('e9','er4','否'); D.edge('er4','er5'); D.edge('er5','er6','是'); D.edge('er5','er4','否'); D.edge('er6','ee')
D.node('en','副露插入不计作回合，不恢复AP，不触发抽卡。',940,1160,410,70,'note')

# Page 6: exhaustive draw and cross-round
D = Diagram(mxfile, '06 荒牌、跨局与淘汰', 'roundend', 1800, 2600)
D.phase('gp1','A. 荒牌确认',40,40,520,1000,'phase1')
D.phase('gp2','B. 对局终结判定',620,40,520,1000,'phase2')
D.phase('gp3','C. 资源延续',1200,40,540,1000,'phase3')
D.phase('gp4','D. 下一局麻将牌处理',360,1120,1080,1200,'phase4')
D.node('gs','牌墙已耗尽',190,90,220,54,'start')
D.node('g1','完成末次自摸判定？',180,200,210,90,'decision')
D.node('g2','完成必要切牌？',180,350,210,90,'decision')
D.node('g3','完成末次响应窗口？',180,500,210,90,'decision')
D.node('g4','完成反弹效果？',180,650,210,90,'decision')
D.node('g5','完成后续效果？',180,800,210,90,'decision')
D.node('g6','确认荒牌',190,940)
D.edge('gs','g1'); D.edge('g1','g2','是'); D.edge('g2','g3','是'); D.edge('g3','g4','是'); D.edge('g4','g5','是'); D.edge('g5','g6','是')
for src in ['g1','g2','g3','g4','g5']:
    D.edge(src,src,'否，等待', dashed=True)
D.node('h1','统计存活玩家',785,130)
D.node('h2','存活玩家仅1人？',775,260,210,90,'decision')
D.node('h3','公开终局结算明细',785,420)
D.node('h4','宣布最终胜利者',785,520)
D.node('he','对局结束',795,630,170,54,'end')
D.node('h5','结束当前局',785,780)
D.edge('g6','h1'); D.edge('h1','h2'); D.edge('h2','h3','是'); chain(D,['h3','h4','he']); D.edge('h2','h5','否')
D.node('k1','保留存活玩家HP',1375,130)
D.node('k2','保留存活玩家AP',1375,230)
D.node('k3','保留私有技能卡池状态',1360,330,220,60)
D.node('k4','保留备用区技能卡',1375,440)
D.node('k5','保留冷却进度',1375,540)
D.node('k6','保持淘汰玩家离场',1375,640)
D.edge('h5','k1'); chain(D,['k1','k2','k3','k4','k5','k6'])
D.node('n1','每位存活玩家选择保留手牌',530,1190,240,60)
D.node('n2','收集其余麻将牌',555,1300)
D.node('n3','洗匀已收集麻将牌',555,1400)
D.node('n4','存活玩家数为4？',545,1510,210,90,'decision')
D.node('n5','向每位玩家重发13张牌',430,1660,230,60)
D.node('n6','按存活座次选择玩家',720,1660,220,60)
D.node('n7','该玩家已有13张牌？',725,1770,210,90,'decision')
D.node('n8','向该玩家发1张牌',735,1920)
D.node('n9','所有玩家均为13张？',715,2030,230,90,'decision')
D.node('n10','选择上一局起家的下家',1070,1660,230,60)
D.node('n11','候选席位已淘汰？',1080,1770,210,90,'decision')
D.node('n12','沿逆时针选择下一席位',1070,1920,230,60)
D.node('n13','设置新局起家',1090,2050)
D.node('n14','从新起家开始行动',1090,2150)
D.node('ne','进入新局',1100,2250,170,54,'end')
D.edge('k6','n1'); chain(D,['n1','n2','n3','n4']); D.edge('n4','n5','是'); D.edge('n4','n6','否'); D.edge('n6','n7'); D.edge('n7','n8','否'); D.edge('n8','n9'); D.edge('n7','n9','是'); D.edge('n9','n6','否'); D.edge('n5','n10'); D.edge('n9','n10','是'); D.edge('n10','n11'); D.edge('n11','n12','是'); D.edge('n12','n11'); D.edge('n11','n13','否'); chain(D,['n13','n14','ne'])
D.node('kn','新局起家首次开始阶段照常恢复1点AP。',425,2180,450,70,'note')

ElementTree(mxfile).write(OUT, encoding='utf-8', xml_declaration=True)
print(OUT)
