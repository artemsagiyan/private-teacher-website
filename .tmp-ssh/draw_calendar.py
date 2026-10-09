from PIL import Image, ImageDraw, ImageFont

CREME = (210, 205, 195)
COBBLE = (170, 159, 149)
RUBY = (62, 31, 32)
BROWNIE = (62, 43, 36)

font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
font_bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
title = ImageFont.truetype(font_bold, 40)
day = ImageFont.truetype(font_path, 22)
time_font = ImageFont.truetype(font_bold, 20)
subj = ImageFont.truetype(font_path, 20)

im = Image.new("RGB", (1280, 720), COBBLE)
d = ImageDraw.Draw(im)
d.rounded_rectangle((40, 36, 1240, 684), radius=32, fill=CREME)
d.text((80, 68), "28 сент. — 4 окт.", font=title, fill=BROWNIE)

days = ["Пн 28", "Вт 29", "Ср 30", "Чт 1", "Пт 2", "Сб 3", "Вс 4"]
x0, y0 = 72, 150
col_w, col_h = 160, 490
for i, label in enumerate(days):
    x = x0 + i * col_w
    if i == 1:
        d.rectangle((x + 6, y0, x + col_w - 6, y0 + col_h), fill=COBBLE)
    elif i > 0:
        d.line((x, y0, x, y0 + col_h), fill=COBBLE, width=2)
    d.text((x + 28, y0 + 16), label, font=day, fill=BROWNIE)

events = [
    (0, 280, "16:00", "Алгебра", False),
    (1, 430, "18:00", "Физика", True),
    (2, 340, "17:00", "Геометрия", False),
    (3, 230, "15:00", "Алгебра", False),
    (3, 470, "19:00", "Физика", False),
    (4, 360, "18:00", "Геометрия", False),
    (5, 220, "11:00", "Физика", False),
]
for col, y, time, subject, accent in events:
    x = x0 + col * col_w + 16
    fill = RUBY if accent else COBBLE
    ink = CREME if accent else BROWNIE
    d.rounded_rectangle((x, y, x + col_w - 32, y + 78), radius=12, fill=fill)
    d.text((x + 12, y + 12), time, font=time_font, fill=ink)
    d.text((x + 12, y + 40), subject, font=subj, fill=ink)

colors = [CREME, COBBLE, RUBY, BROWNIE]

def snap(path):
    image = Image.open(path).convert("RGBA")
    px = image.load()
    w, h = image.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            best = min(colors, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
            px[x, y] = (*best, a)
    image.save(path)
    print("snapped", path)

snap_target = "/mnt/d/job/website/frontend/public/calendar-week.png"
im.save(snap_target)
snap(snap_target)
for name in ("swan.png", "lesson-cats.png"):
    snap(f"/mnt/d/job/website/frontend/public/{name}")
