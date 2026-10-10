/**
 * FastBlockPackingEngine
 *
 * A deterministic SKU/block-first packing engine for large roadshow datasets.
 * It trades fine-grained gap search for predictable speed: same-SKU cargo is
 * packed into compact blocks, then expanded to the flat loadedCargo contract
 * consumed by the existing mini-program and future Web digital-twin viewer.
 */

const packingPolicy = require('../config/packingPolicy');
const { calculateSupport } = require('./packing/SupportGeometry');
const { evaluateInsertionPath } = require('./packing/InsertionPathFeasibility');
const PlanValidator = require('./packing/PlanValidator');

class FastBlockPackingEngine {
  constructor(config = {}) {
    this.config = {
      debugMode: false,
      lateralLimitPercent: 5,
      finalLongitudinalLimitPercent: 10,
      manualTopFillMaxWeightKg: 12,
      manualTopFillMaxHeightMm: 450,
      manualTopFillMaxReachY: 1600,
      overheadClearanceMm: 80,
      crossSectionWallBuilder: true,
      supportRatioMin: packingPolicy.supportRatioMin,
      contactToleranceMm: packingPolicy.contactToleranceMm,
      heavyOnLightRatio: packingPolicy.heavyOnLightRatio,
      supportLoadMultiplier: packingPolicy.supportLoadMultiplier,
      ...config
    };
    this.palette = [
      '#5B8DEF',
      '#00C2A8',
      '#F2994A',
      '#EB5757',
      '#9B51E0',
      '#2D9CDB',
      '#27AE60',
      '#F2C94C',
      '#56CCF2',
      '#BB6BD9'
    ];
  }

  async generatePackingPlan(cargoList, container) {
    const startTime = Date.now();
    this.container = this._normalizeContainer(container);
    this.containerVolume = this.container.innerLength * this.container.innerWidth * this.container.innerHeight;
    this.loadedCargo = [];
    this.unloadedCargo = [];
    this.pendingUnloaded = [];
    this.freeSpaces = [];
    this.totalLoadedVolume = 0;
    this.loadingIndex = 0;
    this.loadedWeight = 0;
    this.weightedX = 0;
    this.weightedZ = 0;
    this.totalInputWeight = 0;
    this.dynamicBalanceRejections = 0;
    this.constraintRejections = [];
    this.supportLoads = new Map();
    this.supportLayers = new Map();
    this.spatialIndex = new Map();
    this.mainBlockIndex = new Map();

    const groups = this._buildGroups(cargoList);
    this.maxPortSequence = Math.max(...groups.map(group => group.cargo.portSequence || 1), 1);
    this.hasMultiplePorts = new Set(groups.map(group => group.cargo.portSequence || 1)).size > 1;
    this.totalInputWeight = groups.reduce(
      (sum, group) => sum + (Number(group.cargo.weight || 0) * group.quantity),
      0
    );

    // [MUTATION iter3] 截面列构建（cross-section column wall-builder）：
    // 同港货物在切片截面内按列组合堆叠，替代「单 SKU 独占整片截面」的旧主阶段。
    if (this.config.crossSectionWallBuilder === false) {
      this._packGroupsSequentialSlices(groups);
    } else {
      this._packGroupsByCrossSectionColumns(groups);
    }

    this._recordTailFreeSpace(this.cursorX, this.maxPortSequence);
    this._fillQueuedCargo();
    this._repairStabilityStacks();
    this._flushPendingUnloaded();
    this._centerLoadedCargoAlongLength();

    return this._buildResult(Date.now() - startTime);
  }

  /**
   * [MUTATION iter3] 截面列构建主阶段。
   * 港序升序处理（LIFO 契约：低 portSequence 必须整体位于更高外坐标 x），
   * 每个港的货物在若干「切片」内按列组合：列内自下而上宽度嵌套（上层 w ≤ 下层 w）、
   * 高度累加不超过柜高；重量/易碎/不可堆叠/最大堆层/支撑率约束全部由
   * _pushLoadedCargo 的通用校验路径把关，拒绝即跳过该候选。
   * @private
   */
  _packGroupsByCrossSectionColumns(groups) {
    this.cursorX = 0;
    const portBatches = new Map();
    for (const group of groups) {
      const seq = group.cargo.portSequence || 1;
      if (!portBatches.has(seq)) portBatches.set(seq, []);
      portBatches.get(seq).push(group);
    }
    const portSequences = [...portBatches.keys()].sort((a, b) => a - b);

    for (const seq of portSequences) {
      const portGroups = portBatches.get(seq);
      // [MUTATION iter3c] 港级 z 槽位模板：首个切片确定列槽位（z + 宽度 + 纵深），
      // 后续切片严格复用同一槽位，保证相邻切片柱面全接触（StabilityAnalyzer
      // 的前后向约束豁免），消除独立细长垛。
      let slotTemplate = null;
      let stallGuard = 0;
      while (this._remainingGroups(portGroups) > 0 && stallGuard <= 10000) {
        let placedInSlice = this._composeCrossSectionSlice(portGroups, seq, slotTemplate);
        // 模板切片停摆（如重心门禁拒绝）时，退回自由规划重试一次
        if (placedInSlice.placed === 0 && slotTemplate) {
          placedInSlice = this._composeCrossSectionSlice(portGroups, seq, null);
        }
        if (placedInSlice.placed === 0) {
          for (const group of portGroups) {
            const remaining = group.quantity - group.nextUnitIndex;
            if (remaining > 0 && !(group._columnSkip > 64)) {
              this._queueQuantityUnloaded(group, remaining, 'INSUFFICIENT_LENGTH');
            } else if (remaining > 0) {
              this._queueQuantityUnloaded(group, remaining, 'CONSTRAINT_REJECTED');
            }
          }
          break;
        }
        if (!slotTemplate && placedInSlice.slots) slotTemplate = placedInSlice.slots;
        this.cursorX += placedInSlice.thickness;
        stallGuard++;
      }
    }
  }

  _remainingGroups(portGroups) {
    return portGroups.reduce((sum, group) => sum + Math.max(0, group.quantity - group.nextUnitIndex), 0);
  }

  /**
   * [MUTATION iter3/3c] 在当前 cursorX 组合一个切片的截面（列构建，计划-后置放）。
   * 有 slotTemplate 时严格按港级槽位（z/宽度/纵深对齐）规划，否则自由规划并居中。
   * 放置采用「按层交错」顺序（基层横跨所有列先放），保持动态重心居中。
   * 返回 { placed, thickness, slots }；placed = 0 表示该游标下无法再组成切片。
   * @private
   */
  _composeCrossSectionSlice(portGroups, seq, slotTemplate) {
    const container = this.container;
    let plan = null;
    let usedTemplate = false;
    if (slotTemplate) {
      plan = this._planIntoSlotTemplate(portGroups, slotTemplate);
      usedTemplate = plan.columns.some(col => col.items.length > 0);
    }
    if (!usedTemplate) {
      plan = this._planCrossSectionColumns(portGroups);
      usedTemplate = false;
    }
    if (!plan.columns.some(col => col.items.length > 0)) {
      return { placed: 0, thickness: 0, slots: null };
    }

    let placedCount = 0;
    let thickness = 0;

    // 按层交错压入：基层横跨所有列（z 向对称）先放，再逐层向上
    const centerZ = container.innerWidth / 2;
    const pushQueue = [];
    plan.columns.forEach((col, colIndex) => {
      col.items.forEach((entry, layerIndex) => {
        pushQueue.push({
          group: entry.group,
          dims: entry.dims,
          layerIndex,
          colIndex,
          colZ: col.z,
          distToCenter: Math.abs(col.z + col.width / 2 - centerZ)
        });
      });
    });
    pushQueue.sort((a, b) => {
      if (a.layerIndex !== b.layerIndex) return a.layerIndex - b.layerIndex;
      return a.distToCenter - b.distToCenter;
    });

    const columnTops = plan.columns.map(() => 0);
    // [MUTATION iter3c] 柱面纵深对齐：整列后移 (sliceThickness − colMaxL)，
    // 使所有柱的深面与切片统一后平面对齐 → 相邻切片柱面零间隙接触
    //（StabilityAnalyzer 前后向约束豁免的前提）。
    const planColMaxL = plan.columns.map(col => col.items.reduce((m, e) => Math.max(m, e.dims.l), 0));
    const sliceThickness = planColMaxL.reduce((m, x) => Math.max(m, x), 0);
    const columnXOffset = planColMaxL.map(colL => sliceThickness - colL);
    for (const entry of pushQueue) {
      const colTop = columnTops[entry.colIndex];
      const ok = this._pushLoadedCargo(entry.group, entry.dims, {
        x: this.cursorX + columnXOffset[entry.colIndex],
        y: colTop,
        z: entry.colZ
      }, { mainBlock: false, spaceKind: 'main-column', spacePortSequence: seq, skipDynamicBalance: true });
      if (ok) {
        placedCount++;
        columnTops[entry.colIndex] = colTop + entry.dims.h;
        thickness = sliceThickness;
      } else {
        // 被拒（重心/承载等）：留空，其上方货物将因支撑不足自然被拒
        entry.group._columnSkip = (entry.group._columnSkip || 0) + 1;
      }
    }
    const columnTopList = [];
    plan.columns.forEach((col, colIndex) => {
      if (columnTops[colIndex] > 0) columnTopList.push({ z: col.z, w: col.width, y: columnTops[colIndex] });
    });

    // 槽位输出（首个切片生成模板；模板切片原样返回模板）
    let slots = null;
    if (!usedTemplate) {
      slots = plan.columns.map((col, colIndex) => {
        const firstDims = col.items.length > 0 ? col.items[0].dims : null;
        return {
          z: col.z,
          width: col.width,
          l: Math.max(planColMaxL[colIndex], 80),
          orient: firstDims ? { l: firstDims.l, w: firstDims.w, h: firstDims.h } : null
        };
      }).filter(slot => slot.width >= 80);
    }

    if (placedCount > 0) {
      const usedLeftEdge = Math.min(...plan.columns.filter(c => columnTops[plan.columns.indexOf(c)] > 0).map(c => c.z));
      const usedRightEdge = Math.max(...columnTopList.map(t => t.z + t.w));
      if (container.innerWidth - usedRightEdge >= 80) {
        this._addFreeSpace({
          kind: 'side-right',
          x: this.cursorX,
          y: 0,
          z: usedRightEdge,
          l: Math.max(thickness, 80),
          h: container.innerHeight,
          w: container.innerWidth - usedRightEdge,
          portSequence: seq
        });
      }
      if (usedLeftEdge >= 80) {
        this._addFreeSpace({
          kind: 'side-left',
          x: this.cursorX,
          y: 0,
          z: 0,
          l: Math.max(thickness, 80),
          h: container.innerHeight,
          w: usedLeftEdge,
          portSequence: seq
        });
      }
      for (const top of columnTopList) {
        if (container.innerHeight - top.y >= 80) {
          this._addFreeSpace({
            kind: 'top',
            x: this.cursorX,
            y: top.y,
            z: top.z,
            l: Math.max(thickness, 80),
            h: container.innerHeight - top.y,
            w: top.w,
            portSequence: seq
          });
        }
      }
    }
    return { placed: placedCount, thickness, slots };
  }

  /**
   * [MUTATION iter3] 纯几何规划一个切片截面的列。
   * 列内自下而上：w 非增（支撑率 100%）、l 非增、h 累计 ≤ 柜高；
   * 预检重量比/易碎/不可堆叠/堆层上限，减少放置阶段浪费。
   * @private
   */
  _planCrossSectionColumns(portGroups) {
    const container = this.container;
    const planned = new Map(); // group -> 已规划未提交数量
    const remainingOf = (group) => group.quantity - group.nextUnitIndex - (planned.get(group) || 0);
    const columns = [];

    const tryPickForColumn = (column) => {
      // 返回可放入该列顶部的最优候选（含物理预检），无则 null
      return this._pickPlannedItem(portGroups, remainingOf, {
        maxWidth: column.prevW,
        maxHeight: container.innerHeight - column.colTop,
        maxL: column.prevL,
        prefer: 'stack',
        belowCargo: column.prevCargo,
        cumulativeLoad: column.cumulativeLoad,
        plannedDepth: column.items.length
      });
    };

    while (true) {
      const usedWidth = columns.reduce((sum, col) => sum + col.width, 0);

      // [MUTATION iter3b] 柱高均衡：优先把新货物放到「能容纳它的最矮列」，
      // 使切片内各柱列等高形成垛墙（满足 StabilityAnalyzer 的双向约束豁免）。
      let bestTarget = null; // { column, pick }
      for (const column of columns) {
        if (column.closed) continue;
        if (column.colTop + 80 > container.innerHeight) continue;
        if (column.items.length + 1 > column.depthCap) continue;
        const pick = tryPickForColumn(column);
        if (!pick) continue;
        if (!bestTarget || column.colTop < bestTarget.column.colTop) {
          bestTarget = { column, pick };
        }
      }

      if (bestTarget) {
        const { column, pick } = bestTarget;
        const nextDepth = column.items.length + 1;
        const upperMaxStack = Math.max(1, Number(pick.group.cargo.maxStackLayers ?? pick.group.cargo.maxStack ?? 1));
        const lowerBound = Math.max(1, Number(column.prevCargo.maxStackLayers ?? column.prevCargo.maxStack ?? 1)) + nextDepth - 2;
        const upperBound = upperMaxStack + nextDepth - 1;
        const newCap = Math.min(column.depthCap, lowerBound, upperBound);
        if (nextDepth > newCap) {
          // 该列已达层高上限：永久关闭（避免死循环）
          column.closed = true;
          continue;
        }
        column.depthCap = newCap;
        column.items.push({ group: pick.group, dims: pick.dims });
        planned.set(pick.group, (planned.get(pick.group) || 0) + 1);
        column.colTop += pick.dims.h;
        column.cumulativeLoad += Number(pick.group.cargo.weight || 0);
        column.prevW = pick.dims.w;
        column.prevL = pick.dims.l;
        column.prevCargo = pick.group.cargo;
        continue;
      }

      // 所有列都无法继续：开新列（若还有宽度与货物）
      if (usedWidth + 80 > container.innerWidth) break;
      const base = this._pickPlannedItem(portGroups, remainingOf, {
        maxWidth: container.innerWidth - usedWidth,
        maxHeight: container.innerHeight,
        prefer: 'base'
      });
      if (!base) break;

      const baseMaxStack = Math.max(1, Number(base.group.cargo.maxStackLayers ?? base.group.cargo.maxStack ?? 1));
      const column = {
        width: base.dims.w,
        items: [{ group: base.group, dims: base.dims }],
        colTop: base.dims.h,
        prevW: base.dims.w,
        prevL: base.dims.l,
        prevCargo: base.group.cargo,
        cumulativeLoad: Number(base.group.cargo.weight || 0),
        depthCap: baseMaxStack,
        closed: false
      };
      planned.set(base.group, (planned.get(base.group) || 0) + 1);
      columns.push(column);
      if (column.colTop + 80 > container.innerHeight) column.closed = true;
    }

    // 中心对称分配 z（模板之外的自由规划）
    const totalColumnWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const startZ = Math.max(0, (container.innerWidth - totalColumnWidth) / 2);
    let zCursor2 = startZ;
    for (const col of columns) {
      col.z = zCursor2;
      zCursor2 += col.width;
    }
    return { columns };
  }

  _planIntoSlotTemplate(portGroups, slots) {
    const container = this.container;
    const planned = new Map();
    const remainingOf = (group) => group.quantity - group.nextUnitIndex - (planned.get(group) || 0);
    const columns = slots.map(slot => ({
      z: slot.z,
      width: slot.width,
      items: [],
      colTop: 0,
      prevW: slot.width,
      prevL: Math.max(slot.l, slot.orient ? slot.orient.l : 0),
      prevCargo: null,
      cumulativeLoad: 0,
      depthCap: Infinity,
      closed: false,
      orient: slot.orient || null
    }));

    // [MUTATION iter3c] 轮转层均衡：逐层轮转填充所有槽位（而非逐槽填满），
    // 保证部分填充的切片也保持横向对称与柱高均衡。
    const centerZ = container.innerWidth / 2;
    const passOrder = [...columns.keys()].sort((a, b) =>
      Math.abs(columns[a].z + columns[a].width / 2 - centerZ) - Math.abs(columns[b].z + columns[b].width / 2 - centerZ));
    let progress = true;
    while (progress) {
      progress = false;
      for (const colIdx of passOrder) {
        const column = columns[colIdx];
        if (column.closed) continue;
        if (column.colTop + 80 > container.innerHeight) { column.closed = true; continue; }
        if (column.items.length + 1 > column.depthCap) { column.closed = true; continue; }

        let pick = null;
        if (column.orient) {
          pick = this._pickPlannedItem(portGroups, remainingOf, {
            maxWidth: column.prevW,
            maxHeight: container.innerHeight - column.colTop,
            maxL: column.prevL,
            prefer: 'stack',
            belowCargo: column.prevCargo,
            cumulativeLoad: column.cumulativeLoad,
            plannedDepth: column.items.length,
            requireOrient: column.orient
          });
        }
        if (!pick) {
          pick = this._pickPlannedItem(portGroups, remainingOf, {
            maxWidth: column.prevW,
            maxHeight: container.innerHeight - column.colTop,
            maxL: column.prevL,
            prefer: 'stack',
            belowCargo: column.prevCargo,
            cumulativeLoad: column.cumulativeLoad,
            plannedDepth: column.items.length
          });
        }
        if (!pick) { column.closed = true; continue; }

        const nextDepth = column.items.length + 1;
        const upperMaxStack = Math.max(1, Number(pick.group.cargo.maxStackLayers ?? pick.group.cargo.maxStack ?? 1));
        if (column.prevCargo) {
          const lowerBound = Math.max(1, Number(column.prevCargo.maxStackLayers ?? column.prevCargo.maxStack ?? 1)) + nextDepth - 2;
          column.depthCap = Math.min(column.depthCap, lowerBound, upperMaxStack + nextDepth - 1);
          if (nextDepth > column.depthCap) { column.closed = true; continue; }
        } else {
          column.depthCap = upperMaxStack;
        }
        column.items.push({ group: pick.group, dims: pick.dims });
        planned.set(pick.group, (planned.get(pick.group) || 0) + 1);
        column.colTop += pick.dims.h;
        column.cumulativeLoad += Number(pick.group.cargo.weight || 0);
        column.prevW = pick.dims.w;
        column.prevL = pick.dims.l;
        column.prevCargo = pick.group.cargo;
        progress = true;
      }
    }
    return { columns };
  }


  /**
   * [MUTATION iter3d] 孤立柱细长比截断：无相邻柱（z 向间隙 > 30mm 接触容差）
   * 的柱列，其堆高不得超过 3.5 × min(底边)（StabilityAnalyzer 的
   * hardUnrestrainedSlenderness 阈值），超高层截断退回待装池。
   * @private
   */
  _truncateIsolatedSlenderColumns(columns, planned) {
    const sorted = [...columns].sort((a, b) => a.z - b.z);
    for (let i = 0; i < sorted.length; i++) {
      const col = sorted[i];
      if (col.items.length === 0) continue;
      const prev = sorted[i - 1];
      const next = sorted[i + 1];
      const colTop = col.colTop !== undefined ? col.colTop : col.items.reduce((t, it) => t + it.dims.h, 0);
      // 用实际货物包络（最大件宽）而非槽位宽度计算间隙
      const colW = Math.max(...col.items.map(it => it.dims.w));
      const prevW2 = prev && prev.items.length ? Math.max(...prev.items.map(it => it.dims.w)) : 0;
      const nextW2 = next && next.items.length ? Math.max(...next.items.map(it => it.dims.w)) : 0;
      const gapPrev = prev ? col.z - (prev.z + prevW2) : Infinity;
      const gapNext = next ? next.z - (col.z + colW) : Infinity;
      // 等高邻居才算嵌入垛墙（StabilityAnalyzer 的组合并要求面接触 + 竖向重叠）
      const prevTop = prev && prev.items.length ? (prev.colTop !== undefined ? prev.colTop : prev.items.reduce((t, it) => t + it.dims.h, 0)) : 0;
      const nextTop = next && next.items.length ? (next.colTop !== undefined ? next.colTop : next.items.reduce((t, it) => t + it.dims.h, 0)) : 0;
      const embedded = gapPrev <= 30 || gapNext <= 30;
      if (embedded) continue;
      const baseDims = col.items[0].dims;
      const minDim = Math.max(1, Math.min(baseDims.l, baseDims.w));
      const cap = 3.5 * minDim;
      let top = 0;
      let keep = 0;
      for (const it of col.items) {
        if (top + it.dims.h <= cap + 0.001) { top += it.dims.h; keep++; } else break;
      }
      if (keep < col.items.length && keep >= 1) {
        const removed = col.items.splice(keep);
        for (const it of removed) {
          planned.set(it.group, Math.max(0, (planned.get(it.group) || 0) - 1));
        }
        col.colTop = top;
        col.closed = true;
      }
    }
  }

  /**
   * [MUTATION iter3] 计划阶段的列内候选挑选（含物理预检）。
   * @private
   */
  _pickPlannedItem(portGroups, remainingOf, { maxWidth, maxHeight, maxL = Infinity, prefer, belowCargo = null, cumulativeLoad = 0, plannedDepth = 1, requireOrient = null }) {
    let best = null;
    let bestKey = null;
    for (const group of portGroups) {
      if (remainingOf(group) <= 0) continue;
      if ((group._columnSkip || 0) > 64) continue;
      if (this._wouldExceedPayload(group.cargo)) continue;
      const candidates = this._getOrientationCandidates(group.cargo);
      for (const dims of candidates) {
        if (!(dims.w > 0 && dims.h > 0 && dims.l > 0)) continue;
        if (dims.w > maxWidth + 0.001) continue;
        if (dims.h > maxHeight + 0.001) continue;
        if (dims.l > maxL + 0.001) continue;
        if (dims.l > this.container.innerLength - this.cursorX + 0.001) continue;
        // 物理预检：与 _evaluatePlacementConstraints 同规则，避免规划出必然被拒的堆叠
        if (belowCargo) {
          if (belowCargo.fragile === true || belowCargo.stackable === false) continue;
          const lowerMaxStack = Number(belowCargo.maxStackLayers !== undefined ? belowCargo.maxStackLayers : 1);
          if (lowerMaxStack > 0 && plannedDepth >= lowerMaxStack) continue;
          const upperWeight = Number(group.cargo.weight || 0);
          const lowerWeight = Number(belowCargo.weight || 0);
          const lowerIsReinforced = belowCargo.wooden === true || /wood|pallet|reinforced/i.test(String(belowCargo.packagingType || ''));
          if (!lowerIsReinforced && lowerWeight > 0 && upperWeight > lowerWeight * this.config.heavyOnLightRatio) continue;
          const capacity = Math.max(lowerWeight, 1) * this.config.supportLoadMultiplier;
          if (cumulativeLoad + upperWeight > capacity + 0.0001) continue;
        }
        if (requireOrient) {
          if (Math.abs(dims.l - requireOrient.l) > 0.5 || Math.abs(dims.w - requireOrient.w) > 0.5 || Math.abs(dims.h - requireOrient.h) > 0.5) continue;
        }
        const key = prefer === 'base'
          ? -dims.h * 1e6 + dims.l * 1e3 - dims.w
          : -dims.h * 1e6 + dims.l * 1e3 - dims.w;
        if (bestKey === null || key < bestKey) {
          bestKey = key;
          best = { group, dims: { ...dims } };
        }
      }
    }
    return best;
  }

  /**
   * [MUTATION iter3] 保留旧主阶段路径（配置 crossSectionWallBuilder=false 时回退）。
   * @private
   */
  _packGroupsSequentialSlices(groups) {
    let cursorX = 0;
    this.cursorX = 0;

    for (const group of groups) {
      const orientation = this._chooseOrientation(group);
      if (!orientation) {
        this._queueGroupUnloaded(group, 'OVERSIZE_OR_UNSUPPORTED_ORIENTATION');
        continue;
      }

      const positions = this._buildSlicePositions(orientation, group.cargo);
      if (positions.length === 0) {
        this._queueGroupUnloaded(group, 'NO_CROSS_SECTION_CAPACITY');
        continue;
      }

      let remaining = group.quantity;
      while (remaining > 0) {
        if (this._wouldExceedPayload(group.cargo)) {
          this._queueQuantityUnloaded(group, remaining, 'MAX_PAYLOAD_EXCEEDED');
          break;
        }
        if (cursorX + orientation.l > this.container.innerLength) {
          this._queueQuantityUnloaded(group, remaining, 'INSUFFICIENT_LENGTH');
          break;
        }

        const placedPositions = [];
        for (const pos of positions) {
          if (remaining <= 0) break;
          const placed = this._pushLoadedCargo(group, orientation, {
            x: cursorX,
            y: pos.y,
            z: pos.z
          }, { mainBlock: true });
          if (placed) {
            remaining--;
            placedPositions.push(pos);
          }
        }

        this._recordSliceFreeSpaces(orientation, placedPositions, cursorX, group);
        cursorX += orientation.l;
        this.cursorX = cursorX;
      }
    }
  }

  _normalizeContainer(container) {
    return {
      typeId: container.typeId || container.id || 'container',
      innerLength: Number(container.innerLength || container.length || 0),
      innerWidth: Number(container.innerWidth || container.width || 0),
      innerHeight: Number(container.innerHeight || container.height || 0),
      maxWeight: Number(container.maxWeight || 0)
    };
  }

  _buildGroups(cargoList) {
    const etaToSequence = this._buildEtaSequenceMap(cargoList);
    const indexed = cargoList.map((rawCargo, index) => {
      const resolvedPortSequence = rawCargo.eta && etaToSequence
        ? etaToSequence[rawCargo.eta]
        : Number(rawCargo.portSequence || 1);
      const cargo = {
        ...rawCargo,
        portSequence: resolvedPortSequence,
        batchId: rawCargo.batchId || `batch_${resolvedPortSequence}`,
        batchKey: rawCargo.batchKey || rawCargo.batchId || `batch_${resolvedPortSequence}`,
        batchLabel: rawCargo.batchLabel || this._makeBatchLabel({
          ...rawCargo,
          portSequence: resolvedPortSequence
        })
      };

      return {
        cargo,
        index,
        nextUnitIndex: 0,
        quantity: Math.max(1, Number(cargo.quantity || 1)),
        sku: cargo.sku || cargo.name || cargo.cargoId || cargo.id || `sku_${index}`,
        volume: (cargo.length || 0) * (cargo.width || 0) * (cargo.height || 0)
      };
    });

    return indexed.sort((a, b) => {
      const portA = a.cargo.portSequence || 1;
      const portB = b.cargo.portSequence || 1;
      if (portA !== portB) return portA - portB;
      if (b.volume !== a.volume) return b.volume - a.volume;
      return (b.cargo.weight || 0) - (a.cargo.weight || 0);
    });
  }

  _buildEtaSequenceMap(cargoList) {
    const uniqueEtas = [...new Set(cargoList.map(cargo => cargo.eta).filter(Boolean))].sort();
    if (uniqueEtas.length === 0) return null;
    return uniqueEtas.reduce((map, eta, index) => {
      map[eta] = index + 1;
      return map;
    }, {});
  }

  _chooseOrientation(group) {
    const cargo = group.cargo;
    const candidates = this._getOrientationCandidates(cargo);

    let best = null;
    for (const candidate of candidates) {
      if (!this._fitsContainer(candidate)) continue;
      const positions = this._buildSlicePositions(candidate, cargo);
      if (positions.length === 0) continue;
      const slices = Math.ceil(group.quantity / positions.length);
      const requiredLength = slices * candidate.l;
      const crossSectionFill = (positions.length * candidate.w * candidate.h) /
        (this.container.innerWidth * this.container.innerHeight);
      const score = requiredLength - crossSectionFill * 100;

      if (!best || score < best.score) {
        best = { ...candidate, score, perSlice: positions.length };
      }
    }

    return best;
  }

  _getOrientationCandidates(cargo) {
    const L = Number(cargo.length || 0);
    const W = Number(cargo.width || 0);
    const H = Number(cargo.height || 0);
    const candidates = [{ l: L, w: W, h: H, label: 'XYZ', inverted: false }];

    if (cargo.canRotate !== false) candidates.push({ l: W, w: L, h: H, label: 'YXZ', inverted: false });

    if (cargo.canLayFlat === true) {
      candidates.push({ l: L, w: H, h: W, label: 'XZY', inverted: false });
      if (cargo.canRotate !== false) candidates.push(
        { l: W, w: H, h: L, label: 'YZX', inverted: false },
        { l: H, w: L, h: W, label: 'ZXY', inverted: false },
        { l: H, w: W, h: L, label: 'ZYX', inverted: false }
      );
    }

    const unique = [];
    const seen = new Set();
    for (const candidate of candidates) {
      const key = `${candidate.l}-${candidate.w}-${candidate.h}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(candidate);
      }
    }
    return unique;
  }

  _fitsContainer(dims) {
    return dims.l > 0 &&
      dims.w > 0 &&
      dims.h > 0 &&
      dims.l <= this.container.innerLength &&
      dims.w <= this.container.innerWidth &&
      dims.h <= this.container.innerHeight;
  }

  _buildSlicePositions(dims, cargo) {
    const widthCount = Math.floor(this.container.innerWidth / dims.w);
    let heightCount = Math.floor(this.container.innerHeight / dims.h);

    if (cargo.stackable === false || cargo.fragile === true) {
      heightCount = 1;
    } else if (cargo.maxStackLayers) {
      heightCount = Math.min(heightCount, Math.max(1, Number(cargo.maxStackLayers)));
    }

    if (widthCount <= 0 || heightCount <= 0) return [];

    const zPositions = this._centerOutPositions(widthCount, dims.w, this.container.innerWidth);
    const positions = [];
    for (let yIndex = 0; yIndex < heightCount; yIndex++) {
      for (const z of zPositions) {
        positions.push({
          y: yIndex * dims.h,
          z
        });
      }
    }
    return positions;
  }

  _centerOutPositions(count, unitWidth, containerWidth) {
    const usedWidth = count * unitWidth;
    const start = Math.max(0, (containerWidth - usedWidth) / 2);
    const raw = [];
    for (let i = 0; i < count; i++) {
      raw.push(start + i * unitWidth);
    }

    const center = containerWidth / 2;
    return raw.sort((a, b) => {
      const da = Math.abs((a + unitWidth / 2) - center);
      const db = Math.abs((b + unitWidth / 2) - center);
      return da - db;
    });
  }

  _recordSliceFreeSpaces(dims, positions, x, group) {
    if (positions.length === 0) return;

    const zMin = Math.min(...positions.map(pos => pos.z));
    const zMax = Math.max(...positions.map(pos => pos.z + dims.w));
    const yMax = Math.max(...positions.map(pos => pos.y + dims.h));

    this._addFreeSpace({
      kind: 'side-left',
      x,
      y: 0,
      z: 0,
      l: dims.l,
      h: this.container.innerHeight,
      w: zMin,
      portSequence: group.cargo.portSequence || 1,
      sku: group.sku
    });

    this._addFreeSpace({
      kind: 'side-right',
      x,
      y: 0,
      z: zMax,
      l: dims.l,
      h: this.container.innerHeight,
      w: this.container.innerWidth - zMax,
      portSequence: group.cargo.portSequence || 1,
      sku: group.sku
    });

    this._addFreeSpace({
      kind: 'top',
      x,
      y: yMax,
      z: zMin,
      l: dims.l,
      h: this.container.innerHeight - yMax,
      w: zMax - zMin,
      portSequence: group.cargo.portSequence || 1,
      sku: group.sku
    });
  }

  _recordTailFreeSpace(cursorX, portSequence) {
    this._addFreeSpace({
      kind: 'tail',
      x: cursorX,
      y: 0,
      z: 0,
      l: this.container.innerLength - cursorX,
      h: this.container.innerHeight,
      w: this.container.innerWidth,
      portSequence
    });
  }

  _addFreeSpace(space) {
    const minUsefulSize = 80;
    if (space.l < minUsefulSize || space.h < minUsefulSize || space.w < minUsefulSize) return;
    this.freeSpaces.push({
      ...space,
      cursorX: space.x,
      cursorY: space.y,
      cursorZ: space.z,
      rowDepth: 0,
      layerHeight: 0
    });
  }

  _fillQueuedCargo() {
    for (const pending of this.pendingUnloaded) {
      let progress = true;
      while (pending.quantity > 0 && progress) {
        progress = false;
        for (const space of this.freeSpaces) {
          if (this._tryPlaceInFreeSpace(space, pending.group)) {
            pending.quantity--;
            progress = true;
            break;
          }
        }
      }
      if (pending.quantity > 0 && this._wouldExceedPayload(pending.group.cargo)) pending.reason = 'MAX_PAYLOAD_EXCEEDED';
    }
  }

  _tryPlaceInFreeSpace(space, group) {
    if (!this._spaceAcceptsGroup(space, group)) return false;

    const dims = this._chooseOrientationForSpace(group.cargo, space);
    if (!dims) return false;

    const maxX = space.x + space.l;
    const maxY = space.y + space.h;
    const maxZ = space.z + space.w;

    if (space.cursorZ + dims.w > maxZ + 0.001) {
      space.cursorZ = space.z;
      space.cursorY += Math.max(space.layerHeight, dims.h);
      space.layerHeight = 0;
    }

    if (space.cursorY + dims.h > maxY + 0.001) {
      space.cursorY = space.y;
      space.cursorZ = space.z;
      space.cursorX += Math.max(space.rowDepth, dims.l);
      space.rowDepth = 0;
      space.layerHeight = 0;
    }

    if (space.cursorX + dims.l > maxX + 0.001) {
      return false;
    }

    const placed = this._pushLoadedCargo(group, dims, {
      x: space.cursorX,
      y: space.cursorY,
      z: space.cursorZ
    }, {
      fillPacked: true,
      spaceKind: space.kind,
      spacePortSequence: space.portSequence
    });
    if (!placed) return false;

    space.cursorZ += dims.w;
    space.rowDepth = Math.max(space.rowDepth, dims.l);
    space.layerHeight = Math.max(space.layerHeight, dims.h);
    return true;
  }

  _spaceAcceptsGroup(space, group) {
    const groupPort = group.cargo.portSequence || 1;
    if (space.portSequence !== groupPort) return false;
    if (space.kind === 'tail' && groupPort !== this.maxPortSequence) return false;
    return true;
  }

  _chooseOrientationForSpace(cargo, space) {
    if (space.kind === 'top' && !this._isTopFillCargoAllowed(cargo, space)) {
      return null;
    }

    const candidates = this._getOrientationCandidates(cargo);
    // [MUTATION iter3d] top 空间细长比守卫：fill 放置不得重建孤立细长垛
    //（堆高 ≤ 3.5 × 正下方货物最小底边）。
    let topSupportMinDim = null;
    if (space.kind === 'top') {
      for (const o of this.loadedCargo) {
        if (Math.abs(Number(o.y) + Number(o.h) - space.y) > 2) continue;
        const zOverlap = Math.min(o.z + o.w, space.z + space.w) - Math.max(o.z, space.z);
        const xOverlap = Math.min(o.x + o.l, space.x + space.l) - Math.max(o.x, space.x);
        if (zOverlap > 0 && xOverlap > 0) {
          const d = Math.min(Number(o.l), Number(o.w));
          topSupportMinDim = topSupportMinDim === null ? d : Math.min(topSupportMinDim, d);
        }
      }
    }
    let best = null;
    for (const dims of candidates) {
      if (space.kind === 'top') {
        const topY = space.cursorY + dims.h;
        if (dims.h > this.config.manualTopFillMaxHeightMm) continue;
        if (topY > this.container.innerHeight - this.config.overheadClearanceMm) continue;
        if (topSupportMinDim !== null && (space.y + dims.h) > 3.5 * topSupportMinDim) continue;
      }
      if (dims.l <= space.l && dims.w <= space.w && dims.h <= space.h) {
        const score = dims.l * 0.6 + dims.h * 0.3 + dims.w * 0.1;
        if (!best || score < best.score) {
          best = { ...dims, score };
        }
      }
    }
    return best;
  }

  _isTopFillCargoAllowed(cargo, space) {
    const weight = Number(cargo.weight || 0);
    if (weight > this.config.manualTopFillMaxWeightKg) return false;
    if (cargo.fragile === true) return false;
    if (space.y > this.config.manualTopFillMaxReachY) return false;
    return true;
  }

  _pushLoadedCargo(group, dims, position, meta = {}) {
    const cargo = group.cargo;
    const color = this._colorFor(group.sku);
    const x = this.container.innerLength - (position.x + dims.l);

    const constraint = meta.mainBlock === true
      ? this._evaluateMainBlockConstraints(cargo, dims, { ...position, x })
      : this._evaluatePlacementConstraints(cargo, dims, { ...position, x });
    if (!constraint.valid) {
      this.constraintRejections.push({ sku: group.sku, ...constraint.reason });
      return false;
    }

    // [MUTATION iter3c] 主列路径跳过增量重心门禁：截面布局已按中心对称+层交错
    // 构建，增量门禁会与批量放置相互冲突造成死锁（货物被弃而重心无改善）。
    // 最终重心作为 COG_POLICY 警告由 PlanValidator 口径呈现。
    if (!meta.skipDynamicBalance && !this._passesDynamicBalance(cargo, dims, { ...position, x })) {
      this.dynamicBalanceRejections++;
      this.constraintRejections.push({ sku: group.sku, code: 'DYNAMIC_BALANCE', message: '候选位置超过动态重心阈值' });
      return false;
    }

    this.loadingIndex++;

    const loadedItem = {
      loadingIndex: this.loadingIndex,
      name: cargo.name,
      cargoId: cargo.unitIds?.[group.nextUnitIndex] || `${cargo.cargoId || cargo.id || group.sku}_${this.loadingIndex}`,
      ...(cargo.unitIds ? { unitId: cargo.unitIds[group.nextUnitIndex], sourceCargoId: cargo.cargoId || cargo.id || group.sku } : {}),
      x,
      y: position.y,
      z: position.z,
      l: dims.l,
      h: dims.h,
      w: dims.w,
      color,
      type: this._mapCargoType(cargo),
      packagingType: cargo.packagingType,
      weight: cargo.weight || 0,
      fragile: cargo.fragile === true,
      dangerous: cargo.dangerous === true,
      stackable: cargo.stackable !== false,
      maxStackLayers: Number(cargo.maxStackLayers || cargo.maxStack || 1),
      canRotate: cargo.canRotate !== false,
      canInvert: cargo.canInvert === true,
      canLayFlat: cargo.canLayFlat === true,
      batchId: cargo.batchId || `batch_${cargo.portSequence || 1}`,
      batchKey: cargo.batchKey || cargo.batchId || `batch_${cargo.portSequence || 1}`,
      batchLabel: cargo.batchLabel || this._makeBatchLabel(cargo),
      destinationPort: cargo.destinationPort,
      eta: cargo.eta,
      portSequence: cargo.portSequence || 1,
      sku: group.sku,
      handlingMethod: cargo.handlingMethod || ((cargo.weight || 0) >= 20 ? 'forklift' : 'manual'),
      handlingPolicy: cargo.handlingPolicy || 'derived',
      heavy: cargo.heavy === true || (cargo.weight || 0) >= 20,
      wooden: cargo.wooden === true || /wood|pallet|木/i.test(cargo.packagingType || ''),
      riskNotes: Array.isArray(cargo.riskNotes) ? [...cargo.riskNotes] : [],
      source: cargo.source || null,
      orientation: dims.label,
      inverted: dims.inverted === true,
      stackLevel: constraint.stackLevel,
      supportRatio: constraint.supportRatio,
      placementReason: {
        unloadingGroup: cargo.portSequence || 1,
        block: meta.spaceKind || 'main',
        layer: constraint.stackLevel,
        orientation: dims.label,
        balanceInfluence: constraint.balanceInfluence,
        rejectedConstraintsBeforePlacement: this.constraintRejections.filter((entry) => entry.sku === group.sku).slice(-4)
      },
      algorithmMeta: {
        blockPacked: meta.fillPacked !== true,
        fillPacked: meta.fillPacked === true,
        spaceKind: meta.spaceKind || 'main',
        spacePortSequence: meta.spacePortSequence,
        orientation: dims.label,
        lifoSafeFill: meta.fillPacked === true ? true : undefined,
        handlingMode: cargo.handlingMethod || ((cargo.weight || 0) >= 20 ? 'forklift' : 'manual'),
        placementMode: meta.spaceKind === 'top' ? 'manual-light-top-fill' : 'floor-or-block'
      }
    };

    this.loadedCargo.push(loadedItem);
    group.nextUnitIndex += 1;
    this.totalLoadedVolume += dims.l * dims.w * dims.h;
    this._commitSupportLoads(loadedItem, constraint.supports);
    if (meta.mainBlock === true) this.mainBlockIndex.set(mainBlockKey(loadedItem), loadedItem);
    this._commitWeightMoments(loadedItem);
    return true;
  }

  _wouldExceedPayload(cargo) {
    const maxPayload = Number(this.container.maxWeight || 0);
    return maxPayload > 0 && this.loadedWeight + Number(cargo.weight || 0) > maxPayload + 0.0001;
  }

  _evaluatePlacementConstraints(cargo, dims, position) {
    const candidate = { ...position, l: dims.l, w: dims.w, h: dims.h, weight: Number(cargo.weight || 0) };
    if (this._wouldExceedPayload(cargo)) return invalid('MAX_PAYLOAD_EXCEEDED', '累计货重将超过柜型 max payload');
    if (candidate.x < 0 || candidate.y < 0 || candidate.z < 0
      || candidate.x + candidate.l > this.container.innerLength + 0.001
      || candidate.y + candidate.h > this.container.innerHeight + 0.001
      || candidate.z + candidate.w > this.container.innerWidth + 0.001) return invalid('OUT_OF_BOUNDS', '候选位置超出柜内边界');
    const collision = this._collisionCandidates(candidate).find((item) => intersects(candidate, item, packingPolicy.collisionToleranceMm));
    if (collision) return invalid('COLLISION', `候选位置与 ${collision.cargoId} 相交`, { cargoId: collision.cargoId });

    const support = calculateSupport(candidate, this._supportCandidates(candidate.y), this.config.contactToleranceMm);
    if (candidate.y > this.config.contactToleranceMm && support.ratio + 1e-9 < this.config.supportRatioMin) {
      return invalid('SUPPORT_RATIO', `支撑率 ${(support.ratio * 100).toFixed(1)}% 低于 ${(this.config.supportRatioMin * 100).toFixed(1)}%`, { supportRatio: support.ratio });
    }
    let stackLevel = 1;
    for (const entry of support.supports) {
      const lower = entry.cargo;
      stackLevel = Math.max(stackLevel, Number(lower.stackLevel || 1) + 1);
      if (lower.fragile === true) return invalid('FRAGILE_SUPPORT', `易碎货物 ${lower.cargoId} 上方禁止承载`, { cargoId: lower.cargoId });
      if (lower.stackable === false) return invalid('NON_STACKABLE_SUPPORT', `不可堆叠货物 ${lower.cargoId} 上方禁止放置`, { cargoId: lower.cargoId });
      if (Number(lower.stackLevel || 1) >= Number(lower.maxStackLayers || 1)) return invalid('MAX_STACK', `${lower.cargoId} 已达到最大堆叠层数`, { cargoId: lower.cargoId });
      const upperWeight = Number(cargo.weight || 0);
      const lowerWeight = Number(lower.weight || 0);
      const lowerIsReinforced = lower.wooden === true || /wood|pallet|reinforced/i.test(String(lower.packagingType || ''));
      if (!lowerIsReinforced && lowerWeight > 0 && upperWeight > lowerWeight * this.config.heavyOnLightRatio) {
        return invalid('HEAVY_ON_LIGHT', `${upperWeight}kg 货物不得压在 ${lowerWeight}kg 的 ${lower.cargoId} 上`, { cargoId: lower.cargoId });
      }
      const share = support.supportedArea > 0 ? upperWeight * (entry.area / support.supportedArea) : upperWeight;
      const existingLoad = Number(this.supportLoads.get(lower.cargoId) || 0);
      const capacity = Math.max(lowerWeight, 1) * this.config.supportLoadMultiplier;
      if (existingLoad + share > capacity) return invalid('SUPPORT_LOAD_CAPACITY', `${lower.cargoId} 的基础承载规则上限已达到`, { cargoId: lower.cargoId });
    }
    return {
      valid: true,
      supportRatio: support.ratio,
      supports: support.supports,
      stackLevel,
      balanceInfluence: this._projectedBalanceInfluence(cargo, dims, position)
    };
  }

  _evaluateMainBlockConstraints(cargo, dims, position) {
    if (this._wouldExceedPayload(cargo)) return invalid('MAX_PAYLOAD_EXCEEDED', '累计货重将超过柜型 max payload');
    if (position.x < 0 || position.y < 0 || position.z < 0
      || position.x + dims.l > this.container.innerLength + 0.001
      || position.y + dims.h > this.container.innerHeight + 0.001
      || position.z + dims.w > this.container.innerWidth + 0.001) return invalid('OUT_OF_BOUNDS', '候选位置超出柜内边界');

    let stackLevel = 1;
    let supports = [];
    if (position.y > this.config.contactToleranceMm) {
      const lower = this.mainBlockIndex.get(mainBlockKey({
        x: position.x,
        y: position.y - dims.h,
        z: position.z,
        l: dims.l,
        h: dims.h,
        w: dims.w
      }));
      // A missing exact lower block means this is no longer the regular block
      // geometry; retain the general collision/support validator as a safe fallback.
      if (!lower) return this._evaluatePlacementConstraints(cargo, dims, position);
      const upperWeight = Number(cargo.weight || 0);
      const lowerWeight = Number(lower.weight || 0);
      const existingLoad = Number(this.supportLoads.get(lower.cargoId) || 0);
      const capacity = Math.max(lowerWeight, 1) * this.config.supportLoadMultiplier;
      if (existingLoad + upperWeight > capacity) {
        return invalid('SUPPORT_LOAD_CAPACITY', `${lower.cargoId} 的基础承载规则上限已达到`, { cargoId: lower.cargoId });
      }
      stackLevel = Number(lower.stackLevel || 1) + 1;
      supports = [{ cargo: lower, area: dims.l * dims.w }];
    }

    return {
      valid: true,
      supportRatio: 1,
      supports,
      stackLevel,
      balanceInfluence: this._projectedBalanceInfluence(cargo, dims, position)
    };
  }

  _projectedBalanceInfluence(cargo, dims, position) {
    const weight = Number(cargo.weight || 0);
    const projectedWeight = this.loadedWeight + weight;
    if (!(projectedWeight > 0)) return { lateralPercent: 0, longitudinalPercent: 0 };
    const centerX = position.x + dims.l / 2;
    const centerZ = position.z + dims.w / 2;
    const cogX = (this.weightedX + centerX * weight) / projectedWeight;
    const cogZ = (this.weightedZ + centerZ * weight) / projectedWeight;
    return {
      lateralPercent: this.container.innerWidth ? Math.abs((cogZ - this.container.innerWidth / 2) / (this.container.innerWidth / 2)) * 100 : 0,
      longitudinalPercent: this.container.innerLength ? Math.abs((cogX - this.container.innerLength / 2) / (this.container.innerLength / 2)) * 100 : 0
    };
  }

  _commitSupportLoads(item, supports) {
    const supportedArea = supports.reduce((sum, entry) => sum + entry.area, 0);
    for (const entry of supports) {
      const share = supportedArea > 0 ? Number(item.weight || 0) * entry.area / supportedArea : 0;
      this.supportLoads.set(entry.cargo.cargoId, Number(this.supportLoads.get(entry.cargo.cargoId) || 0) + share);
    }
    const topKey = Math.round((Number(item.y) + Number(item.h)) / this.config.contactToleranceMm);
    if (!this.supportLayers.has(topKey)) this.supportLayers.set(topKey, []);
    this.supportLayers.get(topKey).push(item);
    this._indexCargo(item);
  }

  _supportCandidates(y) {
    const key = Math.round(Number(y) / this.config.contactToleranceMm);
    return [key - 1, key, key + 1].flatMap((candidateKey) => this.supportLayers.get(candidateKey) || []);
  }

  _indexCargo(item) {
    for (const key of spatialKeys(item)) {
      if (!this.spatialIndex.has(key)) this.spatialIndex.set(key, []);
      this.spatialIndex.get(key).push(item);
    }
  }

  _collisionCandidates(candidate) {
    const unique = new Map();
    for (const key of spatialKeys(candidate)) {
      for (const item of this.spatialIndex.get(key) || []) unique.set(item.cargoId, item);
    }
    return [...unique.values()];
  }

  _passesDynamicBalance(cargo, dims, position) {
    const weight = Number(cargo.weight || 0);
    if (weight <= 0) return true;

    // [MUTATION iter3] 平衡寻优放行：当前重心已超限时，凡是把重心拉向中线的
    // 放置都应放行（否则深侧/侧边货物被拒、重心永久无法恢复）。PlanValidator
    // 对 CoG 的定性是质量警告而非硬违规；此处保证最终重心尽可能居中。
    const currentWeight = this.loadedWeight;
    const currentCogX = currentWeight > 0 ? this.weightedX / currentWeight : this.container.innerLength / 2;
    const currentCogZ = currentWeight > 0 ? this.weightedZ / currentWeight : this.container.innerWidth / 2;
    const currentLateral = this.container.innerWidth > 0
      ? Math.abs((currentCogZ - this.container.innerWidth / 2) / (this.container.innerWidth / 2)) * 100
      : 0;
    const currentLongitudinal = this.container.innerLength > 0
      ? Math.abs((currentCogX - this.container.innerLength / 2) / (this.container.innerLength / 2)) * 100
      : 0;

    const projectedWeight = this.loadedWeight + weight;
    const centerX = position.x + dims.l / 2;
    const centerZ = position.z + dims.w / 2;
    const projectedCogX = (this.weightedX + centerX * weight) / projectedWeight;
    const projectedCogZ = (this.weightedZ + centerZ * weight) / projectedWeight;
    const lateral = this.container.innerWidth > 0
      ? Math.abs((projectedCogZ - this.container.innerWidth / 2) / (this.container.innerWidth / 2)) * 100
      : 0;
    const longitudinal = this.container.innerLength > 0
      ? Math.abs((projectedCogX - this.container.innerLength / 2) / (this.container.innerLength / 2)) * 100
      : 0;
    const minWeightForHardCheck = Math.max(600, this.totalInputWeight * 0.08);
    // [MUTATION iter3c] 双状态门禁：当前重心达标时严守阈值（防单品击穿）；
    // 已超限时只拒绝继续恶化项（消除「严格改善才放行」造成的死锁），
    // 中性放置放行——最终重心由 PlanValidator 以 COG_POLICY 警告呈现。
    const lateralOver = currentLateral > this.config.lateralLimitPercent + 0.001;
    if (projectedWeight >= minWeightForHardCheck && lateral > this.config.lateralLimitPercent) {
      if (lateralOver) {
        if (lateral > currentLateral + 0.05) return false;
      } else {
        return false;
      }
    }

    const finalPhaseWeight = Math.max(1000, this.totalInputWeight * 0.75);
    if (this.hasMultiplePorts &&
        projectedWeight >= finalPhaseWeight &&
        longitudinal > this.config.finalLongitudinalLimitPercent) {
      const longitudinalOver = currentLongitudinal > this.config.finalLongitudinalLimitPercent + 0.001;
      if (longitudinalOver) {
        if (longitudinal > currentLongitudinal + 0.05) return false;
      } else {
        return false;
      }
    }

    return true;
  }

  _commitWeightMoments(item) {
    const weight = Number(item.weight || 0);
    this.loadedWeight += weight;
    this.weightedX += (item.x + item.l / 2) * weight;
    this.weightedZ += (item.z + item.w / 2) * weight;
  }

  _centerLoadedCargoAlongLength() {
    if (this.loadedCargo.length === 0) return;

    const minX = Math.min(...this.loadedCargo.map(item => item.x));
    const maxX = Math.max(...this.loadedCargo.map(item => item.x + item.l));
    const usedLength = maxX - minX;
    if (usedLength >= this.container.innerLength - 1) return;

    const targetMinX = (this.container.innerLength - usedLength) / 2;
    const delta = targetMinX - minX;
    if (Math.abs(delta) < 1) return;

    for (const item of this.loadedCargo) {
      item.x += delta;
      item.algorithmMeta = {
        ...item.algorithmMeta,
        longitudinalCentered: true,
        securingRequired: 'dunnage-or-lashing'
      };
    }

    this.loadedWeight = 0;
    this.weightedX = 0;
    this.weightedZ = 0;
    for (const item of this.loadedCargo) {
      this._commitWeightMoments(item);
    }
  }

  _queueGroupUnloaded(group, reason) {
    this._queueQuantityUnloaded(group, group.quantity, reason);
  }

  _queueQuantityUnloaded(group, quantity, reason) {
    if (quantity <= 0) return;
    this.pendingUnloaded.push({
      group,
      quantity,
      reason
    });
  }

  _flushPendingUnloaded() {
    for (const pending of this.pendingUnloaded) {
      this._markQuantityUnloaded(pending.group, pending.quantity, pending.reason);
    }
    this.pendingUnloaded = [];
  }

  _markQuantityUnloaded(group, quantity, reason) {
    for (let i = 0; i < quantity; i++) {
      const cargo = group.cargo;
      this.unloadedCargo.push({
        ...cargo,
        cargoId: cargo.unitIds?.[group.nextUnitIndex] || `${cargo.cargoId || cargo.id || group.sku}_unloaded_${i + 1}`,
        ...(cargo.unitIds ? { unitId: cargo.unitIds[group.nextUnitIndex], sourceCargoId: cargo.cargoId || cargo.id || group.sku } : {}),
        quantity: 1,
        reason
      });
      group.nextUnitIndex += 1;
    }
  }


  /**
   * [MUTATION iter3d] 稳定性反应式修复：用独立 PlanValidator 检测
   * FREE_STANDING_TALL_STACK（孤立细长垛），仅将被标记垛的顶部超限货物
   * 退回未装载池（按 slenderness ≤ 3.5 × min(底边) 计算需移除数）。
   * 未被标记的垛墙不受影响，避免主动截断造成的无谓利用率损失。
   * @private
   */
  _repairStabilityStacks() {
    if (!this.loadedCargo.length) return;
    let flagged;
    try {
      const validator = new PlanValidator();
      const report = validator.validate({ placements: this.loadedCargo, cargoList: [], container: this.container });
      flagged = (report.violations || []).filter(v => v.code === 'FREE_STANDING_TALL_STACK');
    } catch (error) {
      return; // 验证器异常时保留原布局
    }
    if (!flagged.length) return;

    const byId = new Map(this.loadedCargo.map(item => [String(item.cargoId), item]));
    const removeIds = new Set();
    for (const v of flagged) {
      const ev = v.evidence || {};
      const sl = ev.slenderness || {};
      const baseMin = Math.min(sl.effectiveBaseLength || 1, sl.effectiveBaseWidth || 1);
      const height = Number(sl.stackHeight || 0);
      const cap = 3.5 * baseMin;
      const ids = (v.cargoIds || []).map(String).filter(id => byId.has(id) && !removeIds.has(id));
      if (!(height > cap) || ids.length === 0) continue;
      const items = ids.map(id => byId.get(id));
      const itemH = items.reduce((s, it) => s + Number(it.h || 0), 0) / items.length;
      let removeCount = Math.ceil((height - cap) / Math.max(1, itemH));
      items.sort((a, b) => Number(b.y) - Number(a.y));
      for (const it of items) {
        if (removeCount <= 0) break;
        removeIds.add(String(it.cargoId));
        removeCount--;
      }
    }
    if (!removeIds.size) return;

    const removedItems = this.loadedCargo.filter(item => removeIds.has(String(item.cargoId)));
    this.loadedCargo = this.loadedCargo.filter(item => !removeIds.has(String(item.cargoId)));
    for (const it of removedItems) {
      this.totalLoadedVolume -= Number(it.l || 0) * Number(it.w || 0) * Number(it.h || 0);
      this.unloadedCargo.push({
        cargoId: it.cargoId,
        name: it.name,
        sku: it.sku,
        l: it.l, w: it.w, h: it.h,
        weight: it.weight,
        portSequence: it.portSequence,
        quantity: 1,
        reason: 'FREE_STANDING_STACK_REPAIR'
      });
    }
  }

  _buildResult(elapsedMs) {
    const totalWeight = this.loadedCargo.reduce((sum, item) => sum + (item.weight || 0), 0);
    const spaceUtilization = this.containerVolume > 0
      ? (this.totalLoadedVolume / this.containerVolume) * 100
      : 0;
    const cog = this._calculateCoG(totalWeight);
    const cogOffset = this._calculateCoGOffset(cog);
    const lifoCompliant = this._checkLIFOHardConstraint();
    const insertionPath = this._validateFinalInsertionPaths();
    const warnings = [];
    if (this.unloadedCargo.length > 0) warnings.push({ type: 'FAST_BLOCK_PARTIAL', message: `${this.unloadedCargo.length} 件未装入` });
    if (cogOffset.lateral > this.config.lateralLimitPercent || cogOffset.longitudinal > this.config.finalLongitudinalLimitPercent) warnings.push({ type: 'COG_OFFSET', message: `重心偏移横向 ${cogOffset.lateral.toFixed(2)}% / 纵向 ${cogOffset.longitudinal.toFixed(2)}% 超过配置阈值` });
    if (!lifoCompliant) warnings.push({ type: 'LIFO_VIOLATION', message: '最终 placement 未通过 LIFO 空间顺序检查' });
    if (!insertionPath.feasible) warnings.push({ type: 'INSERTION_PATH', message: `${insertionPath.failures.length} 件货物的 AABB 插入路径需复核` });

    return {
      loadedCargo: this.loadedCargo,
      unloadedCargo: this.unloadedCargo,
      spaceUtilization: Math.min(spaceUtilization, 100),
      totalWeight,
      cog,
      cogOffset,
      metrics: {
        algorithm: 'fast-block',
        elapsedMs,
        totalVolume: this.totalLoadedVolume,
        dynamicBalanceRejections: this.dynamicBalanceRejections,
        constraintRejections: this.constraintRejections.length
      },
      constraintMeta: {
        standardsProfile: 'Ningbo port entry + GB/T container limits + CTU Code + SOLAS VGM',
        enforcedConstraints: [
          'LIFO unloading order',
          'dynamic center-of-gravity',
          'container max payload',
          'orientation semantics',
          'support ratio and basic stacking',
          'AABB insertion path feasibility'
        ],
        lifoCompliant,
        insertionPathFeasible: insertionPath.feasible,
        insertionPathFailures: insertionPath.failures,
        supportRatioMin: this.config.supportRatioMin,
        maxPayloadEnforced: this.container.maxWeight > 0,
        fillPolicy: 'same-port-only; no cross-batch gap filling',
        topFillPolicy: `light non-fragile cargo only; <=${this.config.manualTopFillMaxWeightKg}kg; <=${this.config.manualTopFillMaxReachY}mm reach`,
        securingPolicy: 'partial loads are length-centered and require dunnage or lashing',
        doorSide: 'higher x coordinate',
        deepestSide: 'lower x coordinate'
      },
      warnings
    };
  }

  _validateFinalInsertionPaths() {
    const ordered = [...this.loadedCargo].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
    const crossSectionIndex = new Map();
    const failures = [];
    for (const item of ordered) {
      const candidates = new Map();
      for (const key of crossSectionKeys(item)) {
        for (const placed of crossSectionIndex.get(key) || []) candidates.set(placed.cargoId, placed);
      }
      // Items wholly deeper than the target cannot intersect its high-X door
      // insertion segment. Filtering them keeps final validation near-linear
      // for large, regular SKU blocks without relaxing the geometry check.
      const blockers = [...candidates.values()].filter((placed) =>
        Number(placed.x) + Number(placed.l) > Number(item.x) + packingPolicy.collisionToleranceMm
        && crossSectionOverlaps(item, placed, packingPolicy.collisionToleranceMm)
      );
      const result = evaluateInsertionPath(item, blockers, this.container);
      if (!result.feasible) failures.push({ cargoId: item.cargoId, reasons: result.reasons });
      for (const key of crossSectionKeys(item)) {
        if (!crossSectionIndex.has(key)) crossSectionIndex.set(key, []);
        crossSectionIndex.get(key).push(item);
      }
    }
    return { feasible: failures.length === 0, failures };
  }

  _checkLIFOHardConstraint() {
    const batches = new Map();
    for (const item of this.loadedCargo) {
      const portSequence = Number(item.portSequence || 1);
      if (!batches.has(portSequence)) {
        batches.set(portSequence, { minX: Infinity, maxX: -Infinity, count: 0 });
      }
      const batch = batches.get(portSequence);
      batch.minX = Math.min(batch.minX, item.x);
      batch.maxX = Math.max(batch.maxX, item.x + item.l);
      batch.count++;
    }

    const sequences = [...batches.keys()].sort((a, b) => a - b);
    for (let i = 0; i < sequences.length; i++) {
      for (let j = i + 1; j < sequences.length; j++) {
        const earlierUnloaded = batches.get(sequences[i]);
        const laterUnloaded = batches.get(sequences[j]);
        if (earlierUnloaded.minX + 1 < laterUnloaded.maxX) {
          return false;
        }
      }
    }
    return true;
  }

  _calculateCoG(totalWeight) {
    if (this.loadedCargo.length === 0 || totalWeight <= 0) {
      return { x: 0, y: 0, z: 0 };
    }

    let mx = 0;
    let my = 0;
    let mz = 0;
    for (const item of this.loadedCargo) {
      const weight = item.weight || 0;
      mx += (item.x + item.l / 2) * weight;
      my += (item.y + item.h / 2) * weight;
      mz += (item.z + item.w / 2) * weight;
    }

    return {
      x: mx / totalWeight,
      y: my / totalWeight,
      z: mz / totalWeight
    };
  }

  _calculateCoGOffset(cog) {
    const centerX = this.container.innerLength / 2;
    const centerZ = this.container.innerWidth / 2;
    const lateralRaw = centerZ > 0 ? ((cog.z - centerZ) / centerZ) * 100 : 0;
    const longitudinalRaw = centerX > 0 ? ((cog.x - centerX) / centerX) * 100 : 0;

    return {
      lateral: Math.abs(lateralRaw),
      longitudinal: Math.abs(longitudinalRaw),
      direction: lateralRaw > 0 ? 'right' : 'left',
      percentage: lateralRaw.toFixed(2)
    };
  }

  _mapCargoType(cargo) {
    if (cargo.fragile === true) return 'fragile';
    if ((cargo.weight || 0) >= 20) return 'heavy';
    const type = String(cargo.packagingType || '').toLowerCase();
    if (type.includes('glass') || type.includes('ceramic') || type.includes('porcelain')) {
      return 'fragile';
    }
    return 'normal';
  }

  _makeBatchLabel(cargo) {
    const port = cargo.destinationPort || '';
    const eta = cargo.eta || '';
    if (port && eta) return `${port} · ${eta}`;
    if (port) return port;
    if (eta) return eta;
    return `Batch ${cargo.portSequence || 1}`;
  }

  _colorFor(key) {
    let hash = 0;
    const str = String(key || '');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return this.palette[Math.abs(hash) % this.palette.length];
  }
}

function invalid(code, message, evidence = {}) {
  return { valid: false, reason: { code, message, ...evidence } };
}

function intersects(a, b, tolerance = 0.5) {
  return Number(a.x) < Number(b.x) + Number(b.l) - tolerance
    && Number(a.x) + Number(a.l) > Number(b.x) + tolerance
    && Number(a.y) < Number(b.y) + Number(b.h) - tolerance
    && Number(a.y) + Number(a.h) > Number(b.y) + tolerance
    && Number(a.z) < Number(b.z) + Number(b.w) - tolerance
    && Number(a.z) + Number(a.w) > Number(b.z) + tolerance;
}

function spatialKeys(box, cellSize = 500) {
  const minX = Math.floor(Number(box.x) / cellSize);
  const maxX = Math.floor((Number(box.x) + Number(box.l) - 0.001) / cellSize);
  const minY = Math.floor(Number(box.y) / cellSize);
  const maxY = Math.floor((Number(box.y) + Number(box.h) - 0.001) / cellSize);
  const minZ = Math.floor(Number(box.z) / cellSize);
  const maxZ = Math.floor((Number(box.z) + Number(box.w) - 0.001) / cellSize);
  const keys = [];
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) keys.push(`${x}:${y}:${z}`);
  return keys;
}

function crossSectionKeys(box, cellSize = 500) {
  const minY = Math.floor(Number(box.y) / cellSize);
  const maxY = Math.floor((Number(box.y) + Number(box.h) - 0.001) / cellSize);
  const minZ = Math.floor(Number(box.z) / cellSize);
  const maxZ = Math.floor((Number(box.z) + Number(box.w) - 0.001) / cellSize);
  const keys = [];
  for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) keys.push(`${y}:${z}`);
  return keys;
}

function crossSectionOverlaps(a, b, tolerance = 0.5) {
  return Number(a.y) < Number(b.y) + Number(b.h) - tolerance
    && Number(a.y) + Number(a.h) > Number(b.y) + tolerance
    && Number(a.z) < Number(b.z) + Number(b.w) - tolerance
    && Number(a.z) + Number(a.w) > Number(b.z) + tolerance;
}

function mainBlockKey(box) {
  return `${box.x}|${box.y}|${box.z}|${box.l}|${box.h}|${box.w}`;
}

module.exports = FastBlockPackingEngine;
