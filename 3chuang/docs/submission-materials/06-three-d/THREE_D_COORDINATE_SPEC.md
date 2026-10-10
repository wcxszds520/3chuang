# 3D 坐标系规格 (THREE_D_COORDINATE_SPEC)

> 生成时间：2026-07-11
> 调查基线：分支 `codex/sol`，HEAD `ef47171694c44feb086d4875a95732f79ed229f9`
> 代码位置：[web-dashboard/src/three/operation/geometry.js](../../web-dashboard/src/three/operation/geometry.js) 与 [web-dashboard/src/three/operation/operationMachine.js](../../web-dashboard/src/three/operation/operationMachine.js)

---

## 1. 坐标轴定义（VERIFIED）

| 轴 | 含义 | 范围 | 说明 |
|---|---|---|---|
| X | 长度 | 0 → innerLength | 门端 doorPlaneX = length（高 X 端），柜尾在 X=0 |
| Y | 高度 | 0 → innerHeight | 地面 Y=0（重力轴），顶部 Y=innerHeight |
| Z | 宽度 | 0 → innerWidth | 左侧 Z=0，右侧 Z=innerWidth |

### 1.1 单位

- 算法层：毫米（mm）
- 渲染层：米（m），渲染时乘 0.001

### 1.2 柜型尺寸

| 柜型 | innerLength (mm) | innerWidth (mm) | innerHeight (mm) |
|---|---|---|---|
| 20GP | 5898 | 2352 | 2393 |
| 40GP | 12032 | 2352 | 2393 |
| 40HQ | 12032 | 2352 | 2698 |

### 1.3 坐标系示意图

```
            Y (高度)
            ↑
            │  地面 Y=0
            │
            ├───────────── X (长度)
           /│  ← 柜尾 X=0    门端 X=innerLength (doorPlaneX)
          / │
         /  │
        Z (宽度)
        Z=0 (左侧) → Z=innerWidth (右侧)
```

---

## 2. 门端定义

### 2.1 doorPlaneX

```
doorPlaneX = length  // 门端在高 X 端
```

- 门端位于 X = innerLength（高 X 端）
- 柜尾位于 X = 0（低 X 端）
- 叉车从门端（高 X）进入集装箱

### 2.2 doorCount

- doorCount = 2（左右双开门）
- 代码位置：[web-dashboard/src/three/scene/createIndustrialContainer.js](../../web-dashboard/src/three/scene/createIndustrialContainer.js)

---

## 3. 间隙规格

### 3.1 DEFAULT_CLEARANCE（VERIFIED）

```
DEFAULT_CLEARANCE = {
  side: 30,       // 侧向间隙 mm
  top: 35,        // 顶部间隙 mm
  bottom: 5,      // 底部间隙 mm
  collision: 2    // 碰撞容差 mm
}
```

| 间隙 | 值 (mm) | 用途 |
|---|---|---|
| side | 30 | 货物与侧墙的最小距离 |
| top | 35 | 货物与顶板的最小距离 |
| bottom | 5 | 货物与地板的最小距离 |
| collision | 2 | AABB 碰撞检测容差 |

### 3.2 doorOpening（VERIFIED）

```
doorOpening = {
  minY: 5,                // 门洞下沿 Y
  maxY: height - 35,      // 门洞上沿 Y
  minZ: 30,               // 门洞左沿 Z
  maxZ: width - 30        // 门洞右沿 Z
}
```

| 边界 | 公式 | 说明 |
|---|---|---|
| minY | 5 | 门洞下沿（留底部 5mm） |
| maxY | height - 35 | 门洞上沿（留顶部 35mm） |
| minZ | 30 | 门洞左沿（留侧向 30mm） |
| maxZ | width - 30 | 门洞右沿（留侧向 30mm） |

> 货物通过门洞时，其 AABB 必须在 doorOpening 范围内。

---

## 4. 等待区

### 4.1 waitingZone（VERIFIED）

```
waitingZone = {
  minX: length + 2200,    // 等待区起始 X（门端外 2200mm）
  maxX: length + 6200     // 等待区结束 X（门端外 6200mm）
}
```

- 等待区位于门端外（高 X 方向延伸）
- 范围：length+2200 ~ length+6200（共 4000mm 纵深）
- 货物在等待区被叉车取走

---

## 5. 路径段定义

### 5.1 路径 9 段（VERIFIED）

| 段 | 名称 | 坐标说明 |
|---|---|---|
| 1 | home | 叉车初始位置（waitingZone 内） |
| 2 | waiting | 等待区货物位置 |
| 3 | waitingLifted | 等待区抬升后位置（货物 + 目标层高 Y） |
| 4 | staging | 门前对准区（doorPlaneX 附近） |
| 5 | doorApproach | 门洞接近（doorOpening 入口） |
| 6 | doorInside | 门洞内侧（进入箱内） |
| 7 | insideAligned | 箱内对准（目标 Z 坐标） |
| 8 | targetHover | 目标悬停（目标 X/Y/Z 上方） |
| 9 | target | 目标位置（最终放置点） |

### 5.2 路径构建

代码位置：[web-dashboard/src/three/operation/geometry.js](../../web-dashboard/src/three/operation/geometry.js)

`buildCargoPath(cargo, container, options)`：

1. 从 loadedCargo 获取货物的目标坐标 (x, y, z)
2. 根据 doorPlaneX 计算门端入口
3. 根据 doorOpening 计算门洞范围
4. 根据 waitingZone 计算起点
5. 串联 9 段路径点

### 5.3 路径示例（40HQ）

假设货物目标坐标 (3000, 1000, 500)：

```
home:          (15232, 0, 1176)      // 等待区中部
waiting:       (14232, 0, 500)       // 货物在等待区
waitingLifted: (14232, 1000, 500)    // 抬升到目标层
staging:       (12032, 1000, 500)    // 门前
doorApproach:  (12032, 1000, 500)    // 门洞入口
doorInside:    (11500, 1000, 500)    // 进入箱内
insideAligned: (3000, 1000, 500)     // 对准目标 Z
targetHover:   (3000, 1000, 500)     // 目标上方
target:        (3000, 1000, 500)     // 放置
```

---

## 6. 碰撞检测

### 6.1 AABB 分离轴定理（VERIFIED）

代码位置：[web-dashboard/src/three/operation/geometry.js](../../web-dashboard/src/three/operation/geometry.js)

```
FUNCTION aabbIntersects(a, b, tolerance)
    RETURN (a.x < b.x + b.l + tolerance AND
            a.x + a.l + tolerance > b.x AND
            a.y < b.y + b.h + tolerance AND
            a.y + a.h + tolerance > b.y AND
            a.z < b.z + b.w + tolerance AND
            a.z + a.w + tolerance > b.z)
END FUNCTION
```

- tolerance = 2mm（DEFAULT_CLEARANCE.collision）
- 两个 AABB 在三轴上都有重叠才算碰撞

### 6.2 validateCargoPath（VERIFIED）

```
FUNCTION validateCargoPath(path, container, placedCargo)
    samples = samplePolyline(path, step=100mm)

    FOR EACH point IN samples
        // 检查前壁碰撞
        IF point.x < 0 + clearance.bottom THEN RETURN INVALID
        // 检查地板碰撞
        IF point.y < 0 + clearance.bottom THEN RETURN INVALID
        // 检查顶板碰撞
        IF point.y + cargo.h > height - clearance.top THEN RETURN INVALID
        // 检查侧壁碰撞
        IF point.z < 0 + clearance.side THEN RETURN INVALID
        IF point.z + cargo.w > width - clearance.side THEN RETURN INVALID
        // 检查门框碰撞（仅在门端附近）
        IF point.x > doorPlaneX - threshold
            IF NOT inDoorOpening(point, doorOpening) THEN RETURN INVALID
        END IF
        // 检查已装货物碰撞
        FOR EACH placed IN placedCargo
            IF aabbIntersects(point, placed, clearance.collision) THEN RETURN INVALID
        END FOR
    END FOR

    RETURN VALID
END FUNCTION
```

### 6.3 采样步长

- step = 100mm
- 路径长度 / 100 = 采样点数
- 越长的路径采样点越多，校验越精确

---

## 7. 坐标转换

### 7.1 算法坐标 → 渲染坐标

```
renderX = algorithmX * 0.001  // mm → m
renderY = algorithmY * 0.001
renderZ = algorithmZ * 0.001
```

### 7.2 渲染坐标 → 算法坐标

```
algorithmX = renderX * 1000  // m → mm
algorithmY = renderY * 1000
algorithmZ = renderZ * 1000
```

### 7.3 坐标系对齐

- 算法坐标系与渲染坐标系方向一致
- 仅单位不同（mm vs m）
- 无坐标轴翻转

---

## 8. 相机坐标系

### 8.1 相机预设（VERIFIED）

代码位置：[web-dashboard/src/three/presentation/cameraPresets.js](../../web-dashboard/src/three/presentation/cameraPresets.js)

| 预设 | 视角 | 说明 |
|---|---|---|
| overview | 总览 | 俯瞰全局，能看到集装箱+等待区+工地 |
| door | 门端 | 从门端看向箱内 |
| top | 俯视 | 正上方俯视 |
| side | 侧视 | 侧面平视 |

### 8.2 computeCameraFrame

- 自动构图：根据目标 AABB 计算相机位置
- follow 模式：跟随叉车/货物运动

代码位置：[web-dashboard/src/three/cameraFrame.test.js](../../web-dashboard/src/three/cameraFrame.test.js)

---

## 9. 标签坐标系

### 9.1 标签布局（VERIFIED）

代码位置：[web-dashboard/src/three/presentation/labelLayout.js](../../web-dashboard/src/three/presentation/labelLayout.js)

- layoutProjectedLabels：将 3D 坐标投影到 2D 屏幕
- 6 环候选偏移：标签重叠时，在 6 个方向（上/下/左/右/左上/右下）寻找无重叠位置

### 9.2 标签锚点

- 标签锚点 = 货物中心顶部
- 投影后偏移到无重叠位置
- 保持与货物的视觉关联（引线）

---

## 10. 叉车坐标

### 10.1 叉车位置

- 叉车位置由路径段决定
- 在 home/waiting 段：位于 waitingZone
- 在 staging/doorApproach 段：位于门端附近
- 在 doorInside/insideAligned/targetHover/target 段：位于箱内

### 10.2 货叉位置

- 货叉高度 = 当前路径段的 Y 坐标
- 货叉长度：固定（createIndustrialForklift.js 定义）
- 货叉间距：固定

### 10.3 workerPoseFromForklift（VERIFIED）

```
工人位置 = 叉车位置 - 380mm（X 偏移）
gait = sin(progress * 4π)  // 行走步态
```

- 工人跟随叉车，位于叉车后方 380mm
- 步态动画基于进度（progress 0→1 对应一个步态周期）

---

## 11. 几何工具函数

代码位置：[web-dashboard/src/three/operation/geometry.js](../../web-dashboard/src/three/operation/geometry.js)

### 11.1 关键函数

| 函数 | 用途 |
|---|---|
| `buildCargoPath(cargo, container, options)` | 构建 9 段路径 |
| `lerpPoint(a, b, t)` | 线性插值两点 |
| `pointAlongPolyline(path, distance)` | 沿 polyline 取点 |
| `validateCargoPath(path, container, placedCargo)` | 路径碰撞校验 |
| `aabbIntersects(a, b, tolerance)` | AABB 碰撞检测 |

### 11.2 测试

代码位置：[web-dashboard/src/three/operation/geometry.test.js](../../web-dashboard/src/three/operation/geometry.test.js)

---

## 12. 坐标系边界声明

- 坐标系与算法层一致，仅单位不同（mm vs m）
- 门端在高 X 是生产链路统一约定（FastBlock + 前端 3D）
- Realistic4DPackingEngine 头注释中"柜门(X=0)"的说法已废弃，以本文件为准
- 渲染乘 0.001 是约定，不可配置
- DEFAULT_CLEARANCE 与 doorOpening 是默认值，未来可能可配置
