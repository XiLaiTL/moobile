# Android 端到端断言（Todo 应用）—— 覆盖 ⑦「新增 / 完成 / 删除 / 离线落库 / 同步」全链路。
#
#   python3 tools/verify_android.py
#
# 前置：
#   1. 模拟器已启动（AVD `moobile64`，x86_64 —— APK 只打 x86_64，32 位镜像会
#      `INSTALL_FAILED_NO_MATCHING_ABIS`）；
#   2. Metro 在 8081（脚本自己 `adb reverse`）；
#   3. 后端在跑（`examples/services/todo-server/` 的 exe）；模拟器用 10.0.2.2 访问宿主机；
#   4. APK 已装好（`adb install -r examples/apps/todo-app/host/android/app/build/outputs/apk/debug/app-debug.apk`）。
#
# 为什么用 `uiautomator dump` 而不是截图：dump 给的是**原生 View 的文本与坐标**，
# 可以逐项断言，也不依赖 GPU —— 无头模拟器上照样能量。
#
# 脚本**自己把状态清成确定的**（清 app 数据 + 重置服务器为 2 条），所以可以反复跑。
#
# 两处被工具咬过的经验（详见 docs/FINDINGS.md 的 R2）：
#   · `uiautomator dump` 失败时**不会**清掉上一次的 xml → 一定要先 rm，并检查它报了成功；
#   · 界面一直在重绘（订阅心跳）会让它等不到 idle → 心跳间隔定成 5 秒。
#   · `pm clear` 会连 dev bundle 缓存一起清掉 → 冷启动要**轮询**等界面，固定 sleep 不够。

import sys as _sys

# ⚠️ Windows 上 Python 的输出编码默认跟随 locale（GBK）。本脚本会打印中文，
#    一旦输出被**重定向到文件**（CI、`verify_all.sh` 的 `run()` 都是这样），
#    非 GBK 字符（比如 ✓）会直接抛 UnicodeEncodeError —— 表现是"检查失败"，
#    而同样一条命令直接跑却是通过的（实测踩到过）。
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    _sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import os
import re
import subprocess
import sys
import time
import urllib.request
import json

ADB = os.environ.get(
    'ADB',
    r'C:\Users\XiLaiTL\AppData\Local\Android\Sdk\platform-tools\adb.exe',
)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'evidence', 'r1', 'android_todo_ui.xml')
API = 'http://127.0.0.1:8787'
PKG = 'com.anonymous.host'

SEED = ['服务器下发的第一条', '服务器下发的第二条']

results = []


def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('PASS  ' if ok else 'FAIL  ') + name + (('  <- ' + str(detail)) if detail else ''))


def adb(*args):
    return subprocess.run([ADB] + list(args), capture_output=True)


def dump():
    # ⚠️ 先删旧的：`uiautomator dump` 失败时**不会**清掉上一次的文件，
    #    直接 cat 会读到**陈旧的 UI**，然后给出一堆莫名其妙的结论（踩过）。
    adb('shell', 'rm', '-f', '/data/local/tmp/ui.xml')
    r = adb('shell', 'uiautomator', 'dump', '/data/local/tmp/ui.xml')
    out = (r.stdout + r.stderr).decode('utf-8', 'replace')
    if 'dumped to' not in out and 'UI hierchary' not in out:
        raise SystemExit('uiautomator dump 失败：' + out.strip()[:200])
    return adb('shell', 'cat', '/data/local/tmp/ui.xml').stdout.decode('utf-8', 'replace')


NODE_RE = re.compile(r'<node[^>]*?>')
ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')
BOUNDS_RE = re.compile(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]')


def parse(xml):
    """把 dump 变成节点字典列表（class / text / clickable / 坐标）。"""
    out = []
    for m in NODE_RE.finditer(xml):
        a = dict(ATTR_RE.findall(m.group(0)))
        b = BOUNDS_RE.match(a.get('bounds', ''))
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        out.append(
            {
                'cls': a.get('class', ''),
                'text': a.get('text', ''),
                'clickable': a.get('clickable') == 'true',
                'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                'cx': (x1 + x2) // 2, 'cy': (y1 + y2) // 2,
            }
        )
    return out


def texts(xml):
    return [n['text'] for n in parse(xml) if n['text'].strip()]


def center(xml, needle):
    for n in parse(xml):
        if needle in n['text']:
            return n['cx'], n['cy']
    return None


def total(xml):
    for t in texts(xml):
        m = re.search(r'共\s*(\d+)\s*项', t)
        if m:
            return int(m.group(1))
    return None


def counts(xml):
    """页脚的 (未完成, 总数)。"""
    for t in texts(xml):
        m = re.search(r'(\d+)\s*项未完成\s*·\s*共\s*(\d+)\s*项', t)
        if m:
            return int(m.group(1)), int(m.group(2))
    return None, None


def items(xml):
    """清单里每一行：(文本, 勾选框坐标, ✕ 坐标)。

    识别方式：**以 ✕ 为锚点**（每行恰好一个），然后在同一 y 上取**最左**的文本节点
    作为条目文本 —— 因为行内还有「改」这样的按钮标签，靠"第一个文本节点"会认错
    （实测把条目标成了「改」）。勾选框在 RN 里是**无文本的可点 ViewGroup**
    （未完成时连 ✓ 都没有），只能按位置取：同行、且在条目文本左边。
    """
    nx = parse(xml)
    rows = []
    for cross in [n for n in nx if n['text'].strip() == '✕']:
        cands = [
            n for n in nx
            if n['text'].strip() and n['text'].strip() != '✕'
            and abs(n['cy'] - cross['cy']) <= 30
        ]
        if not cands:
            continue
        label = min(cands, key=lambda n: n['x1'])
        box = min(
            (
                c for c in nx
                if c['clickable'] and not c['text'].strip()
                and abs(c['cy'] - cross['cy']) <= 30 and c['x1'] < label['x1']
            ),
            key=lambda c: c['x1'],
            default=None,
        )
        if box:
            rows.append({
                'text': label['text'].strip(),
                'box': (box['cx'], box['cy']),
                'cross': (cross['cx'], cross['cy']),
            })
    return rows


def tap(x, y):
    adb('shell', 'input', 'tap', str(x), str(y))
    time.sleep(1.5)


def api(path, method='GET', body=None):
    req = urllib.request.Request(API + path, method=method)
    if body is not None:
        req.add_header('Content-Type', 'application/json')
        req.data = json.dumps(body).encode('utf-8')
    with urllib.request.urlopen(req, timeout=10) as r:
        raw = r.read().decode('utf-8')
    return json.loads(raw) if raw.strip() else None


def srv_item(text):
    for t in api('/todos'):
        if t['text'] == text:
            return t
    return None


def reset_server():
    for t in api('/todos'):
        api('/todos/%d' % t['id'], method='DELETE')
    for s in SEED:
        api('/todos', method='POST', body={'text': s})
    return api('/todos')


def dump_or_none():
    try:
        return dump()
    except SystemExit:
        return None


def app_pid():
    return adb('shell', 'pidof', PKG).stdout.decode().strip()


def wait_for_app(timeout=240):
    """等界面真的出现 —— 不在就**再拉起来**。

    两个被咬过的地方：
    · `pm clear` 会把 dev bundle 的缓存一起清掉，冷启动要先从 Metro 下 3MB 的包
      （实测 20s+，加首帧更久）→ 固定 sleep 不够，得轮询；
    · dev 客户端**偶发**在拉 bundle 的过程中整个进程消失（本轮实测撞到两次），
      脚本必须能自己重启它，否则整轮验证白跑。
    """
    t0 = time.time()
    last_relaunch = 0.0
    while time.time() - t0 < timeout:
        xml = dump_or_none()
        if xml and any(t == 'moobile' for t in texts(xml)):
            return xml
        now = time.time()
        if not app_pid() and now - last_relaunch > 20:
            print('      app 进程不在了，重新拉起…')
            launch()
            last_relaunch = now
        time.sleep(3)
    return None


def launch():
    adb('shell', 'am', 'force-stop', PKG)
    adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1')


def finish():
    passed = sum(1 for _, ok, _ in results if ok)
    print('\n================ 汇总 ================')
    print(f'通过 {passed} / {len(results)}')
    sys.exit(0 if passed == len(results) else 1)


def sync_now(xml):
    """点一次「同步」并等它落定。"""
    pt = center(xml, '同步')
    if not pt:
        return None
    tap(*pt)
    time.sleep(7)
    return dump_or_none()


def main():
    dev = adb('devices').stdout.decode()
    check('模拟器在线', 'device' in dev and 'offline' not in dev)
    check(
        '模拟器是 x86_64（APK 只打这个 ABI）',
        adb('shell', 'getprop', 'ro.product.cpu.abi').stdout.decode().strip().startswith('x86_64'),
    )

    # ---------- 把状态清成确定的 ----------
    srv = reset_server()
    check('服务器已重置为 2 条', len(srv) == 2, ','.join(t['text'] for t in srv))
    adb('shell', 'pm', 'clear', PKG)  # 清掉 app 数据 = 清掉本地 SQLite
    adb('reverse', 'tcp:8081', 'tcp:8081')
    adb('reverse', 'tcp:8787', 'tcp:8787')
    launch()

    xml = wait_for_app()
    if xml is None:
        check('app 在 150 秒内起来了', False, '拿不到含标题的 UI dump')
        finish()
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(xml)
    cur = texts(xml)
    print('      当前屏文本: ' + ' | '.join(cur))

    check('app 已在真机上渲染（能 dump 到文本）', len(cur) > 0, f'{len(cur)} 个文本节点')
    check('标题渲染出来了', any(t == 'moobile' for t in cur))
    check(
        '清单来自原生 SQLite（expo-sqlite 的 AAR 跑起来了）',
        any('expo-sqlite' in t for t in cur),
        ' / '.join([t for t in cur if '本地库' in t][:2]),
    )
    check('清数据后本地库重新播种（共 3 项）', total(xml) == 3,
          ' / '.join([t for t in cur if '共' in t][:2]))

    # ---------- 订阅（Sub）在真机上也在跑 ----------
    beat1 = None
    for t in cur:
        m = re.search(r'心跳\s*(\d+)', t)
        if m:
            beat1 = int(m.group(1))
    time.sleep(12)  # 心跳 5 秒一跳
    beat2 = None
    for t in texts(dump()):
        m = re.search(r'心跳\s*(\d+)', t)
        if m:
            beat2 = int(m.group(1))
    check(
        '订阅（Sub）在真机上也在跑：心跳计数自动增长',
        beat1 is not None and beat2 is not None and beat2 >= beat1 + 2,
        f'心跳 {beat1} -> {beat2}',
    )

    # ---------- 同步（拉取合并，服务器为准）----------
    xml = sync_now(xml) or xml
    check('同步状态变成「已与服务器同步」',
          any('已与服务器同步' in t for t in texts(xml)),
          ' / '.join([t for t in texts(xml) if '服务器' in t][:2]))
    check('服务器下发的两条进了真机本地库',
          all(any(s in t for t in texts(xml)) for s in SEED),
          ' / '.join(t for t in texts(xml) if '服务器' in t))
    check('拉取合并后界面条数 == 服务器条数（服务器为准清掉本地种子）',
          total(xml) == 2, f'界面={total(xml)} 服务器={len(api("/todos"))}')

    # ---------- 新增：先落本地库，再推服务器 ----------
    boxes = [n for n in parse(xml) if n['cls'] == 'android.widget.EditText']
    if not boxes:
        check('找到输入框（EditText）', False)
        finish()
    tap(boxes[0]['cx'], boxes[0]['cy'])
    # ⚠️ `adb shell input text` 会吞字符（实测 'android-local-add' → 'andr-ldd'），
    #    所以**不断言输入文本**，只断言"多了一条、且先只落在本地"。
    adb('shell', 'input', 'text', 'localadd')
    time.sleep(1.2)
    xml = dump()
    addpt = center(xml, '添加')
    if not addpt:
        check('找到「添加」按钮', False)
        finish()
    tap(*addpt)
    time.sleep(3)
    srv_now = api('/todos')
    ui_now = total(dump())
    check('新增先落在本地库，服务器还没变（离线优先）',
          len(srv_now) == 2 and ui_now == 3, f'服务器={len(srv_now)} 界面={ui_now}')

    xml = sync_now(dump()) or dump()
    srv_after = api('/todos')
    new_items = [t for t in srv_after if t['text'] not in set(SEED)]
    check('再同步后服务器多了一条（POST 推上去了）',
          len(srv_after) == 3 and len(new_items) == 1 and new_items[0]['text'] != '',
          f'服务器 {len(srv_after)} 条: ' + ','.join(t['text'][:16] for t in srv_after))
    check('界面重新与服务器一致', total(xml) == len(srv_after),
          f'界面={total(xml)} 服务器={len(srv_after)}')

    # ---------- 完成（勾选）：先落本地库，再推服务器 ----------
    rows = items(dump())
    if len(rows) < 2:
        check('能定位到清单里的一行（勾选框 / ✕）', False, f'识别到 {len(rows)} 行')
        finish()
    target = rows[0]
    rem0, tot0 = counts(dump())
    tap(*target['box'])
    time.sleep(2)
    xml = dump()
    rem1, tot1 = counts(xml)
    check(
        '勾选「完成」在真机上生效（未完成数 -1，总数不变）',
        (rem0, tot0) == (rem1 + 1, tot1),
        f'未完成 {rem0}->{rem1}，共 {tot0}->{tot1}',
    )
    srv_before_toggle = srv_item(target['text'])
    check(
        '勾选先只落在本地库（服务器上还是未完成）',
        srv_before_toggle is not None and srv_before_toggle['done'] is False,
        f"服务器 done={None if srv_before_toggle is None else srv_before_toggle['done']}",
    )
    xml = sync_now(xml) or xml
    srv_after_toggle = srv_item(target['text'])
    check(
        '同步后服务器上这条变成已完成（PATCH 推上去了）',
        srv_after_toggle is not None and srv_after_toggle['done'] is True,
        f"「{target['text'][:16]}」服务器 done={None if srv_after_toggle is None else srv_after_toggle['done']}",
    )

    # ---------- 删除（✕）：墓碑 → 推 DELETE ----------
    rows = items(dump())
    victim = rows[-1]
    tot_before = total(dump())
    srv_before_del = len(api('/todos'))
    tap(*victim['cross'])
    time.sleep(2)
    xml = dump()
    check(
        '删除在真机上生效（条数 -1）',
        total(xml) == tot_before - 1,
        f'共 {tot_before} -> {total(xml)}（删的是「{victim["text"][:16]}」）',
    )
    check(
        '删除先只落在本地库（服务器还有那条）',
        srv_item(victim['text']) is not None and len(api('/todos')) == srv_before_del,
        f'服务器 {len(api("/todos"))} 条',
    )
    xml = sync_now(xml) or xml
    check(
        '同步后服务器上那条也没了（墓碑推出 DELETE）',
        srv_item(victim['text']) is None and len(api('/todos')) == srv_before_del - 1,
        f'服务器 {len(api("/todos"))} 条: ' + ','.join(t['text'][:12] for t in api('/todos')),
    )
    check('界面与服务器最终一致', total(dump()) == len(api('/todos')),
          f'界面={total(dump())} 服务器={len(api("/todos"))}')
    finish()


main()
