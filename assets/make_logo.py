from PIL import Image, ImageDraw, ImageFilter

S, OUT = 2048, 1024
lerp = lambda a, b, t: a + (b - a) * t

bg = Image.new("RGB", (S, S))
px = bg.load()
c1, c2 = (14, 18, 44), (40, 30, 92)
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S)
        px[x, y] = tuple(int(lerp(c1[i], c2[i], t)) for i in range(3))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.22), fill=255)
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
img.paste(bg, (0, 0), mask)
d = ImageDraw.Draw(img)

# document with a folded corner
L, T, R, B = S * 0.24, S * 0.16, S * 0.70, S * 0.80
fold = S * 0.11
doc = [(L, T), (R - fold, T), (R, T + fold), (R, B), (L, B)]
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).polygon([(x + S * 0.015, y + S * 0.02) for x, y in doc], fill=(0, 0, 0, 120))
img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(S * 0.02)))
d = ImageDraw.Draw(img)
d.polygon(doc, fill=(236, 240, 255, 255))
d.polygon([(R - fold, T), (R - fold, T + fold), (R, T + fold)], fill=(190, 198, 235, 255))

# data table rows
rx0, rx1 = L + S * 0.06, R - S * 0.06
for i in range(6):
    y = T + S * 0.17 + i * S * 0.075
    w = [1.0, 0.82, 0.93, 0.7, 0.88, 0.6][i]
    d.rounded_rectangle((rx0, y, rx0 + (rx1 - rx0) * w, y + S * 0.03), radius=S * 0.012,
                        fill=(124, 108, 255, 255) if i == 0 else (160, 170, 214, 255))

# gold seal with a check
cx, cy, r = S * 0.70, S * 0.72, S * 0.17
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((cx - r * 1.15, cy - r * 1.15, cx + r * 1.15, cy + r * 1.15), fill=(255, 196, 64, 110))
img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(S * 0.03)))
d = ImageDraw.Draw(img)
d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(245, 180, 40, 255))
d.ellipse((cx - r * 0.82, cy - r * 0.82, cx + r * 0.82, cy + r * 0.82), outline=(255, 232, 160, 255), width=int(S * 0.012))
d.line([(cx - r * 0.42, cy + r * 0.02), (cx - r * 0.1, cy + r * 0.34), (cx + r * 0.46, cy - r * 0.32)],
       fill=(40, 30, 92, 255), width=int(S * 0.04), joint="curve")

img.resize((OUT, OUT), Image.LANCZOS).save("assets/databond-logo.png")
