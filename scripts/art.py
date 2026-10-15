"""One-time original pixel artwork authoring; uses draw/draw-sheet to rasterize."""
import json, random, subprocess, pathlib, math
root=pathlib.Path('assets'); random.seed(43)
def sprite(path,w,h,fn,sheet=False):
    ops=[]
    def rect(x,y,a,b,c): ops.append(dict(op='fill_rect',x=int(x),y=int(y),width=max(1,int(a)),height=max(1,int(b)),color=c))
    def line(x1,y1,x2,y2,c): ops.append(dict(op='line',x0=int(x1),y0=int(y1),x1=int(x2),y1=int(y2),color=c))
    def poly(points,c):
        for y in range(int(min(p[1] for p in points)),int(max(p[1] for p in points))+1):
            xs=[]
            for i,p in enumerate(points):
                q=points[(i+1)%len(points)]
                if min(p[1],q[1])<=y<max(p[1],q[1]): xs.append(p[0]+(y-p[1])*(q[0]-p[0])/(q[1]-p[1]))
            xs.sort()
            for i in range(0,len(xs)-1,2): rect(xs[i],y,xs[i+1]-xs[i]+1,1,c)
    fn(rect,line,poly)
    out=root/path; out.parent.mkdir(parents=True,exist_ok=True)
    log=pathlib.Path('/tmp/art/ops.json');log.write_text(json.dumps(ops))
    subprocess.run(['draw-sheet' if sheet else 'draw','render','--actions',str(log),'--out',str(out),'--width',str(w),'--height',str(h),'--no-layers'],check=True,stdout=subprocess.DEVNULL)
pal=[['#66503d','#715a43','#80634a','#594735','#977452'],['#424d57','#4a5660','#56626c','#37444d','#67727b'],['#30363f','#383f49','#424957','#262e38','#525663'],['#4d3037','#5a333b','#673b40','#3d2832','#87504b']]
for bi,band in enumerate(['topsoil','rockbed','deepstone','coreshell']):
 for v in range(3):
  def rock(r,l,p):
   r(0,0,80,80,pal[bi][0])
   for _ in range(1400):
    x=random.randrange(80);y=random.randrange(80);r(x,y,random.choice([1,1,2,3]),1,random.choice(pal[bi]))
   for _ in range(9):
    x=random.randrange(80);y=random.randrange(80);l(x,y,x+random.randrange(5,17),y-2,pal[bi][3])
  sprite(f'tiles/{band}-{v}.png',80,80,rock)
def metal(r,l,p):
 r(0,0,80,80,'#202b35')
 for x in range(0,80,20):
  p([(x,0),(x+18,0),(x+10,80),(x-8,80)],'#283844')
  l(x,0,x-8,80,'#101d29')
 for x in [6,70]:
  for y in [6,70]:r(x,y,3,3,'#617079')
sprite('tiles/bedrock.png',80,80,metal)
for n in range(2):
 def stone(r,l,p):
  p([(3,25),(20,6),(62,9),(78,36),(66,72),(22,77),(5,58)],'#141e2b')
  p([(9,26),(25,12),(59,15),(70,35),(60,65),(24,69),(12,53)],'#647785')
  p([(9,26),(25,12),(59,15),(42,30),(13,43)],'#92a0a8')
  p([(42,30),(70,35),(60,65),(24,69)],'#415563')
  l(21+n*4,39,59,28,'#bbcad0')
 sprite(f'tiles/stone-{n}.png',80,80,stone)
sprite('tiles/tunnel.png',80,80,lambda r,l,p: (r(0,0,80,80,'#111c25'),*[r(random.randrange(80),random.randrange(80),1,1,random.choice(['#16232c','#1a2830'])) for _ in range(200)]))
colors=['#b6aba0','#c9b17f','#ed9466','#d1e5df','#6cb3e0','#bcb1f8','#b5de9b','#ef9057','#edb34b','#d5f5f5','#65e5ad','#ed8ab3','#ffd989']
for i,name in enumerate(['ferron','marlite','cuprite','argenite','cobaltine','voltite','halcite','pyronium','cindrite','adamite','verdite','roselite','aurite']):
 def ore(r,l,p):
  c=colors[i]
  if i<10:
   for x in range(80):
    y=38+int(12*math.sin(x/22))
    for _ in range(5):
     yy=y+random.randrange(-10,11);r(x,yy,random.randrange(1,5),random.randrange(1,4),c+random.choice(['66','99','bb','ff']))
    if x%11==0:l(x,y-6,x+8,y-9,'#ffffff99')
   for _ in range(100):
    x=random.randrange(80); y=38+int(12*math.sin(x/22))+random.randrange(-19,20);r(x,y,1,1,c+'55')
  else:
   p([(21,23),(55,18),(69,37),(41,66),(13,39)],'#0b2833')
   p([(23,24),(53,21),(65,37),(40,61),(17,39)],c)
   p([(23,24),(53,21),(48,36),(29,38)],'#f0ffff')
   p([(17,39),(29,38),(40,61)],c+'aa')
   p([(48,36),(65,37),(40,61)],'#456777')
   l(56,14,56,27,'#ffffff');l(50,20,62,20,'#ffffff')
 sprite(f'ore/{name}.png',80,80,ore)
for name,c in [('resonite','#67f5c4'),('cryenite','#9db6ff'),('core','#ff925d'),('core-sample','#ffcf87')]:
 def crystal(r,l,p):
  for x,y,s in [(14,37,26),(30,14,43),(48,30,30)]:
   p([(x,y+10),(x+s/3,y),(x+2*s/3,y+7),(x+s/2,y+s),(x+5,y+s+4)],'#203e4b')
   p([(x+3,y+11),(x+s/3,y+3),(x+s/3,y+s),(x+6,y+s)],c)
   p([(x+s/3,y+3),(x+2*s/3-2,y+8),(x+s/2,y+s),(x+s/3,y+s)],'#e7ffff')
  for _ in range(20):r(random.randrange(8,72),random.randrange(8,72),1,1,c)
 sprite(f'materials/{name}.png',80,80,crystal)
for f in range(4):
 def crack(r,l,p):
  for a in range(3+f*2):
   ang=a*2.4; x=40+math.cos(ang)*(13+f*7);y=40+math.sin(ang)*(13+f*7)
   l(40,40,x,y,'#10131c');l(x,y,x+8*math.cos(ang+.9),y+12*math.sin(ang+.9),'#10131c')
 sprite(f'tiles/crack/frame{f:02}.png',80,80,crack,True)
for f in range(3):
 def lava(r,l,p):
  r(0,0,80,80,'#a94237')
  for y in range(0,80,3):
   for x in range(0,80,2):
    n=math.sin(x/10+y/13+f*2)+math.sin(y/7-x/18+f)
    r(x,y,3,3,'#ffcc75' if n>1 else '#ee8551' if n>0 else '#cf5940' if n>-.8 else '#77333a')
 sprite(f'hazards/lava/frame{f:02}.png',80,80,lava,True)
states={'idle':4,'walk':6,'drill-down':4,'drill-side':4,'jetpack':4,'fall':3,'hurt':3,'fuel-out':3}
for state,frames in states.items():
 for f in range(frames):
  def miner(r,l,p):
   bob=[0,-1,0,1][f%4]; dx=(f%2)*2 if state.startswith('drill') else 0
   if state=='hurt':dx=-f*3
   y=12+bob+(5 if state=='fuel-out' else 0); x=dx
   # backpack, legs, armored boots
   r(14+x,y+22,13,27,'#101f2d');r(16+x,y+23,9,20,'#758b93');r(16+x,y+28,4,11,'#e8aa61')
   leg=[-4,0,5,3,-1,-5][f%6] if state=='walk' else 0
   for xx,off in [(27,leg),(43,-leg)]:
    r(xx+x,y+43,11,18+off,'#253747');r(xx+x,y+45,5,10,'#5b7580')
    r(xx-2+x,y+57+off,16,7,'#101e2a');r(xx-1+x,y+57+off,13,2,'#a0acaa')
   p([(25+x,y+26),(49+x,y+24),(56+x,y+43),(47+x,y+51),(26+x,y+49)],'#142633')
   r(27+x,y+28,22,18,'#ca8250');r(29+x,y+29,8,15,'#f1ba70');r(29+x,y+46,20,4,'#657a82')
   r(22+x,y+4,33,24,'#152735');r(20+x,y+9,38,13,'#efbc70')
   r(26+x,y+1,24,5,'#f6ce87');r(27+x,y+7,28,16,'#355766')
   r(31+x,y+8,24,12,'#75c7cf');r(35+x,y+10,20,7,'#a5e7df');r(51+x,y+10,4,10,'#234653')
   r(51+x,y+2,9,7,['#fff0bc','#ffdc89','#ffedb4','#ffe9aa'][f%4]);r(49+x,y+3,3,5,'#f3a44e')
   if state=='drill-down':
    r(42+x,y+37,12,11,'#f1ba70');r(45+x,y+46,11,12,'#8cabb2')
    p([(43+x,y+57),(58+x,y+57),(51+x,y+70)],'#dde2d3')
    for z in range(3):l(45+x,y+58+z*3,56+x,y+60+z*3,'#455c6a')
   else:
    r(42+x,y+31,17,10,'#edb473');r(51+x,y+36,11,9,'#182d3b')
    r(56+x,y+35,13,12,'#7d9ca8')
    p([(68+x,y+34),(79+x,y+41),(68+x,y+48)],'#c5d4d1')
    for z in range(3):l(68+x+z*3,y+36+z,68+x+z*3,y+46-z,'#486474')
   if state=='jetpack':
    p([(15,y+46),(25,y+46),(21,y+66+(f%3)*4),(13,y+55)],'#f8a657')
    p([(17,y+46),(23,y+46),(20,y+61)],'#fff0b0')
   if state=='fall':r(24,y+53,4,9,'#e6b36b')
  sprite(f'miner/{state}/frame{f:02}.png',80,80,miner,True)
# Industrial structures with different silhouettes, pipes, hazard stripes, illuminated windows.
for i,name in enumerate(['fuel-depot','ore-market','save-pad','upgrade-shop','supply-depot','launch-pad','cave-mouth','ground','sky']):
 def building(r,l,p):
  if name=='sky':
   r(0,0,480,240,'#132631')
   for y in range(240):r(0,y,480,1,'#%02x%02x%02x'%(18+int(y/40),36+int(y/24),46+int(y/24)))
   for _ in range(100):r(random.randrange(480),random.randrange(200),1,1,'#567079')
   p([(0,210),(53,180),(88,204),(169,145),(220,194),(302,170),(360,200),(433,151),(480,183),(480,240),(0,240)],'#203842')
   return
  if name=='ground':
   r(0,0,240,30,'#263c45');r(0,0,240,5,'#81908b')
   for x in range(0,240,18):r(x,7,12,3,'#526660')
   return
  if name=='cave-mouth':
   p([(4,150),(14,80),(42,55),(92,58),(123,96),(134,150)],'#475454')
   p([(25,150),(32,96),(56,75),(86,78),(109,102),(115,150)],'#0a1822')
   r(18,67,100,8,'#c9985e')
   for x in [22,110]:r(x,73,5,77,'#71817b')
   return
  r(8,143,204,7,'#0b1923');r(14,135,192,9,'#7e8b85')
  if i==0:
   for x in [25,132]:
    p([(x,134),(x,34),(x+11,23),(x+39,23),(x+50,34),(x+50,134)],'#3a5360')
    r(x+6,40,38,76,'#a1ada6');r(x+10,42,7,67,'#cfcec0');r(x+4,73,42,13,'#d19a5d')
   r(78,88,48,47,'#243b49');r(84,95,33,17,'#75c7c1');r(91,114,10,19,'#101e29')
   l(122,92,143,121,'#e6b56b')
  elif i==2:
   r(40,118,140,17,'#486273');r(63,110,95,8,'#8dd9cb')
   r(95,34,30,78,'#1a303e');r(88,30,44,33,'#7c9c9e');r(94,36,32,20,'#baf6d6')
   for y in range(73,106,8):r(101,y,18,3,'#79b6ab')
  elif i==5:
   r(15,125,190,10,'#566b73')
   for x in [22,186]:r(x,22,8,102,'#778a89')
   for y in range(28,120,21):l(22,y,190,y+10,'#405966')
   r(18,19,182,7,'#b9a889')
  else:
   p([(18,135),(18,67),(40,39),(174,39),(199,67),(199,135)],'#2b4351')
   p([(18,67),(40,39),(174,39),(199,67)],'#7d8c89')
   r(30,72,156,54,'#4c626a');r(41,78,63,29,'#102b39')
   for x in range(45,100,15):r(x,82,11,20,['#dda663','#8ec9bc','#839fa9'][i%3])
   r(130,79,36,55,'#152a37');r(134,83,28,44,'#617c81');r(137,88,22,5,'#b6d9cd')
   r(40,17,7,24,'#4f6870');r(34,13,19,5,'#a8b2a4')
   if i==3:
    for y in range(20,54,10):r(157,y,18,6,'#8caca5')
  for x in range(19,199,20):p([(x,135),(x+8,135),(x+15,143),(x+7,143)],'#d9ab64')
  for x in [24,190]:
   for y in [72,124]:r(x,y,3,3,'#a8b8af')
 sprite(f'surface/{name}.png',480 if name=='sky' else 240 if name=='ground' else 220,240 if name=='sky' else 30 if name=='ground' else 150,building)
for stage in range(6):
 def rocket(r,l,p):
  r(6,223,148,12,'#748383');r(17,212,124,10,'#354d5b')
  if stage==0:return
  p([(51,208),(51,75),(80,30),(109,75),(109,208)],'#394f5e')
  r(57,80,45,120,'#b8bdb0');r(60,80,10,120,'#e3dcc0')
  p([(52,77),(80,30),(108,77)],'#db9660')
  if stage>=2:
   for y in [115,151,190]:r(51,y,58,8,'#b77d51')
   for x in [37,109]:r(x,126,14,80,'#71868b');r(x+3,128,5,68,'#b7c4b8')
  if stage>=3:r(65,83,30,24,'#1b3c50');r(70,87,20,15,'#9ae0d7')
  if stage>=4:
   p([(51,167),(27,215),(51,204)],'#cf9463');p([(109,167),(133,215),(109,204)],'#cf9463')
   r(64,199,31,14,'#142b3b');r(59,211,42,5,'#829ca1')
  if stage>=5:r(74,17,12,21,'#d2ddd1');r(75,10,10,9,'#9ce9d6')
  for y in range(90,195,17):r(98,y,2,2,'#697e82')
 sprite(f'rocket/stage{stage}.png',160,240,rocket)
for i,name in enumerate(['fuel','hull','cargo','credits','depth','resonite','cryenite','core-sample']):
 def icon(r,l,p):
  c=['#e8b674','#e58d76','#acb9ae','#e8c67b','#9dc8ca','#79dfbd','#aabcf8','#ffc685'][i]
  if i==0:p([(8,2),(16,2),(16,6),(20,9),(20,21),(4,21),(4,9),(8,6)],c);r(8,10,8,7,'#243644')
  elif i==1:p([(4,3),(20,3),(19,15),(12,23),(5,15)],c);p([(8,7),(16,7),(16,14),(12,18),(8,14)],'#243644')
  elif i==2:r(3,7,18,15,c);r(7,3,10,4,c);r(6,10,12,2,'#263946')
  elif i==3:p([(8,2),(17,2),(23,10),(19,20),(6,22),(1,13)],c);r(10,6,4,12,'#243644')
  elif i==4:l(12,2,12,21,c);l(5,14,12,21,c);l(19,14,12,21,c)
  else:p([(3,12),(10,2),(17,5),(22,14),(12,23)],c);p([(10,2),(13,12),(3,12)],'#e4ffef')
 sprite(f'icons/{name}.png',24,24,icon)
print('Artwork complete')
