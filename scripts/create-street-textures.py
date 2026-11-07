"""Tạo atlas vật liệu và biển hiệu nguyên bản; không phân phối file font hệ thống."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/web/public/assets/textures'
OUT.mkdir(parents=True, exist_ok=True)
RNG = random.Random(1205)
SIZE = 256
COLORS = ['#514363', '#b8a59a', '#57352e', '#282b42', '#d59c69', '#42647a',
          '#b79759', '#802b4c', '#656579', '#272938', '#9a537f', '#634853',
          '#c3b9aa', '#cd8aa5', '#302433', '#191c30']
atlas = Image.new('RGB', (1024, 1024))
emission = Image.new('RGB', atlas.size)
orm = Image.new('RGB', atlas.size, (255, 210, 0))
for index, color in enumerate(COLORS):
    tile = Image.new('RGB', (SIZE, SIZE), color)
    base = tile.getpixel((0, 0))
    tile.putdata([tuple(max(0, min(255, c + RNG.randint(-7, 7))) for c in base) for _ in range(SIZE * SIZE)])
    d = ImageDraw.Draw(tile)
    if index in (0, 1, 11, 12):
        for y in range(0, SIZE, 32):
            d.line((0, y, SIZE, y), fill=tuple(int(c*.8) for c in base), width=2)
            for x in range((y//32 % 2)*32, SIZE, 64):
                d.line((x, y, x, y+32), fill=tuple(int(c*.83) for c in base))
    if index in (2, 14):
        for x in range(0, SIZE, 32):
            d.line((x, 0, x, SIZE), fill='#251f2a', width=3)
            for k in range(5):
                xx = x + RNG.randrange(4, 28)
                d.line([(xx, 0), (xx+2, 80), (xx-1, 170), (xx, SIZE)], fill=tuple(int(c*.75) for c in base))
    if index == 3:
        for y in range(0, SIZE, 24):
            d.line((0, y, SIZE, y), fill='#111724', width=3)
            for x in range(0, SIZE, 32):
                d.arc((x, y-18, x+32, y+6), 0, 180, fill='#515064', width=2)
    if index in (4, 5, 10):
        d.rectangle((3, 3, 252, 252), outline='#29253a', width=9)
        for y in range(22, 240, 18):
            d.line((10, y, 246, y), fill=tuple(int(c*.72) for c in base), width=2)
        d.polygon([(15, 240), (108, 15), (166, 15), (73, 240)], fill=tuple(min(255, int(c*1.2)) for c in base))
        d.line((128, 6, 128, 250), fill='#3b3145', width=6)
    if index == 6:
        for y in range(0, SIZE, 3):
            d.line((0, y, SIZE, y), fill='#a68450')
    if index == 7:
        for x in range(0, SIZE, 64):
            d.rectangle((x+32, 0, x+62, SIZE), fill='#d5b59d')
        for y in range(0, SIZE, 4):
            d.line((0, y, SIZE, y), fill='#683044', width=1)
    if index == 8:
        for y in range(0, SIZE, 64):
            d.line((0, y, SIZE, y), fill='#363545', width=4)
            for x in range((y//64 % 2)*32, SIZE, 64):
                d.line((x, y, x, y+64), fill='#363545', width=3)
    if index == 13:
        for _ in range(70):
            x, y = RNG.randrange(SIZE), RNG.randrange(SIZE)
            d.ellipse((x, y, x+9, y+6), fill=RNG.choice(['#e9a6c0', '#bb668e', '#f7c5d8']))
    box = ((index % 4)*SIZE, (index//4)*SIZE)
    atlas.paste(tile, box)
    if index in (4, 5, 10):
        emission.paste(tile.point(lambda v: int(v * .3)), box)
    orm.paste(Image.new('RGB', (SIZE, SIZE), (255, 90 if index in (4,5,6,10) else 210, 180 if index == 6 else 0)), box)
atlas.save(OUT/'street-surfaces.png', optimize=True)
emission.save(OUT/'street-emission.png', optimize=True)
orm.save(OUT/'street-orm.png', optimize=True)

signs = Image.new('RGB', (2048, 384), '#131324')
blades = Image.new('RGB', (512, 512), '#131324')
entries = [('琥珀', 'K O H A K U', 'PRIVATE MEMBERS CLUB', '#e9c878'),
           ('夜桜', 'Y O Z A K U R A', 'IZAKAYA / SAKE BAR', '#ed9d72'),
           ('麗華', 'R E I K A', 'HOSTESS LOUNGE', '#f3a3ce'),
           ('紅蓮', 'K U R E N A I', 'OIRAN LOUNGE', '#ee8b87'),
           ('月華', 'G E K K A', 'CABARET / LIVE SHOW', '#dba4ef'),
           ('電夢', 'D E N M U', 'NIGHT CLUB / MUSIC', '#74e2e4'),
           ('桜衣', 'S A K U R A', 'ATELIER / FASHION', '#edbdd8'),
           ('花灯', 'H A N A A K A R I', 'TEA / CONFECTIONERY', '#dfc399')]
jp = ImageFont.truetype('C:/Windows/Fonts/YuGothB.ttc', 68)
latin = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 24)
small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 13)
for i, (title, name, subtitle, color) in enumerate(entries):
    cell = Image.new('RGB', (512,192), '#151425')
    d = ImageDraw.Draw(cell)
    d.rounded_rectangle((5,5,507,187), radius=5, outline=color, width=2)
    d.text((256,60), title, font=jp, fill=color, anchor='mm')
    d.line((98,105,414,105), fill=color, width=1)
    d.text((256,126), name, font=latin, fill='#fff0dc', anchor='mm')
    d.text((256,158), subtitle, font=small, fill=color, anchor='mm')
    signs.paste(cell, ((i%4)*512, (i//4)*192))
    blade=Image.new('RGB',(128,256),'#1c1428')
    bd=ImageDraw.Draw(blade)
    bd.rectangle((5,5,122,250),outline=color,width=3)
    for k,ch in enumerate(title):
        bd.text((64,70+k*76),ch,font=jp,fill=color,anchor='mm')
    bd.text((64,218),name.replace(' ',''),font=small,fill=color,anchor='mm')
    blades.paste(blade,((i%4)*128,(i//4)*256))
signs.save(OUT/'venue-signs.png', optimize=True)
blades.save(OUT/'blade-signs.png', optimize=True)

# Mặt máy bán nước có sản phẩm và nhãn riêng, không sử dụng logo thương hiệu thật.
vending = Image.new('RGB', (256,512), '#7f2e49')
d=ImageDraw.Draw(vending)
d.rectangle((12,52,192,355), fill='#1c2b3d', outline='#e5bfa5', width=4)
d.text((128,25), 'SAKURA SODA', font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',23), fill='#ffe4c3', anchor='mm')
for row in range(3):
    for col in range(4):
        x,y=25+col*41,68+row*93
        c=['#f691b7','#79ced0','#e8c27b','#a4a3da'][col]
        d.rounded_rectangle((x,y,x+23,y+54),radius=5,fill=c)
        d.rectangle((x+2,y+15,x+21,y+32),fill='#fff1df')
        d.ellipse((x+6,y+62,x+17,y+69),fill='#8dd4ac')
d.rectangle((210,140,244,225),fill='#181c2d',outline='#ceb69e',width=2)
d.rectangle((210,156,243,162),fill='#e8d5a9')
d.rounded_rectangle((26,402,221,457),radius=9,fill='#171a26',outline='#bcb9c6',width=3)
vending.save(OUT/'vending-front.png',optimize=True)
print('Created 5 original texture maps and signage atlas')
