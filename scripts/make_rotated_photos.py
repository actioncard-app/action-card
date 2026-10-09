#!/usr/bin/env python3
"""Sideways / upside-down phone photos: every 2nd image of test-docs/phone/ rotated by 90, 180 or 270 degrees
(cycling), written to test-docs/phone-rotated/ with expected.json. The split follows the source photo:
'rot-seen' (from the tuning set) and 'rot-heldout' (from the held-out set).
Run scripts/make_phone_photos.py first. Usage: python3 scripts/make_rotated_photos.py"""
import json, os, cv2
SRC, OUT = 'test-docs/phone', 'test-docs/phone-rotated'
os.makedirs(OUT, exist_ok=True)
exp = json.load(open(f'{SRC}/expected.json'))
ROT = {90: cv2.ROTATE_90_CLOCKWISE, 180: cv2.ROTATE_180, 270: cv2.ROTATE_90_COUNTERCLOCKWISE}
out, k = {}, 0
for i, (f, e) in enumerate(exp.items()):
    if i % 2: continue
    deg = [90, 180, 270][k % 3]; k += 1
    img = cv2.rotate(cv2.imread(f'{SRC}/{f}'), ROT[deg])
    name = f.replace('.jpg', f'__rot{deg}.jpg')
    cv2.imwrite(f'{OUT}/{name}', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    out[name] = {**e, 'set': 'rot-seen' if e['set'] == 'phone-seen' else 'rot-heldout', 'rotation': deg}
json.dump(out, open(f'{OUT}/expected.json', 'w'), indent=1, ensure_ascii=False)
from collections import Counter
print(len(out), Counter(v['set'] for v in out.values()), Counter(v['rotation'] for v in out.values()))
