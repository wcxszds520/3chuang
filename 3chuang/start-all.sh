#!/bin/bash

# 甬柜易算 - 一键启动脚本
# 用于同时启动后端服务器和前端小程序

echo "=========================================="
echo "  甬柜易算 - 宁波港智能装箱系统 v34.0"
echo "=========================================="
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo ""

# 检查后端目录
if [ ! -d "backend" ]; then
    echo "❌ 错误: backend 目录不存在"
    exit 1
fi

# 检查后端依赖
if [ ! -d "backend/node_modules" ]; then
    echo "📦 正在安装后端依赖..."
    cd backend
    npm install
    cd ..
    echo "✅ 后端依赖安装完成"
    echo ""
fi

# 检查 .env 文件
if [ ! -f "backend/.env" ]; then
    echo "⚠️  警告: backend/.env 文件不存在"
    echo "正在从 .env.example 创建..."
    cp backend/.env.example backend/.env
    echo "✅ 已创建 backend/.env 文件"
    echo "⚠️  请编辑 backend/.env 文件，配置数据库连接信息"
    echo ""
fi

# 启动后端服务器
echo "🚀 正在启动后端服务器..."
cd backend

# 使用 nohup 在后台运行
nohup npm start > ../backend.log 2>&1 &
BACKEND_PID=$!

cd ..

# 等待后端启动
echo "⏳ 等待后端服务器启动..."
sleep 3

# 检查后端是否启动成功
if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ 后端服务器启动成功 (PID: $BACKEND_PID)"
    echo "📝 日志文件: backend.log"
    echo "🌐 API 地址: http://localhost:3000/api"
else
    echo "❌ 后端服务器启动失败"
    echo "请查看 backend.log 文件获取详细错误信息"
    exit 1
fi

echo ""
echo "=========================================="
echo "  启动完成！"
echo "=========================================="
echo ""
echo "📋 下一步操作:"
echo "1. 打开微信开发者工具"
echo "2. 导入项目，选择 miniprogram 目录"
echo "3. 点击"编译"按钮启动小程序"
echo ""
echo "🔧 管理命令:"
echo "  查看后端日志: tail -f backend.log"
echo "  停止后端服务: kill $BACKEND_PID"
echo "  重启后端服务: ./restart-backend.sh"
echo ""
echo "📞 如遇问题，请查看部署指南: v34.0-生产部署完整指南.md"
echo ""

# 保存 PID 到文件
echo $BACKEND_PID > backend.pid
echo "💾 后端进程 PID 已保存到 backend.pid"
