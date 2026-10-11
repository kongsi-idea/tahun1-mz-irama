#!/usr/bin/env python3
"""字体子集化：读 scripts/ui-chars.txt（# 开头为注释），从 assets-src/fonts/ 原档输出 woff2 到 public/fonts/。
可重跑。用法：python3 scripts/subset-fonts.py [--title zcool|huninn]
标题字默认 zcool：粉圆缺大量简体字（见 assets-src/fonts/huninn-coverage.md）。
依赖：fontTools（含 brotli，用于 woff2）。
"""
import sys, os, tempfile
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets-src", "fonts")
OUT = os.path.join(ROOT, "public", "fonts")
TITLE = "huninn" if "--title" in sys.argv and sys.argv[sys.argv.index("--title") + 1] == "huninn" else "zcool"

def chars():
    s = set()
    for line in open(os.path.join(ROOT, "scripts", "ui-chars.txt"), encoding="utf-8"):
        if line.startswith("#"):
            continue
        s |= set(line.rstrip("\n"))
    s.discard("\n")
    return s

def run(src, out, text, limits=None):
    font = TTFont(os.path.join(SRC, src))
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.notdef_outline = True
    opts.name_IDs = [1, 2, 3, 4, 6]
    sub = subset.Subsetter(opts)
    sub.populate(text="".join(sorted(text)))
    sub.subset(font)
    if limits:  # 先子集化再限制变量轴范围（反过来在部分字体会出错）
        font = instancer.instantiateVariableFont(font, limits)
    path = os.path.join(OUT, out)
    font.flavor = "woff2"
    font.save(path)
    print(f"{out}: {os.path.getsize(path)/1024:.1f} KB")

os.makedirs(OUT, exist_ok=True)
text = chars()
if TITLE == "huninn":
    run("jf-openhuninn-2.1.ttf", "title.woff2", text)
else:
    run("ZCOOLKuaiLe-Regular.ttf", "title.woff2", text)
run("NotoSansSC.ttf", "body.woff2", text, {"wght": (400, 700)})
latin = {c for c in text if ord(c) < 0x250}
run("Fredoka.ttf", "num.woff2", latin, {"wdth": 100, "wght": (500, 700)})
