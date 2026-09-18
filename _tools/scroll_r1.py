# Scroll the R1 screen on the emulator and dump measurements.
# Output goes to a UTF-8 file (the Windows console is GBK and chokes on CJK).
import io
import os
import re
import subprocess
import time

ADB = r'C:\Users\XiLaiTL\AppData\Local\Android\Sdk\platform-tools\adb.exe'
# 输出路径从脚本位置推导（脚本在 <模块根>/_tools/ 下），不写死盘符。
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_r1', 'android_scroll_report.md')


def sh(*args):
    return subprocess.run([ADB] + list(args), capture_output=True).stdout.decode('utf-8', 'replace')


def dump():
    sh('shell', 'uiautomator', 'dump', '/data/local/tmp/ui.xml')
    return sh('shell', 'cat', '/data/local/tmp/ui.xml')


def rows(xml):
    out = []
    for n in re.findall(r'<node[^>]*>', xml):
        t = re.search(r'text="([^"]*)"', n)
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if t and b and t.group(1).strip():
            x1, y1, x2, y2 = map(int, b.groups())
            out.append((t.group(1), x1, y1, x2, y2, y2 - y1, x2 - x1))
    return out


L = []
for i, swipe in enumerate([300, 300, 300]):
    # scroll up (content moves up) by ~250dp = ~690px
    sh('shell', 'input', 'swipe', '536', '1400', '536', '700', '300')
    time.sleep(2.5)
    xml = dump()
    L.append('## 滚动第 %d 次后' % (i + 1))
    L.append('')
    L.append('| text | top | h(px) | h(dp) | w(dp) |')
    L.append('|---|---|---|---|---|')
    for t, x1, y1, x2, y2, h, w in rows(xml):
        L.append('| %s | %d | %d | %.1f | %.1f |' % (t.replace('|', '/')[:70], y1, h, h / 2.75, w / 2.75))
    L.append('')
    io.open(OUT, 'w', encoding='utf-8').write('\n'.join(L))

print('written', OUT)
