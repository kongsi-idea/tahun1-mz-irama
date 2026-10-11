"""去白底 → 裁边 → 缩放 → WebP。用法：
python3 scripts/cutout.py <src.png> <public/img/name.webp> [--max 512] [--keep-bg] [--thr 236]
只去掉「和图边相连」的近白区域，角色身上的白色高光不受影响；边缘按白度做半透明羽化。
--keep-bg：不去背（背景图、缩图用），只缩放转 WebP。
"""
import sys, argparse
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--max", type=int, default=512)
ap.add_argument("--keep-bg", action="store_true")
ap.add_argument("--thr", type=int, default=236)
ap.add_argument("--quality", type=int, default=86)
ap.add_argument("--spread", type=int, default=18)
ap.add_argument("--sat", type=float, default=1.0)
a = ap.parse_args()

im = Image.open(a.src).convert("RGBA")
if a.sat != 1.0:
    from PIL import ImageEnhance
    al = im.getchannel("A"); im = ImageEnhance.Color(im.convert("RGB")).enhance(a.sat).convert("RGBA"); im.putalpha(al)
if not a.keep_bg:
    rgb = np.asarray(im)[:, :, :3].astype(np.int16)
    mn = rgb.min(axis=2)
    spread = rgb.max(axis=2) - mn
    whiteish = (mn >= a.thr) & (spread <= a.spread)
    lab, _ = ndimage.label(whiteish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # 背景旁 3px 的过渡带：按白度给半透明
    near = ndimage.binary_dilation(bg, iterations=3) & ~bg
    alpha = np.full(mn.shape, 255, np.float32)
    alpha[bg] = 0
    soft = np.clip((255 - mn[near]) / (255 - a.thr + 30), 0, 1) * 255
    alpha[near] = np.minimum(alpha[near], np.maximum(soft, 40))
    arr = np.asarray(im).copy()
    arr[:, :, 3] = alpha.astype(np.uint8)
    im = Image.fromarray(arr)
    a_ch = im.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(a_ch)
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        pad = 8
        im = im.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad)))

im.thumbnail((a.max, a.max), Image.LANCZOS)
im.save(a.dst, "WEBP", quality=a.quality, method=6)
import os
print(f"{a.dst}  {im.width}x{im.height}  {os.path.getsize(a.dst)/1024:.1f} KB")
