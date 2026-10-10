#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FINAL_OPTIMIZED_SOLUTION.py — 3D-BPP 自主迭代优化 · 最终方案归档清单
====================================================================

任务：对项目【3D 复杂空间装箱算法（3D-BPP）】及【货物数据录入/预处理模块】
      进行无人值守自主迭代优化（沙盒：optimizer_sandbox/）。

退出判定：条件 B（熔断）——
  1) Patience：31 次连续突变未刷新利用率最高纪录（提升幅度均 < 0.05pp）；
  2) 数学天花板证明：基准测试集利用率为「输入体积受限」，
     核心 26 case 天花板 = 20.464%，最终达成 20.371%（= 天花板的 99.5%）；
     全语料 114 case 天花板 = 10.47%，最终达成 10.283%（98.2%），
     剩余缺口集中于 3 个 case，且经逐例分析为物理约束阻塞
     （易碎不可承载 + 批次 LIFO 地板耗尽 + 20GP 短柜），非算法可回收。
  → 条件 A 的「+10% 相对提升」（19.603% × 1.10 = 21.563%）数学不可达。

最终成果（realistic4d-multi-strategy 默认生产链路，种子 42）：
  ┌──────────────────────────┬───────────────┬─────────────────┐
  │ 指标                      │ 基线 best_v0   │ 最终 best_v7     │
  ├──────────────────────────┼───────────────┼─────────────────┤
  │ 核心套件综合利用率         │ 19.603%       │ 20.371% (+3.9%) │
  │ 核心套件平均求解耗时       │ 132.1 ms      │ 22.8 ms (−83%)  │
  │ 全语料综合利用率 (114 case)│ 10.361%       │ 10.283% (合规*) │
  │ 全语料平均求解耗时         │ 235.0 ms      │ 29.3 ms (−88%)  │
  │ 独立检查器违规 (核心/全)    │ 97 / 2495     │ 0 / 0           │
  │ PlanValidator 硬违规(核心/全)│ 1049 / 5975 │ 0 / 0           │
  │ 横向重心偏移 A / B         │ — / 10.01%    │ 0.09% / 7.80%   │
  │ 确定性（同种子双跑布局一致）│ ✓             │ ✓               │
  └──────────────────────────┴───────────────┴─────────────────┘
  * 基线全语料利用率 10.361% 依赖 2495 项物理违规（易碎承载/超层堆叠/LIFO 反向）
    换来的超额装载；合规等价装载量下最终方案更高（3225 件 vs 基线合法子集）。

本文件为归档清单与验证脚本。最优代码副本（原样可运行）位于：
  checkpoints/FINAL_OPTIMIZED_SOLUTION/
    - AlgorithmOrchestrator.js      （有效性优先候选组合 + 满载早退 + 内部合规闸）
    - FastBlockPackingEngine.js     （截面列构建 + 港级槽位模板 + 平衡寻优 + 稳定性反应式修复）
    - Realistic4DPackingEngine.js   （LIFO 翻转 + canRotate 门 + 物品级支撑防护 + colCap）
    - PlanValidator.js / PlanMetrics.js / SupportGeometry.js / InsertionPathFeasibility.js

运行方式：将上述文件覆盖镜像至沙盒 backend/ 对应路径后执行
  node harness/run_benchmark.js --suite core --algorithms realistic4d-multi-strategy
"""

import json
import os
import sys
import hashlib

SANDBOX = os.path.dirname(os.path.abspath(__file__))
FINAL_FILES = [
    "checkpoints/FINAL_OPTIMIZED_SOLUTION/AlgorithmOrchestrator.js",
    "checkpoints/FINAL_OPTIMIZED_SOLUTION/FastBlockPackingEngine.js",
    "checkpoints/FINAL_OPTIMIZED_SOLUTION/Realistic4DPackingEngine.js",
    "checkpoints/FINAL_OPTIMIZED_SOLUTION/PlanValidator.js",
    "checkpoints/FINAL_OPTIMIZED_SOLUTION/PlanMetrics.js",
    "checkpoints/FINAL_OPTIMIZED_SOLUTION/SupportGeometry.js",
    "checkpoints/FINAL_OPTIMIZED_SOLUTION/InsertionPathFeasibility.js",
    "mutation_failures.log",
    "FINAL_REPORT.md",
    "evolution_log.json",
]

FINAL_METRICS = {
    "core_suite": {"cases": 26, "aggregate_util": 20.371, "ceiling": 20.464,
                   "avg_ms": 22.8, "violations": 0, "validator_hard": 0, "loaded": 831},
    "full_suite": {"cases": 114, "aggregate_util": 10.283, "ceiling": 10.47,
                   "avg_ms": 29.3, "violations": 0, "validator_hard": 0, "loaded": 3225},
    "determinism": True,
    "exit_condition": "B (patience=31 consecutive non-improving mutations + input-bound ceiling proof)",
}


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    print("=" * 70)
    print("FINAL_OPTIMIZED_SOLUTION · 归档验证")
    print("=" * 70)
    ok = True
    for rel in FINAL_FILES:
        path = os.path.join(SANDBOX, rel)
        if not os.path.exists(path):
            print(f"  [缺失] {rel}")
            ok = False
            continue
        size = os.path.getsize(path)
        tag = "" if size > 0 else "  (空文件!)"
        print(f"  [OK] {rel}  ({size:,} bytes{tag}  sha256={sha256(path)[:16]}…)")
        if size == 0:
            ok = False

    log_path = os.path.join(SANDBOX, "evolution_log.json")
    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8") as f:
            log = json.load(f)
        print("-" * 70)
        print(f"迭代日志：{len(log.get('iterations', []))} 次已记录迭代；"
              f"最终最优 = {log.get('best', {}).get('version')}")
        for it in log.get("iterations", []):
            print(f"  [Iter {it['n']}] {it['status']:<8} util={it.get('aggregateUtil')}% "
                  f"violations={it.get('violations')} — {it.get('strategy', '')[:60]}…")

    print("-" * 70)
    print("最终指标：")
    for suite, m in FINAL_METRICS.items():
        if isinstance(m, dict):
            print(f"  {suite}: " + ", ".join(f"{k}={v}" for k, v in m.items()))
    print("=" * 70)
    print("验证结果：" + ("通过 —— 归档完整" if ok else "失败 —— 存在缺失文件"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
