#!/bin/bash

echo "========================================"
echo "甬柜易算 - 后端服务器一键启动"
echo "Ningbo Port Packing System - Backend"
echo "========================================"
echo ""

cd backend

echo "[1/3] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "首次运行，正在安装依赖..."
    npm install
    echo ""
fi

echo "[2/3] 启动服务器..."
echo "监听端口: 3000"
echo "API地址: http://localhost:3000/api"
echo ""

echo "[3/3] 服务器运行中..."
echo "按 Ctrl+C 停止服务器"
echo ""

node server.js
