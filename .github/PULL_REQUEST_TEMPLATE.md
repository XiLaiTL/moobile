## 改了什么

<!-- 一两句话。如果是修 bug，写清"原来的行为 → 现在的行为"。 -->

## 验证（必填：贴命令与结果）

```bash
bash tools/verify_all.sh              # 离线 6 项
bash tools/verify_all.sh --with-e2e   # Web 端到端（改了渲染/本地库/同步链路才需要）
python3 tools/verify_android.py       # 真机（改了原生侧才需要）
```

<!-- 把通过/失败的行贴上来。没跑的项写"未跑 + 原因"，不要留空。 -->

## 检查清单

- [ ] 动了 `vendor/rabbita/**` 的话，已经 `tools/vendor_sync.sh --capture` 并 `--check` 通过
- [ ] 文档/注释里的结论都有对应的命令或输出（没有证据的写"未实测"）
- [ ] 新踩的坑已补进 `docs/FINDINGS.md`（带真因与解法）
- [ ] 改了公开 API / 契约版本 → 已在 `CHANGELOG.md` 记录，并说明是否破坏性
- [ ] 发版相关改动：看过 `moon package --list` 的清单
