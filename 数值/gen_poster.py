# -*- coding: utf-8 -*-
import os, xml.etree.ElementTree as ET

W, H = 1080, 1920
CJK = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC',sans-serif"
parts = []
def add(s): parts.append(s)

def rr(x,y,w,h,r,fill,stroke=None,sw=1):
    s='<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" ry="%.1f" fill="%s"'%(x,y,w,h,r,r,fill)
    if stroke: s+=' stroke="%s" stroke-width="%d"'%(stroke,sw)
    return s+'/>'

def text(x,y,s,size,fill,anchor='middle',weight='normal'):
    return '<text x="%.1f" y="%.1f" font-size="%d" fill="%s" text-anchor="%s" font-weight="%s" font-family="%s">%s</text>'%(
        x,y,size,fill,anchor,weight,CJK,s)

# ---------- tile engine ----------
TW, TH, GIN, GOUT = 50, 70, 5, 12

def dotcells(ix,iy,iw,ih):
    cells=[]
    for r in range(3):
        for c in range(3):
            cx=ix+(c+0.5)*(iw/3.0)
            cy=iy+(r+0.5)*(ih/3.0)
            cells.append((cx,cy))
    return cells

dot_layouts={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],
             6:[0,1,2,6,7,8],7:[0,1,2,4,6,7,8],8:[0,1,2,3,5,6,7,8],9:[0,1,2,3,4,5,6,7,8]}
CN_NUM=['','一','二','三','四','五','六','七','八','九']

def tile(t,x,y):
    out=[]
    out.append(rr(x,y+3,TW,TH,8,'#E4D9C0'))
    out.append(rr(x,y,TW,TH,8,'#FBF7EC',stroke='#CDC1A4',sw=1.5))
    kind=t[0]; v=t[1]
    ix=x+6; iy=y+6; iw=TW-12; ih=TH-12
    if kind=='m':
        out.append(text(x+TW/2,y+29,CN_NUM[v],17,'#C0392B',weight='bold'))
        out.append(text(x+TW/2,y+58,'萬',19,'#2C2C2C',weight='bold'))
    elif kind=='p':
        for i in dot_layouts[v]:
            cx,cy=dotcells(ix,iy,iw,ih)[i]
            out.append('<circle cx="%.1f" cy="%.1f" r="5.6" fill="#2E6DA4"/>'% (cx,cy))
            out.append('<circle cx="%.1f" cy="%.1f" r="2.2" fill="#FBF7EC"/>'% (cx,cy))
    elif kind=='s':
        for i in dot_layouts[v]:
            cx,cy=dotcells(ix,iy,iw,ih)[i]
            out.append(rr(cx-3,cy-10,6,20,3,'#2E8B57'))
    else:
        if v=='7':
            out.append(rr(ix+3,iy+3,iw-6,ih-6,4,'none',stroke='#2E6DA4',sw=3))
        else:
            ch={'1':'東','2':'南','3':'西','4':'北','5':'中','6':'發'}[v]
            col={'1':'#1F3A5F','2':'#1F3A5F','3':'#1F3A5F','4':'#1F3A5F','5':'#C0392B','6':'#2E8B57'}[v]
            out.append(text(x+TW/2,y+48,ch,26,col,weight='bold'))
    return ''.join(out)

def parse(s):
    out=[]; i=0
    while i<len(s):
        k=s[i]; i+=1
        if k=='z':
            out.append(('z',s[i])); i+=1
        else:
            out.append((k,int(s[i]))); i+=1
    return out

def hand_width(groups):
    total=0
    for gi,g in enumerate(groups):
        n=len(parse(g))
        total+=n*TW+(n-1)*GIN
        if gi<len(groups)-1: total+=GOUT
    return total

def draw_hand(name,dmg,groups,y,accent):
    tg=[parse(g) for g in groups]
    w=hand_width(groups)
    x0=(W-w)/2
    ph=TH+42
    add(rr(40,y-10,W-80,ph,14,'#FFFFFF',stroke='#ECE3D0',sw=1.5))
    add(rr(40,y-10,8,ph,4,accent))
    cx=x0
    for gi,g in enumerate(tg):
        for t in g:
            add(tile(t,cx,y)); cx+=TW+GIN
        if gi<len(tg)-1: cx+=GOUT-GIN
    add(text(60,y+TH+16,name,16,accent,anchor='start',weight='bold'))
    add(text(60,y+TH+34,dmg,12.5,'#7A7163',anchor='start'))

# ---------- background ----------
add(rr(0,0,W,H,0,'#F3EEE3'))
add(rr(0,0,W,6,0,'#23211C'))

# ---------- header ----------
add(text(W/2,66,'《开战！麻神立攻学院》',27,'#23211C',weight='bold'))
add(text(W/2,104,'番种 × 伤害 一览图',34,'#23211C',weight='bold'))
add(text(W/2,138,'英雄技能 × 竞技麻将 · 1v1v1v1 血量攻防回合制',16,'#6B6256'))
# formula chip
fx,fy,fw,fh=120,158,840,66
add(rr(fx,fy,fw,fh,12,'#23211C'))
add(text(W/2,fy+28,'伤害  =  6 ×（1 + 总番数）',23,'#FFFFFF',weight='bold'))
add(text(W/2,fy+52,'役满 78 点 ｜ 双倍役满 156 点 ｜ 累计役満（≥13番）封顶 78',13.5,'#D8CFBC'))

# ---------- ladder ----------
add(text(48,254,'伤害阶梯（番种 → 伤害）',22,'#23211C',anchor='start',weight='bold'))
ladder=[
 ('6点','基础 0番','#9AA0A6','无役也可和牌，保底 6 点'),
 ('12点','1番','#4C9A2A','门前清自摸·平和·断幺·役牌·岭上开花·枪杠·海底摸月·河底捞鱼'),
 ('18点','2番','#2E86C1','七对子·对对和·三色同顺·三色同刻·一气通贯·全带幺·混老头·小三元·三暗刻·三杠子'),
 ('24点','3番','#8E44AD','混一色·二杯口'),
 ('30点','彩蛋','#D68910','流局满贯：荒牌流局触发，对每名存活对手各 30 点'),
 ('42点','6番','#C0392B','清一色'),
 ('78点','役满','#B8860B','天和·地和·国士无双·大三元·小四喜·字一色·四暗刻·清老头·绿一色·四杠子·九莲宝灯'),
 ('156点','双倍役满','#6C3483','大四喜·国士无双十三面待·纯正九莲宝灯·四暗刻单骑'),
]
ry=280
for dmg,tier,color,names in ladder:
    add(rr(48,ry,108,40,10,color))
    add(text(102,ry+27,dmg,18,'#FFFFFF',weight='bold'))
    add('<text x="176" y="%d" font-size="14" font-family="%s"><tspan font-weight="bold" fill="%s">%s　</tspan><tspan fill="#4A443A">%s</tspan></text>'%(ry+27,CJK,color,tier,names))
    ry+=48

# ---------- settlement notes ----------
add(rr(48,674,W-96,96,12,'#FBF7EC',stroke='#E3D9C4',sw=1.5))
add(text(66,700,'结算要点',16,'#23211C',anchor='start',weight='bold'))
notes=[
 '· 自摸：对全场每名存活对手各结算 1 份，总输出为单体 1.5 倍（每家 1.5×D_base÷n）',
 '· 荣和：D_base 全额只结算给点炮者（单体）',
 '· 役满叠加：n 个役满 D = 78×n，线性递增、不封顶（n=6 达 468）',
 '· 最终伤害 =（ D_base + B ）× A × R − S，各目标独立结算，下限 0',
]
ny=722
for n in notes:
    add(text(66,ny,n,12.5,'#4A443A',anchor='start'))
    ny+=18

# ---------- reference hands ----------
add(text(48,792,'参考和牌牌型（标准 SVG 麻将牌面）',22,'#23211C',anchor='start',weight='bold'))
hands=[
 ('平和（4顺+雀头）','1番 · 12点',['m2m3m4','m5m6m7','p2p3p4','p5p6p7','p8p8'],'#4C9A2A'),
 ('断幺（全 2~8 数牌）','1番 · 12点',['m2m3m4','m4m5m6','p2p3p4','s5s6s7','s5s5'],'#4C9A2A'),
 ('清一色（单花色）','6番 · 42点',['m1m2m3','m4m5m6','m7m8m9','m1m1m1','m2m2'],'#C0392B'),
 ('大三元（中发白刻）','役满 · 78点',['z5z5z5','z6z6z6','z7z7z7','m2m3m4','m8m8'],'#B8860B'),
 ('国士无双（13幺+雀头）','役满 · 78点',['z1z2z3z4z5z6z7m1m9p1p9s1s9','m1'],'#B8860B'),
 ('九莲宝灯（纯正九莲）','役满 · 78点',['m1m1m1m2m3m4m5m6m7m8m9m9m9','m1'],'#B8860B'),
 ('七对子（7 对子）','2番 · 18点',['m1m1','m2m2','p3p3','p4p4','s5s5','s6s6','s7s7'],'#2E86C1'),
 ('字一色（全字牌）','役满 · 78点',['z5z5z5','z6z6z6','z7z7z7','z1z1z1','z2z2'],'#B8860B'),
]
hy=812
for name,dmg,groups,accent in hands:
    draw_hand(name,dmg,groups,hy,accent)
    hy+=112

add(text(W/2,1892,'注：番数复合时先相加再代入公式；多个番种不可直接把各自点数相加。役满压倒普通番，只按役满个数结算。',
        11.5,'#8A8273'))

svg = '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">%s</svg>'%(W,H,W,H,''.join(parts))
outp='/Users/hurryfan/CodeBuddy/原型：英雄麻将/数值/番种伤害一览.svg'
with open(outp,'w',encoding='utf-8') as f: f.write(svg)
# validate
ET.fromstring(svg)
print('OK', len(svg), 'bytes ->', outp)
