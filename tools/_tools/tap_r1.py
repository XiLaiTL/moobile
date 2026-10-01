# Tap the "R1" entry chip on the Android emulator, then dump the R1 screen's
# UI hierarchy with text + bounds, so we can judge R1 (inline text flow) using
# Android's real text engine instead of the browser's.
import io
import os
import re
import subprocess
import sys
import time

ADB = r'C:\Users\XiLaiTL\AppData\Local\Android\Sdk\platform-tools\adb.exe'
# 输出路径从脚本位置推导（脚本在 <模块根>/_tools/ 下），不写死盘符。
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_r1', 'android_r1_ui.xml')


def dump():
    subprocess.run([ADB, 'shell', 'uiautomator', 'dump', '/data/local/tmp/ui.xml'],
                   capture_output=True)
    r = subprocess.run([ADB, 'shell', 'cat', '/data/local/tmp/ui.xml'], capture_output=True)
    return r.stdout.decode('utf-8', 'replace')


def nodes(xml):
    return re.findall(
        r'<node[^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)


xml = dump()
entry = None
for t, x1, y1, x2, y2 in nodes(xml):
    if 'R1' in t:
        entry = (t, (int(x1) + int(x2)) // 2, (int(y1) + int(y2)) // 2)
        break

print('入口节点:', entry)
if not entry:
    print('找不到 R1 入口。当前屏文本:')
    for t, *_ in nodes(xml):
        if t.strip():
            print('   ', t[:70])
    sys.exit(1)

subprocess.run([ADB, 'shell', 'input', 'tap', str(entry[1]), str(entry[2])],
               capture_output=True)
time.sleep(5)

xml2 = dump()
io.open(OUT, 'w', encoding='utf-8').write(xml2)

rows = [(t, int(y2) - int(y1), int(x2) - int(x1)) for t, x1, y1, x2, y2 in nodes(xml2)]
print('')
print('R1 屏元素（h=高度 w=宽度）:')
for t, h, w in rows:
    if t.strip():
        print('   h=%-4d w=%-4d  %s' % (h, w, t[:64]))

print('')
print('--- 行数推断（同字号下，单行高度作基准）---')
for t, h, w in rows:
    if t.strip():
        print('   h=%-4d  %s' % (h, t[:40]))
