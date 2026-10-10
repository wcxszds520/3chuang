# 装箱算法流程图

> 生成时间：2026-07-11
> 文件用途：展示后端装箱算法从输入到输出的完整处理流程，包括排序、切片、填充、重心校验、LIFO 校验等关键环节。
> 说明：实线为已实现的算法步骤；虚线为目标态待补齐的增强能力。

```mermaid
flowchart TD
    IN([输入：货物 SKU 列表 + 柜型尺寸]) --> PARSE[解析 SKU 属性<br/>长宽高 / 重量 / 堆码层数 / 易碎标识]
    PARSE --> SORT[货物排序<br/>按体积/重量/堆码约束排序]
    SORT --> ORCH[AlgorithmOrchestrator 调度器<br/>选择算法策略]

    ORCH --> FB[FastBlock 块优先<br/>生产主力算法]
    ORCH --> R4D[Realistic4D v34.7<br/>四维装柜算法]
    ORCH --> LPE[LayeredPackingEngine<br/>分层装柜引擎<br/>当前利用率 39.06%]

    FB --> SLICE[块切片<br/>按柜内空间分块切分]
    R4D --> SLICE
    LPE --> SLICE

    SLICE --> FILL[空间填充<br/>贪心/回溯填充空隙]
    FILL --> COG[重心校验<br/>计算整体重心是否在安全范围]
    COG --> LIFO[LIFO 校验<br/>后进先出可卸货顺序校验]
    LIFO --> COORD[生成 3D 坐标方案<br/>每件货物 xyz 坐标 + 旋转相位]

    COORD --> OUT([输出：装柜坐标序列<br/>含利用率/重心/LIFO 报告])

    LPE -. 目标态：利用率 ≥70% .-> LPE
    FB -. 目标态：连续三次全装入 .-> FB

    style IN fill:#fff3e0
    style OUT fill:#e8f5e9
    style FB fill:#e3f2fd
```

## 算法节点说明

| 节点 | 实现方式 | 当前态 | 目标态 |
|------|----------|--------|--------|
| AlgorithmOrchestrator | 调度器选择策略 | 已实现 | — |
| FastBlock | 块优先算法 | 生产主力 | 连续三次全装入 |
| Realistic4D v34.7 | 四维装柜算法 | 已实现 | — |
| LayeredPackingEngine | 分层装柜引擎 | 利用率 39.06% | ≥70% |
| 重心校验 | 安全范围计算 | 已实现 | — |
| LIFO 校验 | 可卸货顺序 | 已实现 | — |
| 3D 坐标输出 | xyz + 旋转相位 | 已实现 | — |

## 关键约束

- 演示订单 NB2026-DEMO-01 当前 221/221 件装入，84.51% 利用率，0 件未装货物。
- 目标态要求连续三次 loaded=total, unloaded=0，需扩充数据集与算法验证。
- FastBlock 为生产主力算法，Realistic4D 与 LayeredPackingEngine 为补充策略。
