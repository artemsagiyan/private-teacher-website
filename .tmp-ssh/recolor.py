from PIL import Image, ImageFilter

CREME = (210, 205, 195)
COBBLE = (170, 159, 149)
RUBY = (62, 31, 32)
BROWNIE = (62, 43, 36)

def map_color(r, g, b):
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = 0 if mx == 0 else (mx - mn) / mx
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    if r > b + 80 and r > g + 40 and sat > 0.35:
        return RUBY
    if b > r and b > g and (b - r) > 15 and sat > 0.15 and lum < 0.70:
        return RUBY
    if lum < 0.35 and sat < 0.25:
        return BROWNIE
    if lum > 0.93 and sat < 0.08:
        return CREME
    if lum > 0.55:
        return COBBLE
    return BROWNIE

def recolor(src, dst):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            nr, ng, nb = map_color(r, g, b)
            px[x, y] = (nr, ng, nb, a)
    rgb = im.convert("RGB").filter(ImageFilter.ModeFilter(5))
    out = Image.merge("RGBA", (*rgb.split(), im.getchannel("A")))
    out.save(dst)
    print(dst, w, h)

base = "/mnt/d/job/website"
pairs = [
    (f"{base}/.tmp-ssh/swan.png", f"{base}/frontend/public/swan.png"),
    (f"{base}/.tmp-ssh/lesson-cats.png", f"{base}/frontend/public/lesson-cats.png"),
    (f"{base}/.tmp-ssh/calendar-week.png", f"{base}/frontend/public/calendar-week.png"),
]
for src, dst in pairs:
    recolor(src, dst)
