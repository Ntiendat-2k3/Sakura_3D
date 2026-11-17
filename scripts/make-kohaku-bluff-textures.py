"""Vẽ texture lá bài Kohaku Bluff (mặt K/Q/A/JOKER + mặt sau hổ phách 琥珀) bằng Pillow.
Blender không kèm Pillow nên build-kohaku-bluff-props.py gọi script này bằng Python hệ thống.
Chạy: python scripts/make-kohaku-bluff-textures.py <thư mục xuất>"""
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
W, H = 252, 352  # tỉ lệ 0.063 : 0.088, dưới giới hạn 512 px
GOLD, DEEP, AMBER, CREAM = (232, 190, 96), (58, 28, 12), (214, 138, 34), (250, 236, 206)
FONTS = ['C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/YuGothB.ttc', 'C:/Windows/Fonts/arialbd.ttf']

def font(size):
    for path in FONTS:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()

def centered(draw, xy, text, fnt, fill):
    draw.text(xy, text, font=fnt, fill=fill, anchor='mm')

def border(draw, color):
    draw.rounded_rectangle((6, 6, W - 7, H - 7), radius=14, outline=color, width=4)
    draw.rounded_rectangle((16, 16, W - 17, H - 17), radius=9, outline=color, width=1)

def gem(draw, cx, cy, r, fill, outline):
    # Viên hổ phách hình thoi nhiều mặt, mô-típ chung của mặt trước và mặt sau.
    draw.polygon([(cx, cy - r), (cx + r * 0.72, cy), (cx, cy + r), (cx - r * 0.72, cy)], fill=fill, outline=outline)
    draw.polygon([(cx, cy - r), (cx + r * 0.72, cy), (cx, cy)], fill=tuple(min(255, c + 30) for c in fill))

def face(name, label, accent):
    img = Image.new('RGB', (W, H), CREAM)
    d = ImageDraw.Draw(img)
    border(d, accent)
    if name == 'JOKER':
        centered(d, (W / 2, H / 2 - 20), 'JOKER', font(52), accent)
        gem(d, W / 2, H / 2 + 60, 46, AMBER, DEEP)
        d.text((30, 34), '★', font=font(36), fill=accent, anchor='mm')
        d.text((W - 30, H - 34), '★', font=font(36), fill=accent, anchor='mm')
    else:
        centered(d, (W / 2, H / 2 - 6), label, font(170), accent)
        for cx, cy in ((34, 40), (W - 34, H - 40)):
            centered(d, (cx, cy), label, font(40), accent)
            gem(d, cx, cy + (36 if cy < H / 2 else -36), 13, AMBER, DEEP)
        gem(d, W / 2, H - 52, 20, AMBER, DEEP)
    img.save(OUT / f'face-{name}.png')

def back():
    img = Image.new('RGB', (W, H), DEEP)
    d = ImageDraw.Draw(img)
    # Lưới thoi vàng kim phủ nền gỗ tối.
    for i in range(-12, 24):
        d.line((i * 24, 0, i * 24 + H * 0.7, H), fill=(110, 70, 24), width=1)
        d.line((i * 24 + H * 0.7, 0, i * 24, H), fill=(110, 70, 24), width=1)
    border(d, GOLD)
    d.ellipse((W / 2 - 76, H / 2 - 76, W / 2 + 76, H / 2 + 76), fill=AMBER, outline=GOLD, width=5)
    d.ellipse((W / 2 - 62, H / 2 - 62, W / 2 + 62, H / 2 + 62), outline=DEEP, width=2)
    centered(d, (W / 2, H / 2 - 22), '琥', font(58), DEEP)
    centered(d, (W / 2, H / 2 + 34), '珀', font(58), DEEP)
    for k in range(8):
        a = k * math.pi / 4
        gem(d, W / 2 + math.cos(a) * 100, H / 2 + math.sin(a) * 100, 8, GOLD, DEEP)
    img.save(OUT / 'back.png')

face('K', 'K', (150, 40, 40))
face('Q', 'Q', (112, 44, 96))
face('A', 'A', (24, 74, 92))
face('JOKER', 'JOKER', (170, 96, 18))
back()
print('KOHAKU_BLUFF_TEXTURES_OK', OUT)
