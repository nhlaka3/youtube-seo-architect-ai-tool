from PIL import Image, ImageDraw, ImageFont

W, H = 800, 400
img = Image.new("RGB", (W, H), "#0F0F1A")
draw = ImageDraw.Draw(img)

title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 42)
sub_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
brand_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)

draw.rectangle([0, 0, W, 4], fill="#58C4DD")
draw.ellipse([50, 70, 110, 130], fill="#1E1E35", outline="#58C4DD", width=2)
draw.text((62, 85), "YT", fill="#58C4DD", font=brand_font)
draw.text((140, 80), "YT SEO Architect Blog", fill="#58C4DD", font=title_font)
draw.text((140, 140), "AI-Powered YouTube SEO Guides & Strategies", fill="#888899", font=sub_font)
draw.rectangle([0, H-50, W, H], fill="#1A1A30")
draw.text((50, H-38), "yt-seo-architect.vercel.app/blog  ·  Free tools, no credit card required", fill="#888899", font=brand_font)

img.save("/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/public/blog/hero-generic.png")
print("Created hero-generic.png")
