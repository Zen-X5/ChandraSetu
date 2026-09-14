@echo off
echo Starting ChandraSetu Multi-Service Stack...
docker compose up -d
echo.
echo ============================================================
echo               CHANDRASETU PLATFORM IS ONLINE 🚀
echo ============================================================
echo 🌕 Web Dashboard:     http://localhost:3000
echo ⚙️ API Gateway:       http://localhost:8000/api
echo 👁️ Vision Engine:     http://localhost:8001
echo 🧠 Inference Engine:  http://localhost:8002
echo 📦 MinIO S3 UI:       http://localhost:9001 (minioadmin / minioadmin)
echo ============================================================
echo.
