#!/bin/bash

# 甬柜易算 - 停止所有服务脚本

echo "=========================================="
echo "  停止甬柜易算服务"
echo "=========================================="
echo ""

# 检查 PID 文件是否存在
if [ -f "backend.pid" ]; then
    BACKEND_PID=$(cat backend.pid)
    
    # 检查进程是否存在
    if ps -p $BACKEND_PID > /dev/null; then
        echo "🛑 正在停止后端服务器 (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        
        # 等待进程结束
        sleep 2
        
        # 检查是否成功停止
        if ps -p $BACKEND_PID > /dev/null; then
            echo "⚠️  进程未响应，强制停止..."
            kill -9 $BACKEND_PID
        fi
        
        echo "✅ 后端服务器已停止"
        rm backend.pid
    else
        echo "⚠️  后端服务器进程不存在 (PID: $BACKEND_PID)"
        rm backend.pid
    fi
else
    echo "⚠️  未找到 backend.pid 文件"
    echo "尝试查找并停止所有 node server.js 进程..."
    
    # 查找所有相关进程
    PIDS=$(ps aux | grep "node.*server.js" | grep -v grep | awk '{print $2}')
    
    if [ -z "$PIDS" ]; then
        echo "✅ 没有找到运行中的后端服务器"
    else
        echo "找到以下进程:"
        ps aux | grep "node.*server.js" | grep -v grep
        echo ""
        echo "正在停止这些进程..."
        echo $PIDS | xargs kill
        echo "✅ 所有后端服务器已停止"
    fi
fi

echo ""
echo "=========================================="
echo "  所有服务已停止"
echo "=========================================="
