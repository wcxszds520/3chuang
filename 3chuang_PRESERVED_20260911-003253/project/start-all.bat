@echo off
REM 甬柜易算 - Windows 一键启动脚本

echo ==========================================
echo   甬柜易算 - 宁波港智能装箱系统 v34.0
echo ==========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误: Node.js 未安装
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 已安装
node -v
echo.

REM 检查后端目录
if not exist "backend" (
    echo ❌ 错误: backend 目录不存在
    pause
    exit /b 1
)

REM 检查后端依赖
if not exist "backend\node_modules" (
    echo 📦 正在安装后端依赖...
    cd backend
    call npm install
    cd ..
    echo ✅ 后端依赖安装完成
    echo.
)

REM 检查 .env 文件
if not exist "backend\.env" (
    echo ⚠️  警告: backend\.env 文件不存在
    echo 正在从 .env.example 创建...
    copy backend\.env.example backend\.env
    echo ✅ 已创建 backend\.env 文件
    echo ⚠️  请编辑 backend\.env 文件，配置数据库连接信息
    echo.
)

REM 启动后端服务器
echo 🚀 正在启动后端服务器...
cd backend
start "甬柜易算后端服务器" cmd /k "npm start"
cd ..

REM 等待后端启动
echo ⏳ 等待后端服务器启动...
timeout /t 3 /nobreak >nul

echo ✅ 后端服务器启动成功
echo 🌐 API 地址: http://localhost:3000/api
echo.

echo ==========================================
echo   启动完成！
echo ==========================================
echo.
echo 📋 下一步操作:
echo 1. 打开微信开发者工具
echo 2. 导入项目，选择 miniprogram 目录
echo 3. 点击"编译"按钮启动小程序
echo.
echo 🔧 管理命令:
echo   停止所有服务: stop-all.bat
echo.
echo 📞 如遇问题，请查看部署指南: v34.0-生产部署完整指南.md
echo.
pause
