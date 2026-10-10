# 集成测试文档

## 测试概述

本目录包含系统基础框架的集成测试,验证以下功能:

### 1. 后端服务集成测试 (`integration/server.test.js`)

测试后端服务的核心功能:

- **服务器启动测试**: 验证Express服务器成功启动并监听端口
- **数据库连接测试**: 验证MySQL数据库连接正常,可以执行查询操作
- **统一响应格式测试**: 验证所有API返回统一的JSON格式(code、message、data字段)
- **后端服务响应测试**: 验证后端服务能够正常响应请求,响应时间<2秒
- **数据库CRUD操作测试**: 验证数据库的增删改查操作正确执行且数据持久化成功

**对应需求**: 1.5, 1.6, 1.9, 1.10

### 2. 小程序API请求工具类测试 (`integration/miniprogram-request.test.js`)

测试小程序前端API请求工具类的结构和逻辑:

- **文件结构验证**: 验证request.js文件存在且包含必要的导出方法
- **响应格式处理验证**: 验证正确处理HTTP状态码和业务状态码
- **错误处理验证**: 验证loading提示、错误提示、网络错误处理
- **离线模式验证**: 验证离线模式检测和错误提示
- **请求配置验证**: 验证超时时间、Content-Type、HTTP方法支持
- **文件上传功能验证**: 验证upload方法和wx.uploadFile API使用
- **Promise支持验证**: 验证返回Promise对象和resolve/reject处理
- **与后端服务集成验证**: 验证BASE_URL配置、URL拼接、响应格式处理

**对应需求**: 1.9

## 运行测试前的准备

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置数据库

确保MySQL服务器正在运行,并创建测试数据库:

```sql
CREATE DATABASE ningbo_port_packing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 初始化数据库表结构

运行数据库初始化脚本:

```bash
mysql -u root -p ningbo_port_packing < config/init.sql
```

### 4. 配置环境变量

复制`.env.example`文件为`.env`,并配置数据库连接信息:

```bash
cp .env.example .env
```

编辑`.env`文件,设置正确的数据库配置:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ningbo_port_packing
PORT=3000
NODE_ENV=development
```

## 运行测试

### 运行所有测试

```bash
npm test
```

### 运行特定测试文件

```bash
# 只运行后端服务测试
npm test -- __tests__/integration/server.test.js

# 只运行小程序请求工具类测试
npm test -- __tests__/integration/miniprogram-request.test.js
```

### 监听模式(开发时使用)

```bash
npm run test:watch
```

## 测试结果说明

### 成功的测试输出

```
Test Suites: 2 passed, 2 total
Tests:       39 passed, 39 total
Snapshots:   0 total
Time:        2.5 s
```

### 测试覆盖的验收标准

#### 需求1.5: 后端服务启动和数据库连接
- ✅ 服务器成功启动并监听端口
- ✅ 数据库连接正常
- ✅ 可以执行数据库查询操作

#### 需求1.6: 统一响应格式
- ✅ 成功响应包含code、message、data字段
- ✅ 成功响应的code为200
- ✅ 错误响应包含统一格式

#### 需求1.9: 后端服务正常响应
- ✅ 后端服务能够正常响应GET请求
- ✅ 响应时间<2秒
- ✅ 小程序API请求工具类正确处理响应格式

#### 需求1.10: 数据库增删改查操作
- ✅ 数据库能够执行INSERT操作
- ✅ 数据库能够执行SELECT操作并查询到插入的数据
- ✅ 数据库能够执行UPDATE操作
- ✅ 数据库能够执行DELETE操作
- ✅ 数据库操作正确持久化数据

## 常见问题

### 1. 数据库连接失败

**错误信息**: `connect ECONNREFUSED ::1:3306`

**解决方法**:
- 确保MySQL服务器正在运行
- 检查`.env`文件中的数据库配置是否正确
- 确认数据库`ningbo_port_packing`已创建
- 确认数据库用户有足够的权限

### 2. 表不存在错误

**错误信息**: `Table 'ningbo_port_packing.cargo' doesn't exist`

**解决方法**:
- 运行数据库初始化脚本: `mysql -u root -p ningbo_port_packing < config/init.sql`

### 3. 测试超时

**错误信息**: `Timeout - Async callback was not invoked within the 10000 ms timeout`

**解决方法**:
- 检查数据库连接是否正常
- 检查网络连接
- 增加测试超时时间(在jest.config.js中修改testTimeout)

## 测试文件说明

### server.test.js

包含15个测试用例,分为5个测试套件:

1. **后端服务启动测试** (2个测试)
   - 服务器启动和监听
   - 健康检查接口

2. **数据库连接测试** (3个测试)
   - 数据库连接
   - 查询操作
   - 表查询

3. **统一响应格式中间件测试** (3个测试)
   - 响应格式验证
   - 成功响应code验证
   - 404错误响应格式

4. **后端服务响应测试** (2个测试)
   - GET请求响应
   - 响应时间验证

5. **数据库增删改查操作测试** (5个测试)
   - INSERT操作
   - SELECT操作
   - UPDATE操作
   - DELETE操作
   - 数据持久化验证

### miniprogram-request.test.js

包含24个测试用例,分为8个测试套件:

1. **文件结构验证** (4个测试)
2. **响应格式处理验证** (4个测试)
3. **错误处理验证** (4个测试)
4. **离线模式验证** (2个测试)
5. **请求配置验证** (3个测试)
6. **文件上传功能验证** (2个测试)
7. **Promise支持验证** (2个测试)
8. **与后端服务集成验证** (3个测试)

## 下一步

完成基础框架集成测试后,可以继续实施以下任务:

- Task 2.1: 实现后端货物管理API
- Task 2.2: 实现Cargo数据模型类
- Task 2.3: 实现小程序货物录入页面

每个新功能都应该编写相应的单元测试和集成测试,确保代码质量。
