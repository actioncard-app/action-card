#!/usr/bin/env python3
"""Simulate real phone photos of the synthetic test documents (paper on a table, or a screen).

For every image in test-docs/ this writes 2 degraded variants to test-docs/phone/ plus
test-docs/phone/expected.json (same answers as the source document).
Degradations (randomised, fixed seed): document placed on a darker background with a border,
perspective tilt 5-15 deg, in-plane rotation, defocus or motion blur, uneven lighting / shadow
gradient, sensor noise, downscale to "arm's length" resolution, JPEG compression; some variants are
"photo of a screen" (pixel grid / moire, colour cast, glare).

Split: variants of documents from the 'dev' and 'new' sets are the TUNING set ("seen");
variants of 'holdout', 'fresh' and 'stress' documents are the HELD-OUT set and must not be used to tune rules.
Usage: python3 scripts/make_phone_photos.py
"""
import json, os, math, random
import numpy as np, cv2

SRC = 'test-docs'; OUT = 'test-docs/phone'
os.makedirs(OUT, exist_ok=True)
rng = random.Random(20261008); nrng = np.random.default_rng(20261008)
exp = json.load(open(f'{SRC}/expected.json'))

def background(h, w):
    base = np.array([rng.randint(60, 150), rng.randint(60, 140), rng.randint(50, 130)], np.float32)  # table
    bg = np.ones((h, w, 3), np.float32) * base
    bg += nrng.normal(0, 8, (h, w, 1)).astype(np.float32)
    return bg

def perspective(img, tilt_deg, rot_deg, pad_frac):
    h, w = img.shape[:2]
    pad = int(max(h, w) * pad_frac)
    H, W = h + 2 * pad, w + 2 * pad
    canvas = background(H, W)
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    # keystone: shrink the top (or a side) edge by tan(tilt)
    k = math.tan(math.radians(tilt_deg)) * 0.5
    dst = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    if rng.random() < 0.6:  # top/bottom keystone
        s = k * w * rng.choice([1, -1]); edge = [0, 1] if s > 0 else [3, 2]
        dst[edge[0]][0] += abs(s); dst[edge[1]][0] -= abs(s)
    else:
        s = k * h * rng.choice([1, -1]); edge = [0, 3] if s > 0 else [1, 2]
        dst[edge[0]][1] += abs(s); dst[edge[1]][1] -= abs(s)
    c = np.float32([w / 2, h / 2]); a = math.radians(rot_deg)
    R = np.float32([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
    dst = (dst - c) @ R.T + c + pad
    M = cv2.getPerspectiveTransform(src, dst.astype(np.float32))
    warped = cv2.warpPerspective(img.astype(np.float32), M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
    mask = cv2.warpPerspective(np.ones((h, w), np.float32), M, (W, H))
    mask = cv2.GaussianBlur(mask, (3, 3), 0)[..., None]
    return warped * mask + canvas * (1 - mask)

def lighting(img, strength):
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    ang = rng.uniform(0, 2 * math.pi)
    g = (xx * math.cos(ang) + yy * math.sin(ang)); g = (g - g.min()) / (g.max() - g.min() + 1e-6)
    light = 1 - strength * g
    if rng.random() < 0.5:  # hand / phone shadow blob
        cx, cy = rng.uniform(0, W), rng.uniform(0, H); r = rng.uniform(0.25, 0.5) * max(H, W)
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        light *= 1 - rng.uniform(0.2, 0.4) * np.clip(1 - d / r, 0, 1)
    warm = np.array([rng.uniform(0.85, 1.0), rng.uniform(0.92, 1.0), 1.0], np.float32)  # BGR colour cast
    return img * light[..., None] * warm

def blur(img, kind):
    if kind == 'defocus':
        r = rng.uniform(1.0, 2.2)
        k = int(2 * math.ceil(r) + 1); ker = np.zeros((k, k), np.float32)
        cv2.circle(ker, (k // 2, k // 2), int(round(r)), 1, -1); ker /= ker.sum()
        return cv2.filter2D(img, -1, ker)
    if kind == 'motion':
        L = rng.randint(4, 8); ker = np.zeros((L, L), np.float32); ker[L // 2, :] = 1
        Mr = cv2.getRotationMatrix2D((L / 2 - .5, L / 2 - .5), rng.uniform(0, 180), 1)
        ker = cv2.warpAffine(ker, Mr, (L, L)); ker /= ker.sum()
        return cv2.filter2D(img, -1, ker)
    return cv2.GaussianBlur(img, (0, 0), rng.uniform(0.6, 1.2))

def screen(img):
    """Photo of a monitor / phone screen: RGB subpixel grid at an angle -> moire after resampling, glare."""
    H, W = img.shape[:2]
    up = cv2.resize(img, (W * 3, H * 3), interpolation=cv2.INTER_NEAREST)
    grid = np.zeros((3, 3, 3), np.float32) + 0.55
    for c in range(3): grid[:, c, 2 - c] = 1.0  # BGR stripes
    grid[2, :, :] *= 0.7
    tile = np.tile(grid, (H, W, 1))
    up = up * tile
    M = cv2.getRotationMatrix2D((W * 1.5, H * 1.5), rng.uniform(1.5, 4), 1.0)
    up = cv2.warpAffine(up, M, (W * 3, H * 3), borderValue=(20, 20, 20))
    img = cv2.resize(up, (W, H), interpolation=cv2.INTER_AREA) * 1.35
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = rng.uniform(0.2, 0.8) * W, rng.uniform(0.2, 0.8) * H
    glare = 60 * np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * (0.18 * max(H, W)) ** 2)))
    return img + glare[..., None]

def finish(img, target_long, q, noise):
    img = img + nrng.normal(0, noise, img.shape).astype(np.float32)
    img = np.clip(img, 0, 255).astype(np.uint8)
    H, W = img.shape[:2]; s = target_long / max(H, W)
    img = cv2.resize(img, (int(W * s), int(H * s)), interpolation=cv2.INTER_AREA)
    return img, q

def variant(img, kind):
    if kind == 'paper':      # typical careful photo
        out = perspective(img, rng.uniform(5, 15), rng.uniform(-6, 6), rng.uniform(0.04, 0.12))
        out = lighting(out, rng.uniform(0.25, 0.5)); out = blur(out, rng.choice(['defocus', 'gauss', 'motion']))
        return finish(out, rng.randint(1100, 1600), rng.randint(55, 80), rng.uniform(3, 7))
    if kind == 'armslength': # whole page small in frame, lower detail
        out = perspective(img, rng.uniform(5, 12), rng.uniform(-4, 4), rng.uniform(0.15, 0.25))
        out = lighting(out, rng.uniform(0.15, 0.35)); out = blur(out, 'gauss')
        return finish(out, rng.randint(850, 1000), rng.randint(50, 70), rng.uniform(4, 8))
    if kind == 'skewed':     # quick snap: bigger rotation + motion blur + shadow
        out = perspective(img, rng.uniform(8, 15), rng.choice([-1, 1]) * rng.uniform(6, 12), rng.uniform(0.05, 0.1))
        out = lighting(out, rng.uniform(0.35, 0.6)); out = blur(out, 'motion')
        return finish(out, rng.randint(1100, 1500), rng.randint(55, 75), rng.uniform(4, 8))
    if kind == 'screen':     # photo of a screen (e-mail / PDF on a laptop)
        out = screen(img.astype(np.float32))
        out = perspective(out, rng.uniform(5, 12), rng.uniform(-4, 4), rng.uniform(0.04, 0.1))
        out = blur(out, 'gauss')
        return finish(out, rng.randint(1100, 1500), rng.randint(55, 80), rng.uniform(4, 8))

out_exp = {}
for f, e in exp.items():
    img = cv2.imread(f'{SRC}/{f}', cv2.IMREAD_COLOR)
    if img is None: raise SystemExit(f'missing {f}')
    base = os.path.splitext(f)[0]
    held = e.get('set', 'dev') in ('holdout', 'fresh', 'stress')
    kinds = ['paper', rng.choice(['armslength', 'skewed', 'screen'])]
    for k in kinds:
        out, q = variant(img, k)
        name = f'{base}__{k}.jpg'
        cv2.imwrite(f'{OUT}/{name}', out, [cv2.IMWRITE_JPEG_QUALITY, q])
        out_exp[name] = {**{x: e.get(x) for x in ('docLanguage', 'docType', 'deadline', 'amount', 'currency', 'reference')},
                         'set': 'phone-heldout' if held else 'phone-seen', 'source': f, 'degradation': k}
json.dump(out_exp, open(f'{OUT}/expected.json', 'w'), indent=1, ensure_ascii=False)
from collections import Counter
print(len(out_exp), Counter(v['set'] for v in out_exp.values()), Counter(v['degradation'] for v in out_exp.values()))
