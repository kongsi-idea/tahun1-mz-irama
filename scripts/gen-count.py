#!/usr/bin/env python3
"""预备拍人声（「预备、三、二、一」）。和 gen-voice.py 分开：这几个档由 engine/countVoice.ts 用 AudioContext
排在拍点上播（要准），不经 speak()。档名固定 count-0~3.mp3。用法：python3 scripts/gen-count.py
"""
import asyncio, os
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'public', 'audio')
VOICE = 'zh-CN-XiaoxiaoNeural'
WORDS = ['预备', '三', '二', '一']  # 预备拍第 0~3 拍

async def main():
    for i, w in enumerate(WORDS):
        await edge_tts.Communicate(w, VOICE, rate='+10%').save(os.path.join(AUDIO, f'count-{i}.mp3'))
        print(f'count-{i}.mp3  {w}')

asyncio.run(main())
