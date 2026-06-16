#!/usr/bin/env bash
# =============================================================================
# DeepCard 开发环境控制脚本
#
# 用法:
#   ./scripts/dev.sh [客户端...] [选项]
#
# 客户端 (可组合):
#   api,  a      后端 Hono on Cloudflare Workers (wrangler, :8787)
#   web,  w      前端 Vite + React (:5173, proxy /api → 8787)
#   all          api + web (默认)
#   mcp          MCP server (规划中, 见 docs/DEV-PLAN.md F-06) —— 暂未实现
#   ext          浏览器扩展 (规划中, F-09) —— 暂未实现
#
# 选项:
#   --db            起服务前先 pnpm db:push（同步 schema 到 Supabase）
#   --no-open       不自动打开浏览器（默认起 web 后会尝试打开 :5173）
#   --bg            全部后台运行（不阻塞终端，日志写文件）
#   --help, -h      显示帮助
#
# 子命令:
#   status, s       查看各服务端口/进程状态
#   logs [name]     跟踪日志 (api/web，省略则全部)
#   stop            停止所有本项目开发进程（仅主目录端口 8787/5173）
#
# 示例:
#   ./scripts/dev.sh                 # api + web，前台（最常用）
#   ./scripts/dev.sh api             # 只起后端
#   ./scripts/dev.sh web             # 只起前端
#   ./scripts/dev.sh all --db        # 先 db:push 再起 api+web
#   ./scripts/dev.sh --bg            # 全后台，立即返回
#   ./scripts/dev.sh status          # 看状态
#   ./scripts/dev.sh logs api        # 跟踪后端日志
#   ./scripts/dev.sh stop            # 停掉主目录的 api+web
#
# 与并行开发的关系：本脚本管「主目录」(端口 8787/5173)。
#   多特性并行请用 scripts/wt.sh（每个 worktree 独立端口对），两者互不干扰。
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT=8787
WEB_PORT=5173
LOG_DIR="/tmp/deepcard-dev"
mkdir -p "$LOG_DIR"

# Colors
GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${BLUE}→${NC} $1"; }
ok()      { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}!${NC} $1"; }
err()     { echo -e "${RED}✗${NC} $1"; }

pid_on_port() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
kill_port()   { local p; p="$(pid_on_port "$1")"; [[ -n "$p" ]] && { kill "$p" 2>/dev/null || true; sleep 1; [[ -n "$(pid_on_port "$1")" ]] && kill -9 "$p" 2>/dev/null || true; } || true; }

# =============================================================================
# 子命令：status / logs / stop
# =============================================================================
show_status() {
  echo ""
  echo -e "${BLUE}=== DeepCard 开发服务状态（主目录）===${NC}"
  echo ""
  local api_pid web_pid; api_pid="$(pid_on_port "$API_PORT")"; web_pid="$(pid_on_port "$WEB_PORT")"
  if [[ -n "$api_pid" ]]; then
    ok "api  (wrangler) 运行中  http://localhost:${API_PORT}  (pid $api_pid)"
    if curl -s -m 3 "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
      ok "     health: OK"
    else
      warn "     health: 未响应（可能还在启动）"
    fi
  else
    err "api  未运行  (端口 ${API_PORT} 空闲)"
  fi
  if [[ -n "$web_pid" ]]; then
    ok "web  (vite)     运行中  http://localhost:${WEB_PORT}  (pid $web_pid)"
  else
    err "web  未运行  (端口 ${WEB_PORT} 空闲)"
  fi
  echo ""
  echo -e "${BLUE}=== 日志 ===${NC}"
  echo "  目录: $LOG_DIR/"
  ls -la "$LOG_DIR"/*.log 2>/dev/null | awk '{print "    " $NF " (" $5 "B)"}' || echo "    (暂无)"
  echo ""
  echo -e "${BLUE}=== 并行开发 worktree ===${NC}"
  if [[ -x "$ROOT_DIR/scripts/wt.sh" ]]; then
    "$ROOT_DIR/scripts/wt.sh" list 2>/dev/null | sed 's/^/  /' || true
  fi
  echo ""
}

show_logs() {
  local name="${1:-}"
  if [[ -z "$name" ]]; then
    info "跟踪所有日志（Ctrl+C 退出）"; echo ""
    tail -f "$LOG_DIR"/*.log 2>/dev/null || { warn "暂无日志"; exit 0; }
  else
    local f="$LOG_DIR/${name}.log"
    [[ -f "$f" ]] || { err "未找到 $f"; echo "可用："; ls "$LOG_DIR"/*.log 2>/dev/null || echo "  (无)"; exit 1; }
    info "跟踪 $f（Ctrl+C 退出）"; echo ""
    tail -f "$f"
  fi
}

stop_all() {
  info "停止主目录开发进程（端口 ${API_PORT} / ${WEB_PORT}）…"
  kill_port "$API_PORT"
  kill_port "$WEB_PORT"
  # 兜底清残留的 wrangler/workerd/vite（仅主目录场景；worktree 用 wt.sh stop）
  ok "已停止 api + web"
  warn "注：worktree 的服务请用 scripts/wt.sh stop <slug>"
}

# =============================================================================
# 数据库准备（--db）
# =============================================================================
prepare_db() {
  info "同步数据库 schema 到 Supabase（pnpm db:push）…"
  if pnpm db:push 2>&1 | tail -5; then
    ok "db:push 完成"
  else
    warn "db:push 失败（schema 可能已存在或连接问题），继续启动"
  fi
}

# =============================================================================
# 启动函数
# =============================================================================
# bg 模式：提示打到 stderr，只把 PID echo 到 stdout（供 $(...) 捕获）
start_api() {  # $1 = bg|fg
  local mode="$1" log="$LOG_DIR/api.log"
  if [[ -n "$(pid_on_port "$API_PORT")" ]]; then
    warn "端口 ${API_PORT} 已占用，跳过 api 启动（用 ./scripts/dev.sh stop 先停）" >&2
    return 0
  fi
  info "api  → http://localhost:${API_PORT}   ($log)" >&2
  echo "=== api started $(date) ===" > "$log"
  if [[ "$mode" == "bg" ]]; then
    ( pnpm dev:api >> "$log" 2>&1 ) &
    echo $!
  else
    pnpm dev:api 2>&1 | tee -a "$log"
  fi
}

start_web() {  # $1 = bg|fg
  local mode="$1" log="$LOG_DIR/web.log"
  if [[ -n "$(pid_on_port "$WEB_PORT")" ]]; then
    warn "端口 ${WEB_PORT} 已占用，跳过 web 启动" >&2
    return 0
  fi
  info "web  → http://localhost:${WEB_PORT}   ($log)" >&2
  echo "=== web started $(date) ===" > "$log"
  if [[ "$mode" == "bg" ]]; then
    ( pnpm dev:web >> "$log" 2>&1 ) &
    echo $!
  else
    pnpm dev:web 2>&1 | tee -a "$log"
  fi
}

open_browser() {
  if command -v open >/dev/null 2>&1; then
    ( sleep 3; open "http://localhost:${WEB_PORT}" >/dev/null 2>&1 || true ) &
  fi
}

# =============================================================================
# 帮助
# =============================================================================
show_help() { sed -n '2,52p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

# =============================================================================
# 解析参数
# =============================================================================
CLIENTS=()
OPT_DB=""; OPT_NO_OPEN=""; OPT_BG=""

for arg in "$@"; do
  case "$arg" in
    --help|-h) show_help; exit 0 ;;
    --db)      OPT_DB=1 ;;
    --no-open) OPT_NO_OPEN=1 ;;
    --bg)      OPT_BG=1 ;;
    status|s)  show_status; exit 0 ;;
    logs|l)    shift || true; show_logs "${1:-}"; exit 0 ;;
    stop)      stop_all; exit 0 ;;
    api|a)     CLIENTS+=("api") ;;
    web|w)     CLIENTS+=("web") ;;
    all)       CLIENTS=("api" "web") ;;
    mcp)       err "mcp 客户端尚未实现（见 docs/DEV-PLAN.md F-06）"; exit 1 ;;
    ext|e)     err "ext 客户端尚未实现（见 docs/DEV-PLAN.md F-09）"; exit 1 ;;
    -*)        err "未知选项: $arg（--help 查看帮助）"; exit 1 ;;
    *)         err "未知参数: $arg（--help 查看帮助）"; exit 1 ;;
  esac
done

# 默认 all
[[ ${#CLIENTS[@]} -eq 0 ]] && CLIENTS=("api" "web")

# 去重（保持 api 在 web 前，便于 proxy）
HAS_API=""; HAS_WEB=""
for c in "${CLIENTS[@]}"; do
  [[ "$c" == "api" ]] && HAS_API=1
  [[ "$c" == "web" ]] && HAS_WEB=1
done

echo -e "${GREEN}=== DeepCard 开发环境 ===${NC}"
echo -e "客户端: ${CYAN}${CLIENTS[*]}${NC}"
echo -e "日志:   $LOG_DIR/"
echo ""

[[ -n "$OPT_DB" ]] && { prepare_db; echo ""; }

PIDS=()
cleanup() { echo ""; info "正在停止…"; for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; exit 0; }
trap cleanup INT TERM

# 全后台模式
if [[ -n "$OPT_BG" ]]; then
  [[ -n "$HAS_API" ]] && { p=$(start_api bg); PIDS+=("$p"); }
  [[ -n "$HAS_WEB" ]] && { p=$(start_web bg); PIDS+=("$p"); }
  [[ -n "$HAS_WEB" && -z "$OPT_NO_OPEN" ]] && open_browser
  echo ""
  ok "已后台启动: ${CLIENTS[*]}  (pids: ${PIDS[*]:-none})"
  info "查看状态: ./scripts/dev.sh status    跟踪日志: ./scripts/dev.sh logs"
  info "停止:     ./scripts/dev.sh stop"
  exit 0
fi

# 前台模式：单客户端直接前台；多客户端则 api 后台 + web 前台
if [[ ${#CLIENTS[@]} -eq 1 ]]; then
  [[ -n "$HAS_API" ]] && start_api fg
  [[ -n "$HAS_WEB" ]] && { [[ -z "$OPT_NO_OPEN" ]] && open_browser; start_web fg; }
  exit 0
fi

# api + web：api 后台，web 前台（这样能看到 vite 输出 + Ctrl+C 一起退）
if [[ -n "$HAS_API" ]]; then
  p=$(start_api bg); PIDS+=("$p")
  info "等待 api 就绪…"; sleep 4
fi
[[ -z "$OPT_NO_OPEN" ]] && open_browser
if [[ -n "$HAS_WEB" ]]; then
  start_web fg
fi
cleanup
