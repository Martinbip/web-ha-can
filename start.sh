#!/bin/bash

# ============================================
#  Đá Hà Cần - Development Server Startup
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
CMS_DIR="$PROJECT_DIR/dha-cms"
CMS_PORT=1337
FRONTEND_PORT=3000

# Cleanup khi thoát
cleanup() {
    echo ""
    echo -e "${YELLOW}⏹  Đang dừng tất cả server...${NC}"
    if [ -n "$CMS_PID" ] && kill -0 "$CMS_PID" 2>/dev/null; then
        kill "$CMS_PID" 2>/dev/null
        wait "$CMS_PID" 2>/dev/null
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
        wait "$FRONTEND_PID" 2>/dev/null
    fi
    echo -e "${GREEN}✔  Đã dừng tất cả server.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# Tự động kill process đang chiếm port
free_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}⚠  Port $port ($name) đang bị chiếm. Đang giải phóng...${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null
        sleep 1
        echo -e "${GREEN}  ✔  Đã giải phóng port $port.${NC}"
    fi
}

# Kiểm tra node_modules CMS
check_cms_deps() {
    if [ ! -d "$CMS_DIR/node_modules" ]; then
        echo -e "${YELLOW}📦 Chưa cài dependencies cho CMS. Đang chạy npm install...${NC}"
        (cd "$CMS_DIR" && npm install)
        if [ $? -ne 0 ]; then
            echo -e "${RED}✘  npm install thất bại!${NC}"
            exit 1
        fi
        echo -e "${GREEN}✔  Cài dependencies xong.${NC}"
    fi
}

# ── Header ──
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     🪨  DHA MINERALS - Dev Server        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Giải phóng ports ──
echo -e "${CYAN}[1/4]${NC} Kiểm tra & giải phóng ports..."
free_port $CMS_PORT "Strapi CMS"
free_port $FRONTEND_PORT "Frontend"
echo -e "${GREEN}  ✔  Ports $CMS_PORT & $FRONTEND_PORT sẵn sàng.${NC}"

echo -e "${CYAN}[2/4]${NC} Kiểm tra dependencies CMS..."
check_cms_deps

# ── Khởi động Strapi CMS ──
echo -e "${CYAN}[3/4]${NC} Khởi động Strapi CMS (port $CMS_PORT)..."
(cd "$CMS_DIR" && npm run dev) &
CMS_PID=$!

# Đợi Strapi sẵn sàng
echo -ne "       Đang chờ Strapi khởi động"
for i in $(seq 1 30); do
    if curl -s "http://localhost:$CMS_PORT" >/dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}  ✔  Strapi CMS đã sẵn sàng!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# ── Khởi động Frontend ──
echo -e "${CYAN}[4/4]${NC} Khởi động Frontend server (port $FRONTEND_PORT)..."
npx -y serve -l $FRONTEND_PORT "$PROJECT_DIR" &
FRONTEND_PID=$!
sleep 2

# ── Tổng kết ──
echo ""
echo -e "${BOLD}┌──────────────────────────────────────────┐${NC}"
echo -e "${BOLD}│${NC}  ${GREEN}✔${NC}  Tất cả server đã khởi động!           ${BOLD}│${NC}"
echo -e "${BOLD}├──────────────────────────────────────────┤${NC}"
echo -e "${BOLD}│${NC}                                          ${BOLD}│${NC}"
echo -e "${BOLD}│${NC}  🌐 Frontend:  ${CYAN}http://localhost:$FRONTEND_PORT${NC}     ${BOLD}│${NC}"
echo -e "${BOLD}│${NC}  ⚙️  Strapi:    ${CYAN}http://localhost:$CMS_PORT${NC}      ${BOLD}│${NC}"
echo -e "${BOLD}│${NC}  🔧 Admin:     ${CYAN}http://localhost:$CMS_PORT/admin${NC} ${BOLD}│${NC}"
echo -e "${BOLD}│${NC}                                          ${BOLD}│${NC}"
echo -e "${BOLD}│${NC}  Nhấn ${YELLOW}Ctrl+C${NC} để dừng tất cả server.     ${BOLD}│${NC}"
echo -e "${BOLD}└──────────────────────────────────────────┘${NC}"
echo ""

# Chờ cả 2 process
wait
