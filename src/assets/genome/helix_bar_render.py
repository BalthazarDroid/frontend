"""
Callout-bar speck strip.

The molecule itself is drawn live in the browser (see helpers/genome_helix.ts) - it has
to be, because a picture cannot rotate about its own axis. This strip is all that is
left of the design-time renderer: a small texture used to mask the callout's mix bar so
the bar is made of the same material as the rung it describes.

Design-time only; MA ships the PNG. Run it from this directory.
"""
import math, numpy as np
from PIL import Image

SS = 2
rng = np.random.default_rng(7)

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


print("bar strip:", SW, "x", SH)
