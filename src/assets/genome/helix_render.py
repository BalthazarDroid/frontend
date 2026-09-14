"""
Particle-cloud DNA plate.

The close-up reference shows the backbone is not a chain of beads at all - it is a
dense cloud of fine specks, thousands of them, scattered around the helix path so
the strand reads as glittering dust with a bright core. That texture is the whole
character of the image, so this renderer draws particles, not geometry.

Design-time only; MA ships the PNG plus a JSON of hotspot coordinates.
"""
import json, math, numpy as np
from PIL import Image, ImageFilter

W,H,SS = 540,700,2
RW,RH = W*SS,H*SS
TURNS,RAD = 3.5,116.0*SS
TOP,BOT = 66*SS,(H-66)*SS
CX = RW/2
TILT = math.radians(9.0)
NRUNGS = 26
rng = np.random.default_rng(7)

acc = np.zeros((RH,RW),np.float32)          # luminance accumulator

def tilt(x,y):
    dx,dy = x-CX, y-(TOP+BOT)/2
    ca,sa = math.cos(TILT), math.sin(TILT)
    return CX+dx*ca-dy*sa, (TOP+BOT)/2+dx*sa+dy*ca

def helix(t):
    th=-0.45+2*math.pi*TURNS*t
    p=1/(1+0.18*abs(t-0.5)*2)
    y=TOP+t*(BOT-TOP)
    ax,ay=tilt(CX+RAD*math.cos(th)*p, y)
    bx,by=tilt(CX-RAD*math.cos(th)*p, y)
    return (ax,ay,RAD*math.sin(th)*p),(bx,by,-RAD*math.sin(th)*p)

def splat(xs,ys,zs,sizes,gains):
    """Additive-splat a batch of particles; depth only modulates brightness."""
    for x,y,z,s,g in zip(xs,ys,zs,sizes,gains):
        r=max(0.7,s)
        lo_x=max(0,int(x-r-1)); hi_x=min(RW,int(x+r+2))
        lo_y=max(0,int(y-r-1)); hi_y=min(RH,int(y+r+2))
        if hi_x<=lo_x or hi_y<=lo_y: continue
        yy,xx=np.mgrid[lo_y:hi_y, lo_x:hi_x]
        d2=(xx-x)**2+(yy-y)**2
        # gaussian speck - soft edges are what make the cloud read as dust
        v=np.exp(-d2/(2*(r*0.55)**2))*g
        acc[lo_y:hi_y, lo_x:hi_x]+=v

# ---- backbone: a dense cloud scattered around each strand's path -------------
# Bubbles, not dust. The count is low and the radii are large and widely varied, and -
# the part that actually matters - there are far fewer positions ALONG the path. A dense
# chain of big blobs merges back into a tube however few you put at each step.
PER_STEP, STEPS = 4, 190
JITTER = 1.9
for i in range(STEPS):
    t=i/STEPS
    for strand,(p) in enumerate(helix(t)):
        depth=(p[2]/RAD+1)/2                      # 0 far, 1 near
        # TWO populations. A tight bright core carries the strand's shape; a loose
        # dim haze around it is what makes the edge glitter instead of ending flat.
        nc=PER_STEP
        jx=rng.normal(0,JITTER*SS,nc); jy=rng.normal(0,JITTER*SS,nc)
        splat(p[0]+jx, p[1]+jy, [p[2]]*nc,
              rng.uniform(1.8,4.6,nc)*SS*(0.6+0.5*depth),
              rng.uniform(0.5,1.5,nc)*(0.45+0.95*depth))
        nh=int(PER_STEP*0.6)
        hx=rng.normal(0,4.6*SS,nh); hy=rng.normal(0,4.6*SS,nh)
        far=rng.random(nh)<0.12; hx[far]*=2.6; hy[far]*=2.6
        splat(p[0]+hx, p[1]+hy, [p[2]]*nh,
              rng.uniform(0.5,1.5,nh)*SS*(0.5+0.5*depth),
              rng.uniform(0.05,0.25,nh)*(0.3+0.8*depth))

# ---- base pairs: sparser, finer clouds ---------------------------------------
rungs=[]
for k in range(NRUNGS):
    t=(k+0.5)/NRUNGS
    a,b=helix(t)
    L=math.hypot(a[0]-b[0],a[1]-b[1])
    n=max(30,int(L*0.30))
    f=rng.random(n)
    px=a[0]+(b[0]-a[0])*f; py=a[1]+(b[1]-a[1])*f; pz=a[2]+(b[2]-a[2])*f
    px=px+rng.normal(0,1.35*SS,n); py=py+rng.normal(0,1.35*SS,n)
    depth=(pz/RAD+1)/2
    splat(px,py,pz,rng.uniform(1.8,4.6,n)*SS*(0.55+0.5*depth),
          rng.uniform(0.5,1.5,n)*(0.40+0.90*depth))
    rungs.append({"i":k,"t":t,"x1":a[0]/SS,"y1":a[1]/SS,"x2":b[0]/SS,"y2":b[1]/SS,
                  "len":L/SS,"face":abs(math.cos(-0.45+2*math.pi*TURNS*t))})

# ---- tone map + bloom --------------------------------------------------------
lum=np.clip(acc,0,None)
lum=1-np.exp(-lum*0.58)                      # soft rolloff keeps highlights from clipping
img8=(np.clip(lum,0,1)*255).astype(np.uint8)
base=Image.fromarray(img8,"L")
glow=base.filter(ImageFilter.GaussianBlur(7*SS/2))
merged=np.maximum(np.asarray(base,np.float32), np.asarray(glow,np.float32)*0.30)
merged=np.clip(merged,0,255).astype(np.uint8)
L=Image.fromarray(merged,"L").resize((W,H),Image.LANCZOS)
arr=np.asarray(L,np.float32)/255.0
# very slightly cool white, like the reference's silver dust
rgb=np.stack([arr*0.95, arr*0.97, arr*1.0],-1)
out=Image.fromarray((np.clip(rgb,0,1)*255).astype(np.uint8),"RGB")
out.putalpha(Image.fromarray((np.clip(arr*1.25,0,1)*255).astype(np.uint8),"L"))
out.save("helix.png")

# ---- callout bar texture -----------------------------------------------------
# The HUD's mix bar is the same material as a rung, so it is masked by the same kind of
# speck cloud rather than being a flat gradient. A separate small strip, because the
# plate's own particles are laid out along a helix and would not tile across a bar.
SW,SH = 360,16
sacc = np.zeros((SH*SS,SW*SS),np.float32)
# Placed on a jittered grid rather than scattered at random: independent random
# positions clump, and clumps merge into a smear instead of reading as individual
# specks. Two offset rows give the bar depth without closing the gaps.
STEP = 9.0
# One row only: two overlapping rows fused into vertical ovals once the strip was
# squashed into the bar's height, which read as tick marks rather than bubbles.
for row, (yc, rscale) in enumerate(((0.5, 1.0),)):
    n = int(SW / STEP)
    for i in range(n):
        x = (i + 0.5 + rng.uniform(-0.22, 0.22)) * STEP * SS
        y = (SH * yc + rng.normal(0, 0.35)) * SS
        r = rng.uniform(2.2, 4.0) * rscale * SS
        g = rng.uniform(0.8, 1.5) * (1.0 if row == 0 else 0.7)
        lo_x=max(0,int(x-r-1)); hi_x=min(SW*SS,int(x+r+2))
        lo_y=max(0,int(y-r-1)); hi_y=min(SH*SS,int(y+r+2))
        if hi_x<=lo_x or hi_y<=lo_y: continue
        yy,xx=np.mgrid[lo_y:hi_y, lo_x:hi_x]
        sacc[lo_y:hi_y, lo_x:hi_x]+=np.exp(-((xx-x)**2+(yy-y)**2)/(2*(r*0.55)**2))*g
slum = 1-np.exp(-np.clip(sacc,0,None)*0.85)
sarr = np.asarray(Image.fromarray((np.clip(slum,0,1)*255).astype(np.uint8),"L")
                  .resize((SW,SH),Image.LANCZOS),np.float32)/255.0
# White with the speck value in ALPHA, not a grey image: a CSS mask-image reads the
# alpha channel by default, so a pure-greyscale strip masks nothing at all.
_a=(np.clip(sarr,0,1)*255).astype(np.uint8)
strip=Image.merge("LA",(Image.fromarray(np.full_like(_a,255),"L"),Image.fromarray(_a,"L")))
strip.save("helix_bar.png")

legs={"A":[],"B":[]}
for i in range(121):
    a,b=helix(i/120)
    legs["A"].append([round(a[0]/SS,1),round(a[1]/SS,1)])
    legs["B"].append([round(b[0]/SS,1),round(b[1]/SS,1)])
json.dump({"w":W,"h":H,"rungs":rungs,"legs":legs,"tube_r":9.0,"rung_r":5.0},
          open("helix_geometry.json","w"))
print("particle plate:",W,"x",H,"| rungs:",len(rungs))
