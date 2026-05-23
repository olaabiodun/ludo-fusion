from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "assets" / "images"


def load_font(size: int, bold: bool = True):
    candidates = [
        Path(r"C:\Windows\Fonts\arialbd.ttf") if bold else Path(r"C:\Windows\Fonts\arial.ttf"),
        Path(r"C:\Windows\Fonts\segoeuib.ttf") if bold else Path(r"C:\Windows\Fonts\segoeui.ttf"),
        Path(r"C:\Windows\Fonts\Tahoma.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def rounded_badge(width: int, height: int, text: str, text_color, fill, stroke, font_size: int):
    badge = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle((2, 2, width - 3, height - 3), radius=height // 2, fill=fill, outline=stroke, width=4)
    font = load_font(font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((width - tw) / 2, (height - th) / 2 - 3), text, font=font, fill=text_color)
    return badge


def transparent_from_black(src: Image.Image, threshold: int = 8):
    rgba = src.convert("RGBA")
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if max(r, g, b) <= threshold:
                px[x, y] = (r, g, b, 0)
    return rgba


def soften_region(base: Image.Image, box, color, blur=24):
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse(box, fill=color)
    overlay = overlay.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base.convert("RGBA"), overlay)


def make_logo_safe():
    src = Image.open(IMG / "logoui.png")
    safe = transparent_from_black(src)

    badge = rounded_badge(
        820,
        110,
        "PLAY MULTIPLAYER",
        (247, 209, 66, 255),
        (5, 5, 5, 255),
        (214, 175, 55, 255),
        48,
    )
    glow = badge.filter(ImageFilter.GaussianBlur(10))
    glow_layer = Image.new("RGBA", safe.size, (0, 0, 0, 0))
    glow_layer.alpha_composite(glow, (560, 664))
    safe = Image.alpha_composite(safe, glow_layer)
    safe.alpha_composite(badge, (560, 664))

    # Hard-cover the cash icon area with a transparent-safe black cap behind the badge.
    cover = Image.new("RGBA", safe.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(cover)
    cd.rounded_rectangle((1190, 650, 1490, 860), radius=44, fill=(0, 0, 0, 255))
    safe = Image.alpha_composite(safe, cover)
    safe.alpha_composite(badge, (560, 664))

    safe = safe.resize((612, 408), Image.LANCZOS)
    out = IMG / "logoui-safe.png"
    safe.save(out)
    return out


def make_splash_safe(logo_path: Path):
    src = Image.open(IMG / "splashui.png").convert("RGBA")
    safe = src.copy()

    # Full black cover over the old lower slogan and cash icon.
    cover = Image.new("RGBA", safe.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(cover)
    cd.rounded_rectangle((400, 710, 1460, 900), radius=56, fill=(0, 0, 0, 255))
    safe = Image.alpha_composite(safe, cover)

    badge = rounded_badge(
        860,
        118,
        "PLAY MULTIPLAYER",
        (255, 255, 255, 255),
        (5, 5, 5, 255),
        (245, 245, 245, 255),
        54,
    )
    glow = badge.filter(ImageFilter.GaussianBlur(14))
    glow_layer = Image.new("RGBA", safe.size, (0, 0, 0, 0))
    glow_layer.alpha_composite(glow, (440, 738))
    safe = Image.alpha_composite(safe, glow_layer)
    safe.alpha_composite(badge, (440, 738))

    # Clean up any leftover bright icon edge on the right.
    right_cap = Image.new("RGBA", safe.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(right_cap)
    rd.ellipse((1290, 690, 1525, 920), fill=(0, 0, 0, 255))
    safe = Image.alpha_composite(safe, right_cap)
    safe.alpha_composite(badge, (440, 738))

    out = IMG / "splashui-safe.png"
    safe.save(out)
    return out


def make_auth_safe():
    src = Image.open(IMG / "ludo-fusion1.png").convert("RGBA")
    safe = src.copy()

    # Remove floating coins by blending soft dark overlays into the background.
    for box in [
        (0, 120, 150, 380),
        (40, 0, 220, 180),
        (1210, 0, 1536, 250),
        (1290, 220, 1536, 420),
        (1295, 470, 1536, 700),
        (1180, 40, 1360, 170),
        (1370, 760, 1536, 1024),
        (0, 300, 120, 500),
    ]:
        safe = soften_region(safe, box, (4, 14, 7, 235), blur=36)

    # Rebuild the corner glow a bit so the edges do not look erased.
    accent = Image.new("RGBA", safe.size, (0, 0, 0, 0))
    ad = ImageDraw.Draw(accent)
    ad.ellipse((1180, 40, 1435, 300), fill=(10, 40, 10, 110))
    ad.ellipse((1310, 720, 1536, 1024), fill=(70, 45, 4, 95))
    ad.ellipse((0, 60, 220, 320), fill=(70, 24, 10, 90))
    accent = accent.filter(ImageFilter.GaussianBlur(48))
    safe = Image.alpha_composite(safe, accent)

    out = IMG / "ludo-fusion-safe.png"
    safe.save(out)
    return out


def main():
    logo = make_logo_safe()
    splash = make_splash_safe(logo)
    auth = make_auth_safe()
    print(logo)
    print(splash)
    print(auth)


if __name__ == "__main__":
    main()
