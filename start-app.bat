@echo off
echo ============================================
echo   STB Security - Starting Application
echo ============================================
echo.

:: Check if node_modules exist, install if needed
if not exist "backend\node_modules" (
    echo [1/2] Installing backend dependencies...
    cd backend
    call npm install
    cd ..
) else (
    echo [OK] Backend dependencies already installed.
)

if not exist "frontend\node_modules" (
    echo [2/2] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
) else (
    echo [OK] Frontend dependencies already installed.
)

echo.
echo Starting backend and frontend in separate windows...
echo.

:: Start backend in a new window
start "STB Backend" cmd /k "cd backend && npm run dev"

:: Start frontend in a new window
start "STB Frontend" cmd /k "cd frontend && npm start"

echo ============================================
echo   Backend  -> http://localhost:3000
echo   Frontend -> http://localhost:4200
echo ============================================
echo.
echo Both servers are starting in separate windows.
echo Close this window or press any key to exit.
pause >nul