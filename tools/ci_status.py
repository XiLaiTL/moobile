#!/usr/bin/env python3
"""ci_status.py —— 不用认证读 GitHub Actions 的状态与 annotation。

    python3 .scratch/ci_status.py                 # 最近 3 次运行
    python3 .scratch/ci_status.py <sha|run-id>    # 那一次的步骤 + annotation 全文

## 为什么要这个小工具

公开仓库的 **job log 走 REST API 要认证**（`GET /actions/runs/<id>/logs` → 403），
运行页又是 JS 渲染的、curl 取不到内容。于是"CI 红了"这句话对**任何非账号持有人**
（包括自动化代理）本来是**不可诊断的** —— 只能靠猜。

出路是 **annotation 不需要认证**：
    GET /repos/{owner}/{repo}/check-runs/{id}/annotations

所以 `ci.yml` 里那段"失败时把门名与完整输出打成 annotation"是实现这一点的**另一半**：
一个负责写，这个脚本负责读。两边合起来，"CI 红了"才等于"为什么红"。

⚠️ 终端里中文可能显示成乱码（GBK 控制台）—— 内容本身是 UTF-8，重定向到文件再看即可。
"""

import json
import sys
import urllib.request

REPO = "XiLaiTL/moobile"
API = "https://api.github.com/repos/" + REPO


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def unescape(msg):
    # GitHub 的 workflow command 转义：%25 = %，%0A = 换行
    return msg.replace("%0A", "\n").replace("%25", "%")


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None

    if arg is None:
        runs = get(API + "/actions/runs?per_page=3")["workflow_runs"]
        for r in runs:
            print(f"{r['head_sha'][:7]}  {r['status']:10} {r['conclusion']:9} run={r['id']}  {r['created_at']}")
        return

    # 既接受 sha 前缀，也接受 run id
    if arg.isdigit():
        run = get(f"{API}/actions/runs/{arg}")
    else:
        runs = get(API + "/actions/runs?per_page=20")["workflow_runs"]
        run = next(r for r in runs if r["head_sha"].startswith(arg))
    print(f"run {run['id']}  {run['head_sha'][:7]}  {run['status']} {run['conclusion']}")

    for job in get(f"{API}/actions/runs/{run['id']}/jobs")["jobs"]:
        print(f"\njob {job['name']} -> {job['conclusion']}")
        for s in job.get("steps", []):
            print("   ", (s.get("conclusion") or s.get("status")), "|", s["name"])
        # ⚠️ `jobs` 的响应里**没有** `check_run_id`（用它会静默拿到 None，什么都不打 —— 我第一版就踩了）。
        #    annotation 的读法是按**提交**找 check-run，再按**名字**对上这个 job。
        crs = get(f"{API}/commits/{run['head_sha']}/check-runs")["check_runs"]
        cr = next((c["id"] for c in crs if c["name"] == job["name"]), None)
        if cr is None:
            print(f"    （找不到名为 {job['name']} 的 check-run：{len(crs)} 个候选）")
            continue
        anns = get(f"{API}/check-runs/{cr}/annotations")
        print(f"    annotation: {len(anns)} 条")
        for a in anns:
            title = a.get("title") or ""
            body = unescape(a.get("message") or "")
            if len(body) > 400:
                print(f"\n===== {title}（全文）=====")
                print(body)
                print("===== 全文结束 =====\n")
            else:
                print(f"    [{a.get('annotation_level')}] {title} :: {body}")


if __name__ == "__main__":
    main()
