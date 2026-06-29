@echo off
chcp 65001 >nul
setlocal

rem ===== 切到脚本所在目录（双击运行时当前目录不可靠）=====
cd /d "%~dp0"

echo ========================================
echo    万历：山河崩塌  -  一键启动
echo ========================================
echo.

rem ===== 1. 检测 Node.js =====
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js。
    echo 请先安装 Node.js 18 或更高版本：https://nodejs.org/
    echo.
    pause
    exit /b 1
)

rem ===== 2. 首次启动自动安装依赖 =====
if not exist "node_modules" (
    echo [首次启动] 未检测到依赖，正在执行 npm install ...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败，请检查网络或上方错误信息后重试。
        pause
        exit /b 1
    )
    echo.
    echo [完成] 依赖安装成功。
    echo.
)

rem ===== 3. 启动 Vite 开发服务器并自动打开浏览器 =====
echo [启动] Vite 开发服务器，首次编译需几秒 ...
echo [提示] 浏览器将自动打开游戏页面（默认 http://localhost:5173 ）
echo [退出] 直接关闭本窗口即停止服务。
echo.
call npm run dev -- --open

rem ===== dev server 退出后停留，便于查看错误 =====
echo.
echo [已停止] 开发服务器已退出。
pause
