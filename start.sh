#!/bin/bash

# ============================================
#  DHA - Development Server Startup
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$PROJECT_DIR/dha-api"
API_PORT=1337
FRONTEND_PORT=3000

# Ưu tiên Node cài qua nvm nếu có (dha-api cần Node >= 22.12: @sanity/client 8).
for node_dir in "$HOME"/.nvm/versions/node/v24* "$HOME"/.nvm/versions/node/v22*; do
    if [ -x "$node_dir/bin/node" ] && [ -x "$node_dir/bin/npm" ]; then
        export PATH="$node_dir/bin:$PATH"
        break
    fi
done

# Cleanup khi thoát
cleanup() {
    echo ""
    echo -e "${YELLOW}⏹  Đang dừng tất cả server...${NC}"
    if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
        kill "$API_PID" 2>/dev/null
        wait "$API_PID" 2>/dev/null
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
        wait "$FRONTEND_PID" 2>/dev/null
    fi
    echo -e "${GREEN}✔  Đã dừng tất cả server.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# Báo port đang bị chiếm; chỉ dừng tiến trình khi được cho phép rõ ràng.
free_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}⚠  Port $port ($name) đang bị chiếm bởi PID: $pids${NC}"
        if [ "$DHA_AUTO_FREE_PORTS" = "1" ]; then
            echo -e "${YELLOW}   DHA_AUTO_FREE_PORTS=1 → gửi tín hiệu dừng nhẹ...${NC}"
            echo "$pids" | xargs kill 2>/dev/null
            sleep 2
            if lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
                echo -e "${RED}✘  Port $port vẫn đang bị chiếm. Hãy dừng process đó thủ công rồi chạy lại.${NC}"
                exit 1
            fi
            echo -e "${GREEN}  ✔  Đã giải phóng port $port.${NC}"
        else
            echo -e "${RED}✘  Hãy dừng process đang dùng port $port hoặc chạy DHA_AUTO_FREE_PORTS=1 ./start.sh${NC}"
            exit 1
        fi
    fi
}

check_api_setup() {
    if [ ! -d "$API_DIR/node_modules" ]; then
        echo -e "${YELLOW}📦 Chưa cài dependencies cho dha-api. Đang chạy npm install...${NC}"
        if ! (cd "$API_DIR" && npm install); then
            echo -e "${RED}✘  npm install thất bại!${NC}"
            exit 1
        fi
        echo -e "${GREEN}✔  Cài dependencies xong.${NC}"
    fi
    if [ ! -f "$API_DIR/.env" ]; then
        echo -e "${RED}✘  Thiếu dha-api/.env. Chép dha-api/.env.example rồi điền SANITY_* (dataset development) và ADMIN_UI_SESSION_SECRET.${NC}"
        exit 1
    fi
}

# ── Header ──
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     🪨  DHA MINERALS - Dev Server        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}[1/4]${NC} Kiểm tra & giải phóng ports..."
free_port $API_PORT "dha-api"
free_port $FRONTEND_PORT "Frontend"
echo -e "${GREEN}  ✔  Ports $API_PORT & $FRONTEND_PORT sẵn sàng.${NC}"

echo -e "${CYAN}[2/4]${NC} Kiểm tra dha-api..."
check_api_setup

echo -e "${CYAN}[3/4]${NC} Khởi động dha-api (port $API_PORT)..."
(cd "$API_DIR" && npm run dev) &
API_PID=$!

echo -ne "       Đang chờ dha-api khởi động"
for i in $(seq 1 30); do
    if curl -s "http://localhost:$API_PORT/api/site-setting" >/dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}  ✔  dha-api đã sẵn sàng!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo -e "${CYAN}[4/4]${NC} Khởi động Frontend server (port $FRONTEND_PORT)..."
npx -y serve -l $FRONTEND_PORT "$PROJECT_DIR" &
FRONTEND_PID=$!
sleep 2

echo ""
echo -e "${BOLD}┌──────────────────────────────────────────┐${NC}"
echo -e "${BOLD}│${NC}  ${GREEN}✔${NC}  Tất cả server đã khởi động!           ${BOLD}│${NC}"
echo -e "${BOLD}├──────────────────────────────────────────┤${NC}"
echo -e "${BOLD}│${NC}  🌐 Frontend:  ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
echo -e "${BOLD}│${NC}  ⚙️  API:       ${CYAN}http://localhost:$API_PORT/api${NC}"
echo -e "${BOLD}│${NC}  🛠️  Admin:     ${CYAN}http://localhost:5173${NC} (chạy riêng: npm run admin:dev)"
echo -e "${BOLD}│${NC}  Nhấn ${YELLOW}Ctrl+C${NC} để dừng tất cả server."
echo -e "${BOLD}└──────────────────────────────────────────┘${NC}"
echo ""

wait
