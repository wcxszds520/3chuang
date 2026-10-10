@echo off
REM 甬柜易算 - Windows 停止所有服务脚本

echo ==========================================
echo   停止甬柜易算服务
echo ==========================================
echo.

echo 🛑 正在停止后端服务器...

REM 查找并停止所有 node.exe 进程（运行 server.js）
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo 找到 Node.js 进程，正在停止...
    taskkill /F /IM node.exe /T >NUL 2>&1
    echo ✅ 后端服务器已停止
) else (
    echo ⚠️  没有找到运行中的后端服务器
)

echo.
echo ==========================================
echo   所有服务已停止
echo ==========================================
echo.
pause
