# 甬柜易算后端服务

宁波港智能3D装箱小程序MVP - 后端服务

## 项目结构

```
backend/
├── config/           # 配置文件目录
│   └── database.js   # 数据库连接配置
├── middleware/       # 中间件目录
│   ├── response.js   # 统一响应格式中间件
│   └── errorHandler.js  # 全局错误处理中间件
├── routes/          # 路由目录
│   └── index.js     # 路由总入口
├── services/        # 业务服务层目录
├── models/          # 数据模型层目录
├── utils/           # 工具函数目录
├── server.js        # 服务器主入口
├── package.json     # 项目依赖配置
└── .env.example     # 环境变量示例文件
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 文件为 `.env`，并修改数据库配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ningbo_port_packing
PORT=3000
NODE_ENV=development
```

### 3. 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务启动后访问：
- API根路径: http://localhost:3000/api
- 健康检查: http://localhost:3000/api/health

## API响应格式

所有API接口返回统一的JSON格式：

### 成功响应

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    // 响应数据
  }
}
```

### 错误响应

```json
{
  "code": 400,
  "message": "错误描述",
  "data": null
}
```

## 状态码说明

- `200`: 操作成功
- `400`: 请求参数错误
- `404`: 接口不存在
- `500`: 服务器内部错误

## 中间件说明

### 1. 统一响应格式中间件 (response.js)

为所有路由提供统一的响应方法：

```javascript
// 成功响应
res.success(data, message);

// 错误响应
res.error(message, code);
```

### 2. 全局错误处理中间件 (errorHandler.js)

自动捕获所有未处理的异常，返回友好的错误信息：

- 数据库错误自动识别和转换
- 开发环境返回详细错误堆栈
- 生产环境返回安全的错误信息

## 数据库连接

使用MySQL连接池管理数据库连接，支持以下特性：

- 自动重连
- 连接池复用
- Promise/async-await支持
- 启动时自动测试连接

## 开发注意事项

1. 所有代码必须添加详尽的中文注释
2. 遵循统一的响应格式规范
3. 使用async/await处理异步操作
4. 错误处理使用try-catch包裹
5. 避免过度封装，保持代码简洁清晰

## 后续开发

当前框架已完成基础搭建，后续任务将添加：

- 货物管理接口 (routes/cargo.js)
- 柜型管理接口 (routes/container.js)
- 装箱方案接口 (routes/packing.js)
- 业务服务层 (services/)
- 数据模型层 (models/)
- 工具函数 (utils/)
