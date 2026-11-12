from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path("images")
TARGETS = sorted(ROOT.rglob("*.png"))

def remove_connected_white_background(image):
    rgba = image.convert("RGBA")
    rgb = rgba.convert("RGB")
    width, height = rgb.size

    # Flood-fill only near-white pixels connected to the image edge. This
    # preserves isolated white details inside the actual artwork.
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    pixels = rgb.load()
    visited = bytearray(width * height)
    stack = []

    for x in range(width):
        stack.append((x, 0))
        stack.append((x, height - 1))
    for y in range(height):
        stack.append((0, y))
        stack.append((width - 1, y))

    while stack:
        x, y = stack.pop()
        idx = y * width + x
        if visited[idx]:
            continue
        visited[idx] = 1
        r, g, b = pixels[x, y]
        if min(r, g, b) < 238 or max(r, g, b) - min(r, g, b) > 18:
            continue
        draw.point((x, y), fill=255)
        if x > 0: stack.append((x - 1, y))
        if x + 1 < width: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y + 1 < height: stack.append((x, y + 1))

    # Slightly soften the cut edge to avoid a harsh white fringe.
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.65))
    alpha = Image.eval(mask, lambda value: 255 - value)
    rgba.putalpha(alpha)
    return rgba

for file in TARGETS:
    with Image.open(file) as image:
        result = remove_connected_white_background(image)
        result.save(file, format="PNG", optimize=True)
    print(f"Made background transparent: {file}")
