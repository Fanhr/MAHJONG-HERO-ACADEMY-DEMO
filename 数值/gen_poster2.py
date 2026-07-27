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

# ---------- tile engine (size parametric) ----------
CN_NUM=['','一','二','三','四','五','六','七','八','九']
dot_layouts={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],
             6:[0,1,2,6,7,8],7:[0,1,2,4,6,7,8],8:[0,1,2,3,5,6,7,8],9:[0,1,2,3,4,5,6,7,8]}
def dotcells(ix,iy,iw,ih):
    cells=[]
    for r in range(3):
        for c in range(3):
            cells.append((ix+(c+0.5)*(iw/3.0), iy+(r+0.5)*(ih/3.0)))
    return cells

def tile(t,x,y,tw,th):
    out=[rr(x,y+max(1,tw*0.06),tw,th,max(2,tw*0.16),'#E4D9C0'),
         rr(x,y,tw,th,max(2,tw*0.16),'#FBF7EC',stroke='#CDC1A4',sw=1)]
    kind=t[0]; v=t[1]
    ix=x+tw*0.12; iy=y+th*0.1; iw=tw*0.76; ih=th*0.8
    if kind=='m':
        out.append(text(x+tw/2,y+th*0.45,CN_NUM[v],int(th*0.30),'#C0392B',weight='bold'))
        out.append(text(x+tw/2,y+th*0.80,'萬',int(th*0.30),'#2C2C2C',weight='bold'))
    elif kind=='p':
        for i in dot_layouts[v]:
            cx,cy=dotcells(ix,iy,iw,ih)[i]
            out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#2E6DA4"/>'%(cx,cy,tw*0.12))
            out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#FBF7EC"/>'%(cx,cy,tw*0.05))
    elif kind=='s':
        for i in dot_layouts[v]:
            cx,cy=dotcells(ix,iy,iw,ih)[i]
            out.append(rr(cx-tw*0.07,cy-th*0.18,tw*0.14,th*0.34,1,'#2E8B57'))
    else:
        if v=='7':
            out.append(rr(ix+tw*0.06,iy+th*0.06,iw*0.88,ih*0.88,2,'none',stroke='#2E6DA4',sw=1.5))
        else:
            ch={'1':'東','2':'南','3':'西','4':'北','5':'中','6':'發'}[v]
            col={'1':'#1F3A5F','2':'#1F3A5F','3':'#1F3A5F','4':'#1F3A5F','5':'#C0392B','6':'#2E8B57'}[v]
            out.append(text(x+tw/2,y+th*0.66,ch,int(th*0.46),col,weight='bold'))
    return ''.join(out)

def parse(s):
    out=[]; i=0
    while i<len(s):
        k=s[i]; i+=1
        if k=='z': out.append(('z',s[i])); i+=1
        else: out.append((k,int(s[i]))); i+=1
    return out

def hand_w(groups,tw,gin,gout):
    tot=0
    for gi,g in enumerate(groups):
        n=len(parse(g)); tot+=n*tw+(n-1)*gin
        if gi<len(groups)-1: tot+=gout
    return tot

def draw_mini(groups,x,y,tw,th,gin,gout):
    w=hand_w(groups,tw,gin,gout); cx=x+( (W-2*x) - w)/2 if False else x
    # center within provided x..x+areaW handled by caller; here center around cx0
    return w

# ---------- background ----------
add(rr(0,0,W,H,0,'#F5F1E8'))
add(rr(0,0,W,6,0,'#23211C'))

# ---------- header ----------
add(text(W/2,60,'《开战！麻神立攻学院》 番种 × 伤害 一览',30,'#23211C',weight='bold'))
add(text(W/2,92,'英雄技能 × 竞技麻将 · 1v1v1v1 血量攻防 · 每种番附示意牌型',15,'#6B6256'))
# formula chip
fx,fy,fw,fh=160,110,760,46
add(rr(fx,fy,fw,fh,10,'#23211C'))
add(text(W/2,fy+30,'伤害 = 6 ×（1 + 总番数）   ｜   役满 78 ／ 双倍役满 156 ／ 累计役満（≥13番）封顶 78',14.5,'#FFFFFF',weight='bold'))

# ---------- legend (horizontal chips) ----------
chips=[('基础 6','#9AA0A6'),('1番 12','#4C9A2A'),('2番 18','#2E86C1'),('3番 24','#8E44AD'),
       ('彩蛋 30','#D68910'),('6番 42','#C0392B'),('役满 78','#B8860B'),('双倍役满 156','#6C3483')]
add(text(30,186,'伤害阶梯：',16,'#23211C',anchor='start',weight='bold'))
lx=150; ly=170; chh=30
for label,color in chips:
    cw=len(label)*9+22
    if lx+cw>W-20:
        lx=30; ly+=chh+8
    add(rr(lx,ly,cw,chh,8,color))
    add(text(lx+cw/2,ly+chh*0.68,label,14,'#FFFFFF',weight='bold'))
    lx+=cw+10

# ---------- fan cards grid ----------
TW,TH,GIN,GOUT=18,27,2,6
cardW=330; cardH=110; gapX=14; gapY=15; margin=30; ncols=3
startY=ly+chh+24

fans=[
 ('门前清自摸','1番·12','#4C9A2A',['m2m3m4','m4m5m6','p2p3p4','s5s6s7','s5s5']),
 ('平和','1番·12','#4C9A2A',['m2m3m4','m5m6m7','p2p3p4','p5p6p7','p8p8']),
 ('断幺','1番·12','#4C9A2A',['m2m3m4','m4m5m6','p2p3p4','s5s6s7','s5s5']),
 ('役牌','1番·12','#4C9A2A',['z5z5z5','m2m3m4','m5m6m7','p2p3p4','p8p8']),
 ('岭上开花','1番·12','#4C9A2A',['z5z5z5z5','m2m3m4','m5m6m7','p2p3p4','p8p8']),
 ('枪杠','1番·12','#4C9A2A',['z6z6z6','m2m3m4','m5m6m7','p2p3p4','p8p8']),
 ('海底摸月','1番·12','#4C9A2A',['m2m3m4','m5m6m7','p2p3p4','s5s6s7','s8s8']),
 ('河底捞鱼','1番·12','#4C9A2A',['m2m3m4','m5m6m7','p2p3p4','s5s6s7','s8s8']),
 ('七对子','2番·18','#2E86C1',['m1m1','m2m2','p3p3','p4p4','s5s5','s6s6','s7s7']),
 ('对对和','2番·18','#2E86C1',['z5z5z5','z6z6z6','m2m2m2','m5m5m5','m8m8']),
 ('三色同顺','2番·18','#2E86C1',['m2m3m4','p2p3p4','s2s3s4','m5m6m7','m8m8']),
 ('三色同刻','2番·18','#2E86C1',['m3m3m3','p3p3p3','s3s3s3','z5z5z5','m8m8']),
 ('一气通贯','2番·18','#2E86C1',['m1m2m3','m4m5m6','m7m8m9','z5z5z5','m8m8']),
 ('全带幺','2番·18','#2E86C1',['m1m2m3','m7m8m9','p1p1p1','s9s9s9','z1z1']),
 ('混老头','2番·18','#2E86C1',['m1m1m1','p9p9p9','z1z1z1','z2z2z2','z5z5']),
 ('小三元','2番·18','#2E86C1',['z5z5z5','z6z6z6','z7z7','m2m3m4','m5m6m7']),
 ('三暗刻','2番·18','#2E86C1',['z5z5z5','z6z6z6','s9s9s9','m2m3m4','m8m8']),
 ('三杠子','2番·18','#2E86C1',['z5z5z5z5','z6z6z6z6','s9s9s9s9','m8m8']),
 ('混一色','3番·24','#8E44AD',['m1m2m3','m4m5m6','m7m8m9','z5z5z5','m8m8']),
 ('二杯口','3番·24','#8E44AD',['m2m3m4','m2m3m4','m5m6m7','m5m6m7','m8m8']),
 ('清一色','6番·42','#C0392B',['m1m2m3','m4m5m6','m7m8m9','m1m1m1','m2m2']),
 ('国士无双','役满·78','#B8860B',['z1z2z3z4z5z6z7m1m9p1p9s1s9','m1']),
 ('大三元','役满·78','#B8860B',['z5z5z5','z6z6z6','z7z7z7','m2m3m4','m8m8']),
 ('小四喜','役满·78','#B8860B',['z1z1z1','z2z2z2','z3z3z3','z4z4','m2m3m4']),
 ('字一色','役满·78','#B8860B',['z5z5z5','z6z6z6','z7z7z7','z1z1z1','z2z2']),
 ('四暗刻','役满·78','#B8860B',['z5z5z5','z6z6z6','s9s9s9','s8s8s8','m5m5']),
 ('清老头','役满·78','#B8860B',['m1m1m1','m9m9m9','p1p1p1','p9p9p9','s1s1']),
 ('绿一色','役满·78','#B8860B',['s2s3s4','s6s6s6','s8s8s8','z6z6z6','s2s2']),
 ('四杠子','役满·78','#B8860B',['z5z5z5z5','z6z6z6z6','z7z7z7z7','z1z1z1z1']),
 ('九莲宝灯','役满·78','#B8860B',['m1m1m1m2m3m4m5m6m7m8m9m9m9','m1']),
 ('大四喜','双倍役满·156','#6C3483',['z1z1z1','z2z2z2','z3z3z3','z4z4z4','z5z5']),
 ('国士十三面','双倍役满·156','#6C3483',['z1z2z3z4z5z6z7m1m9p1p9s1s9']),
 ('纯正九莲','双倍役满·156','#6C3483',['m1m1m1m2m3m4m5m6m7m8m9m9m9']),
 ('四暗刻单骑','双倍役满·156','#6C3483',['z5z5z5','z6z6z6','s9s9s9','s8s8s8','m5']),
 ('天和','特殊','#9AA0A6',None,'庄家配牌 14 张直接宣告和牌（无特定牌型）'),
 ('地和','特殊','#9AA0A6',None,'闲家首巡首次摸牌即和（此前无人鸣牌）'),
 ('流局满贯','彩蛋','#D68910',None,'荒牌流局触发，非和牌；每名存活对手各 30 点'),
]

col=0; row=0
for item in fans:
    name,tag,color=item[0],item[1],item[2]
    groups=item[3]
    note=item[4] if len(item)>4 else None
    cx=margin+col*(cardW+gapX)
    cy=startY+row*(cardH+gapY)
    add(rr(cx,cy,cardW,cardH,10,'#FFFFFF',stroke='#ECE3D0',sw=1))
    add(rr(cx,cy,6,cardH,4,color))
    tagw=len(tag)*8+16
    add(rr(cx+12,cy+10,tagw,20,5,color))
    add(text(cx+12+tagw/2,cy+24,tag,12,'#FFFFFF',weight='bold'))
    add(text(cx+12+tagw+8,cy+25,name,16,'#23211C',anchor='start',weight='bold'))
    if groups:
        tg=[parse(g) for g in groups]
        w=hand_w(groups,TW,GIN,GOUT)
        tx=cx+(cardW-w)/2
        yy=cy+(cardH-TH)/2
        px=tx
        for gi,g in enumerate(tg):
            for t in g:
                add(tile(t,px,yy,TW,TH)); px+=TW+GIN
            if gi<len(tg)-1: px+=GOUT-GIN
    else:
        add(text(cx+cardW/2,cy+cardH/2+5,note,12.5,'#8A8273',weight='normal'))
    col+=1
    if col>=ncols:
        col=0; row+=1

add(text(W/2,H-22,'注：番数复合时先相加再代入公式；役满压倒普通番，只按役满个数线性结算、不封顶。',11.5,'#8A8273'))

svg='<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">%s</svg>'%(W,H,W,H,''.join(parts))
outp='/Users/hurryfan/CodeBuddy/原型：英雄麻将/数值/番种伤害一览.svg'
with open(outp,'w',encoding='utf-8') as f: f.write(svg)
ET.fromstring(svg)
print('OK',len(svg),'bytes; rows=',row+1,'lastCol=',col)
