#!/usr/bin/env python3
"""生成预录人声（照 tahun1-mt-pecahan/gen-voice.py 的做法：SAY＋FNV 档名）。

流程：用 node 读 src/data/say.ts 的 voiceLines()（要录的句子＋档名）→ edge-tts 生成 public/audio/<档名>.mp3
→ 写 src/data/voice-manifest.ts（speak() 只会播 manifest 里有的档）。
档名 = FNV-1a(声音|句子)，与 say.ts 的 fnv() 一致；已存在的档不重录，所以句子一改，只会重录改过的那几句。
用法（在专案根目录）：python3 scripts/gen-voice.py
依赖：edge-tts（本机工具，python3 -m pip install --user edge-tts），node ≥ 22.6（直接读 .ts）。
"""
import asyncio, json, os, subprocess, sys
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'public', 'audio')
MANIFEST = os.path.join(ROOT, 'src', 'data', 'voice-manifest.ts')
RATE = '-8%'  # 一年级：慢一点
os.makedirs(AUDIO, exist_ok=True)

def fnv(s):
    h = 0x811c9dc5
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f'{h:08x}'

JS = ("import {voiceLines, VOICE_ID} from './src/data/say.ts';"
      "console.log(JSON.stringify({voice: VOICE_ID, lines: voiceLines()}))")
raw = subprocess.run(['node', '--input-type=module', '-e', JS], cwd=ROOT, capture_output=True, text=True)
if raw.returncode != 0:
    sys.exit('读 say.ts 失败：' + raw.stderr)
data = json.loads(raw.stdout)
voice, lines = data['voice'], data['lines']

for l in lines:
    assert fnv(voice + '|' + l['text']) == l['file'], ('档名算法不一致', l)

# 同一句话（不同 key）只录一次
todo = {l['file']: l['text'] for l in lines}

async def one(sem, file, text):
    out = os.path.join(AUDIO, file + '.mp3')
    if os.path.exists(out) and os.path.getsize(out) > 1000:
        return 'skip'
    async with sem:
        err = None
        for _ in range(3):
            try:
                await edge_tts.Communicate(text, voice, rate=RATE).save(out)
                return 'new'
            except Exception as e:  # 网络偶尔失败，重试
                err = e
                await asyncio.sleep(1.5)
        raise err

async def main():
    sem = asyncio.Semaphore(4)
    res = await asyncio.gather(*(one(sem, f, t) for f, t in todo.items()))
    print(f"句子 {len(todo)} 句：新录 {res.count('new')}，已存在 {res.count('skip')}")

asyncio.run(main())

files = sorted(todo)
with open(MANIFEST, 'w', encoding='utf-8') as f:
    f.write('// 由 scripts/gen-voice.py 生成，不要手改\n')
    f.write('export const VOICE_FILES: readonly string[] = [\n')
    for x in files:
        f.write(f"  '{x}',\n")
    f.write(']\n')

extra = sorted(set(n[:-4] for n in os.listdir(AUDIO) if n.endswith('.mp3')) - set(files))
if extra:
    print(f'注意：public/audio/ 里有 {len(extra)} 个旧音档已不再使用（句子改过）：{extra[:5]}。可移到 ~/Documents/待删除/')
