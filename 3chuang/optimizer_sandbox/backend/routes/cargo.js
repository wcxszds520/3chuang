/**
 * 货物管理路由模块
 * 职责：定义货物相关的RESTful API接口
 * 包含接口：创建货物、查询货物列表、更新货物、删除货物、清空货物
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { getTemplateByName, isValidTemplate } = require('../config/templates');

/**
 * POST /api/cargo/create
 * 创建货物接口
 * 
 * 请求参数：
 * - name: 货物名称（必需）
 * - length: 长度，单位毫米（必需，正数）
 * - width: 宽度，单位毫米（必需，正数）
 * - height: 高度，单位毫米（必需，正数）
 * - weight: 重量，单位千克（必需，正数）
 * - quantity: 数量（必需，正整数）
 * - stackable: 是否可堆叠（可选，默认true）
 * - maxStackLayers: 最大堆叠层数（可选，默认999）
 * - canInvert: 是否可倒置（可选，默认true）
 * - canLayFlat: 是否可侧放（可选，默认true）
 * 
 * 响应数据：
 * - cargoId: 创建的货物ID
 */
router.post('/create', async (req, res) => {
  try {
    const {
      name,
      length,
      width,
      height,
      weight,
      quantity,
      stackable = true,
      maxStackLayers = 999,
      canInvert = true,
      canLayFlat = true,
      fragile = false,  // 新增：易碎品标记
      userId = null,
      // 宁波港出货时间字段
      eta = null,
      portSequence = null,
      cyClosing = null,
      customsDeclaration = null
    } = req.body;

    // 参数验证：检查必需字段
    if (!name || !length || !width || !height || !weight || !quantity) {
      return res.error('缺少必需参数', 400);
    }

    // 参数验证：检查数值类型
    if (isNaN(length) || isNaN(width) || isNaN(height) || isNaN(weight) || isNaN(quantity)) {
      return res.error('尺寸、重量和数量必须为数字', 400);
    }

    // 参数验证：检查正数
    if (length <= 0 || width <= 0 || height <= 0) {
      return res.error('货物尺寸必须为正数', 400);
    }

    if (weight <= 0) {
      return res.error('货物重量必须为正数', 400);
    }

    if (quantity <= 0 || !Number.isInteger(Number(quantity))) {
      return res.error('货物数量必须为正整数', 400);
    }

    // 参数验证：检查尺寸是否超出40HQ柜型限制（最大柜型）
    const maxContainerLength = 12032; // 40HQ内部长度
    const maxContainerWidth = 2352;   // 40HQ内部宽度
    const maxContainerHeight = 2698;  // 40HQ内部高度

    // 检查货物任意方向是否能放入柜型（考虑旋转）
    const dimensions = [length, width, height].sort((a, b) => b - a);
    const containerDimensions = [maxContainerLength, maxContainerWidth, maxContainerHeight].sort((a, b) => b - a);

    for (let i = 0; i < 3; i++) {
      if (dimensions[i] > containerDimensions[i]) {
        return res.error('货物尺寸超出最大柜型限制（40HQ）', 400);
      }
    }

    // 参数验证：检查单件货物重量是否超出柜型载重限制
    const maxCargoWeight = 26000; // 40GP和40HQ的额定载重
    if (weight > maxCargoWeight) {
      return res.error('单件货物重量超出柜型载重限制', 400);
    }

    // 生成货物ID
    const cargoId = `cargo_${uuidv4()}`;

    // 插入数据库（MVP版本：只使用核心字段）
    const sql = `
      INSERT INTO cargo (
        cargo_id, user_id, name, length, width, height, weight, quantity,
        stackable, max_stack_layers, can_invert, can_lay_flat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      cargoId,
      userId,
      name,
      length,
      width,
      height,
      weight,
      quantity,
      stackable,
      maxStackLayers,
      canInvert,
      canLayFlat
    ]);

    // 返回成功响应
    res.success({ cargoId }, '货物创建成功');
  } catch (error) {
    console.error('创建货物失败:', error);
    res.error('创建货物失败', 500);
  }
});

/**
 * GET /api/cargo/list
 * 查询货物列表接口
 * 
 * 查询参数：
 * - userId: 用户ID（可选，MVP阶段可不传）
 * 
 * 响应数据：
 * - cargoList: 货物列表数组
 */
router.get('/list', async (req, res) => {
  try {
    const { userId = null } = req.query;

    // 构建SQL查询
    let sql = 'SELECT * FROM cargo';
    const params = [];

    // 如果提供了userId，则只查询该用户的货物
    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }

    // 按创建时间倒序排列
    sql += ' ORDER BY created_at DESC';

    // 执行查询
    const [rows] = await db.query(sql, params);

    // 转换字段名为驼峰命名（前端友好）
    const cargoList = rows.map(row => ({
      cargoId: row.cargo_id,
      userId: row.user_id,
      name: row.name,
      length: row.length,
      width: row.width,
      height: row.height,
      weight: parseFloat(row.weight),
      quantity: row.quantity,
      stackable: Boolean(row.stackable),
      maxStackLayers: row.max_stack_layers,
      canInvert: Boolean(row.can_invert),
      canLayFlat: Boolean(row.can_lay_flat),
      // 宁波港出货时间字段
      eta: row.eta,
      portSequence: row.port_sequence,
      cyClosing: row.cy_closing,
      customsDeclaration: row.customs_declaration,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    // 返回成功响应
    res.success({ cargoList }, '查询成功');
  } catch (error) {
    console.error('查询货物列表失败:', error);
    res.error('查询货物列表失败', 500);
  }
});

/**
 * PUT /api/cargo/update/:cargoId
 * 更新货物接口
 * 
 * 路径参数：
 * - cargoId: 货物ID
 * 
 * 请求参数（所有参数可选，只更新提供的字段）：
 * - name: 货物名称
 * - length: 长度，单位毫米
 * - width: 宽度，单位毫米
 * - height: 高度，单位毫米
 * - weight: 重量，单位千克
 * - quantity: 数量
 * - stackable: 是否可堆叠
 * - maxStackLayers: 最大堆叠层数
 * - canInvert: 是否可倒置
 * - canLayFlat: 是否可侧放
 * 
 * 响应数据：无
 */
router.put('/update/:cargoId', async (req, res) => {
  try {
    const { cargoId } = req.params;
    const updateFields = req.body;

    // 参数验证：检查是否提供了cargoId
    if (!cargoId) {
      return res.error('缺少货物ID', 400);
    }

    // 参数验证：检查是否提供了更新字段
    if (Object.keys(updateFields).length === 0) {
      return res.error('没有提供要更新的字段', 400);
    }

    // 检查货物是否存在
    const [existingCargo] = await db.query('SELECT * FROM cargo WHERE cargo_id = ?', [cargoId]);
    if (existingCargo.length === 0) {
      return res.error('货物不存在', 404);
    }

    // 参数验证：如果更新了尺寸或重量，需要进行验证
    const { length, width, height, weight, quantity } = updateFields;

    if (length !== undefined || width !== undefined || height !== undefined) {
      const currentCargo = existingCargo[0];
      const newLength = length !== undefined ? length : currentCargo.length;
      const newWidth = width !== undefined ? width : currentCargo.width;
      const newHeight = height !== undefined ? height : currentCargo.height;

      // 检查正数
      if (newLength <= 0 || newWidth <= 0 || newHeight <= 0) {
        return res.error('货物尺寸必须为正数', 400);
      }

      // 检查是否超出柜型限制
      const maxContainerLength = 12032;
      const maxContainerWidth = 2352;
      const maxContainerHeight = 2698;

      const dimensions = [newLength, newWidth, newHeight].sort((a, b) => b - a);
      const containerDimensions = [maxContainerLength, maxContainerWidth, maxContainerHeight].sort((a, b) => b - a);

      for (let i = 0; i < 3; i++) {
        if (dimensions[i] > containerDimensions[i]) {
          return res.error('货物尺寸超出最大柜型限制（40HQ）', 400);
        }
      }
    }

    if (weight !== undefined) {
      if (weight <= 0) {
        return res.error('货物重量必须为正数', 400);
      }

      const maxCargoWeight = 26000;
      if (weight > maxCargoWeight) {
        return res.error('单件货物重量超出柜型载重限制', 400);
      }
    }

    if (quantity !== undefined) {
      if (quantity <= 0 || !Number.isInteger(Number(quantity))) {
        return res.error('货物数量必须为正整数', 400);
      }
    }

    // 构建动态更新SQL
    const allowedFields = {
      name: 'name',
      length: 'length',
      width: 'width',
      height: 'height',
      weight: 'weight',
      quantity: 'quantity',
      stackable: 'stackable',
      maxStackLayers: 'max_stack_layers',
      canInvert: 'can_invert',
      canLayFlat: 'can_lay_flat',
      // 宁波港出货时间字段
      eta: 'eta',
      portSequence: 'port_sequence',
      cyClosing: 'cy_closing',
      customsDeclaration: 'customs_declaration'
    };

    const updateParts = [];
    const params = [];

    Object.keys(updateFields).forEach(key => {
      if (allowedFields[key]) {
        updateParts.push(`${allowedFields[key]} = ?`);
        params.push(updateFields[key]);
      }
    });

    if (updateParts.length === 0) {
      return res.error('没有有效的更新字段', 400);
    }

    // 添加cargoId到参数列表
    params.push(cargoId);

    // 执行更新
    const sql = `UPDATE cargo SET ${updateParts.join(', ')} WHERE cargo_id = ?`;
    await db.query(sql, params);

    // 返回成功响应
    res.success({}, '货物更新成功');
  } catch (error) {
    console.error('更新货物失败:', error);
    res.error('更新货物失败', 500);
  }
});

/**
 * DELETE /api/cargo/delete/:cargoId
 * 删除货物接口
 * 
 * 路径参数：
 * - cargoId: 货物ID
 * 
 * 响应数据：无
 */
router.delete('/delete/:cargoId', async (req, res) => {
  try {
    const { cargoId } = req.params;

    // 参数验证：检查是否提供了cargoId
    if (!cargoId) {
      return res.error('缺少货物ID', 400);
    }

    // 检查货物是否存在
    const [existingCargo] = await db.query('SELECT * FROM cargo WHERE cargo_id = ?', [cargoId]);
    if (existingCargo.length === 0) {
      return res.error('货物不存在', 404);
    }

    // 执行删除
    await db.query('DELETE FROM cargo WHERE cargo_id = ?', [cargoId]);

    // 返回成功响应
    res.success({}, '货物删除成功');
  } catch (error) {
    console.error('删除货物失败:', error);
    res.error('删除货物失败', 500);
  }
});

/**
 * DELETE /api/cargo/clear
 * 清空所有货物接口
 * 
 * 查询参数：
 * - userId: 用户ID（可选，如果提供则只清空该用户的货物）
 * 
 * 响应数据：
 * - deletedCount: 删除的货物数量
 */
router.delete('/clear', async (req, res) => {
  try {
    const { userId = null } = req.query;

    // 构建SQL删除语句
    let sql = 'DELETE FROM cargo';
    const params = [];

    // 如果提供了userId，则只删除该用户的货物
    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }

    // 执行删除
    const [result] = await db.query(sql, params);

    // 返回成功响应，包含删除的记录数
    res.success({ deletedCount: result.affectedRows }, '货物清空成功');
  } catch (error) {
    console.error('清空货物失败:', error);
    res.error('清空货物失败', 500);
  }
});

/**
 * POST /api/cargo/import-template
 * 导入预设模板接口
 * 
 * 用途：快速导入预设的货物模板，用于路演演示和功能测试
 * 
 * 请求参数：
 * - templateName: 模板名称（必需），可选值：'慈溪小家电'、'宁波文具'、'宁波汽配'
 * - userId: 用户ID（可选，MVP阶段可不传）
 * 
 * 响应数据：
 * - cargoList: 导入的货物列表，包含每个货物的完整信息和生成的cargoId
 * 
 * 业务逻辑：
 * 1. 验证模板名称是否有效
 * 2. 从templates.js获取模板数据
 * 3. 批量创建货物记录，为每个货物生成唯一的cargo_id
 * 4. 返回创建的货物列表
 * 
 * 需求：3.6 - 支持快速导入预设模板，10秒内完成货物信息填充
 */
router.post('/import-template', async (req, res) => {
  try {
    const { templateName, userId = null } = req.body;

    // 参数验证：检查是否提供了模板名称
    if (!templateName) {
      return res.error('缺少模板名称参数', 400);
    }

    // 参数验证：检查模板名称是否有效
    if (!isValidTemplate(templateName)) {
      return res.error(`无效的模板名称：${templateName}。可选模板：慈溪小家电、宁波文具、宁波汽配`, 400);
    }

    // 获取模板数据
    const template = getTemplateByName(templateName);
    
    // 准备批量插入的货物数据
    const cargoList = [];
    const insertPromises = [];

    // 遍历模板中的每个货物，创建数据库记录
    for (const cargoData of template.cargoList) {
      // 为每个货物生成唯一的cargo_id
      const cargoId = `cargo_${uuidv4()}`;

      // 构建插入SQL（MVP版本：只使用核心字段）
      const sql = `
        INSERT INTO cargo (
          cargo_id, user_id, name, length, width, height, weight, quantity,
          stackable, max_stack_layers, can_invert, can_lay_flat
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // 执行插入操作（异步）
      const insertPromise = db.query(sql, [
        cargoId,
        userId,
        cargoData.name,
        cargoData.length,
        cargoData.width,
        cargoData.height,
        cargoData.weight,
        cargoData.quantity,
        cargoData.stackable,
        cargoData.maxStackLayers,
        cargoData.canInvert,
        cargoData.canLayFlat
      ]);

      insertPromises.push(insertPromise);

      // 构建返回的货物对象（包含cargoId）
      cargoList.push({
        cargoId,
        userId,
        name: cargoData.name,
        length: cargoData.length,
        width: cargoData.width,
        height: cargoData.height,
        weight: cargoData.weight,
        quantity: cargoData.quantity,
        stackable: cargoData.stackable,
        maxStackLayers: cargoData.maxStackLayers,
        canInvert: cargoData.canInvert,
        canLayFlat: cargoData.canLayFlat
      });
    }

    // 等待所有插入操作完成（并行执行，提高性能）
    await Promise.all(insertPromises);

    // 返回成功响应，包含导入的货物列表
    res.success(
      { 
        cargoList,
        templateName,
        description: template.description,
        count: cargoList.length
      }, 
      `模板"${templateName}"导入成功，共导入${cargoList.length}种货物`
    );
  } catch (error) {
    console.error('导入模板失败:', error);
    res.error('导入模板失败', 500);
  }
});

module.exports = router;
