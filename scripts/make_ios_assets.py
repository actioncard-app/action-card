"""iOS app icon (1024x1024, no alpha) and launch image (2732x2732) for the Capacitor project in ios/.
Same design as the PWA icons (scripts/make-icons.mjs). Run: python3 scripts/make_ios_assets.py"""
import os, subprocess, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'ios/App/App/Assets.xcassets')
TEAL, PAPER = (15, 76, 92), (246, 245, 241)

src = os.path.join(tempfile.gettempdir(), 'ios-icon-1024.png')
subprocess.run(['node', 'scripts/make-icons.mjs'], cwd=ROOT, check=True, env={**os.environ, 'IOS_ICON': src})
icon = Image.open(src).convert('RGBA')
flat = Image.new('RGB', icon.size, TEAL)  # App Store icons must not have an alpha channel
flat.paste(icon, mask=icon.split()[3])
flat.save(os.path.join(ASSETS, 'AppIcon.appiconset/AppIcon-512@2x.png'))

# launch screen: app background colour with the icon in the middle (shown for a moment while the web view loads)
splash = Image.new('RGB', (2732, 2732), PAPER)
small = flat.resize((520, 520), Image.LANCZOS)
mask = Image.new('L', small.size, 0)
from PIL import ImageDraw
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 519, 519], radius=116, fill=255)
splash.paste(small, ((2732 - 520) // 2, (2732 - 520) // 2), mask)
for n in ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']:
    splash.save(os.path.join(ASSETS, 'Splash.imageset', n))
print('iOS icon + launch images written')
