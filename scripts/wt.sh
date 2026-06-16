#!/usr/bin/env bash
# wt.sh — 多特性并行开发：git worktree + 按端口对隔离运行（monorepo 版）
# 见 CLAUDE.md「多特性并行开发」与 specs/。
#
# 用法：
#   scripts/wt.sh new <slug>        创建 worktree（.worktrees/<slug>，分支 feat/<slug>，从 origin/main 起）
#   scripts/wt.sh impl <spec编号>   按已定稿 spec 开实现 worktree（slug 取自文件名 + spec 置 in-progress）
#   scripts/wt.sh list              列出所有 worktree、分支、端口对(api/web)、是否在跑
#   scripts/wt.sh serve [<slug>]    在专属端口对起 api(wrangler)+web(vite)（缺依赖先 install）
#   scripts/wt.sh restart [<slug>]  只杀该 worktree 端口对的进程后重起（替代无差别 pkill）
#   scripts/wt.sh stop [<slug>]     停掉该 worktree 的 api+web
#   scripts/wt.sh rm <slug>         安全移除 worktree（脏则拒绝，需 --force）
#
# 端口约定：主目录(main) 用 api=8787 / web=5173。
#   worktree 第 k 个：api = 8800 + k*10，web = 5180 + k*10（成对，避开主目录）。
#   端口对记在该 worktree 的 .wt-ports 文件（gitignore），格式：「<api> <web>」。
# 数据隔离：每个 worktree 用独立 DEV_USER_EMAIL（dev+<slug>@deepcard.app），
#   共享同一 Supabase，数据按 userId 天然隔离（见 CLAUDE.md）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WT_DIR="$MAIN_ROOT/.worktrees"
API_BASE=8800   # worktree api 端口起点（主目录 8787）
WEB_BASE=5180   # worktree web 端口起点（主目录 5173）

die() { echo "✗ $*" >&2; exit 1; }

# 读某目录的 .wt-ports（回显「api web」），没有则空
ports_of() {
  local dir="$1"
  [[ -f "$dir/.wt-ports" ]] && cat "$dir/.wt-ports" || true
}
api_port_of() { ports_of "$1" | awk '{print $1}'; }
web_port_of() { ports_of "$1" | awk '{print $2}'; }

# 某端口是否有 LISTEN 进程，回显 PID（空=没在跑）
pid_on_port() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true
}

# 算下一对可用端口：按已有 worktree 数递增，遇占用顺延
next_ports() {
  local k=1
  while :; do
    local api=$((API_BASE + k * 10)) web=$((WEB_BASE + k * 10))
    local clash=""
    if [[ -d "$WT_DIR" ]]; then
      for d in "$WT_DIR"/*/; do
        [[ -f "$d/.wt-ports" ]] || continue
        local p; p="$(cat "$d/.wt-ports")"
        [[ "$(echo "$p" | awk '{print $1}')" == "$api" ]] && clash=1
      done
    fi
    [[ -z "$clash" ]] && { echo "$api $web"; return; }
    k=$((k + 1))
  done
}

current_wt_root() {
  local cwd; cwd="$(pwd)"
  case "$cwd" in
    "$WT_DIR"/*)
      local rel="${cwd#"$WT_DIR"/}"
      echo "$WT_DIR/${rel%%/*}" ;;
    *) true ;;
  esac
}

resolve_root() {
  local slug="${1:-}"
  if [[ -n "$slug" ]]; then
    [[ -d "$WT_DIR/$slug" ]] || die "worktree 不存在: ${slug}（先 wt.sh new $slug）"
    echo "$WT_DIR/$slug"
  else
    local r; r="$(current_wt_root)"
    [[ -n "$r" ]] || die "当前不在某个 worktree 里，请指定 slug（或 cd 进 .worktrees/<slug>）"
    echo "$r"
  fi
}

slug_of_root() { basename "$1"; }

# 起 api(wrangler) + web(vite)。api 注入专属端口 + 隔离的 DEV_USER_EMAIL；web 注入端口对。
_serve() {
  local dir="$1" api="$2" web="$3" slug; slug="$(slug_of_root "$dir")"
  if [[ ! -d "$dir/node_modules" ]]; then
    echo "→ 安装依赖（pnpm install）…"; ( cd "$dir" && pnpm install )
  fi
  local dev_email="dev+${slug}@deepcard.app"
  echo "⚡ serve [$slug]"
  echo "   api(wrangler) → http://localhost:$api   (DEV_USER_EMAIL=$dev_email)"
  echo "   web(vite)     → http://localhost:$web   (proxy /api → $api)"
  # api：wrangler dev 指定端口；用 --var 覆盖 DEV_USER_EMAIL 实现数据隔离
  ( cd "$dir/packages/api" && exec npx wrangler dev --port "$api" \
      --var "DEV_USER_EMAIL:$dev_email" > "$dir/.wt-api.log" 2>&1 ) &
  # web：注入端口对 env，vite.config 读取
  ( cd "$dir/packages/web" && VITE_DEV_PORT="$web" VITE_API_PORT="$api" \
      exec npx vite > "$dir/.wt-web.log" 2>&1 ) &
  echo "→ 已后台启动，日志：$dir/.wt-api.log  /  .wt-web.log"
  echo "   停止：scripts/wt.sh stop $slug"
}

_stop_ports() {
  local api="$1" web="$2"
  for port in "$api" "$web"; do
    local p; p="$(pid_on_port "$port")"
    if [[ -n "$p" ]]; then echo "→ 停端口 $port (pid $p)"; kill "$p" 2>/dev/null || true; fi
  done
  # 等退出
  for _ in 1 2 3 4 5 6; do
    [[ -z "$(pid_on_port "$api")" && -z "$(pid_on_port "$web")" ]] && break
    sleep 0.5
  done
}

_create_worktree() {
  local slug="$1"
  [[ "$slug" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || die "slug 只能用小写字母/数字/.-_，且以字母数字开头"
  [[ ! -d "$WT_DIR/$slug" ]] || die "worktree 已存在: $slug"

  echo "→ 拉取 origin/main 最新…"
  ( cd "$MAIN_ROOT" && git fetch origin main --quiet )

  local branch="feat/$slug"
  echo "→ git worktree add .worktrees/$slug -b $branch origin/main"
  ( cd "$MAIN_ROOT" && git worktree add "$WT_DIR/$slug" -b "$branch" origin/main )

  local pair; pair="$(next_ports)"
  echo "$pair" > "$WT_DIR/$slug/.wt-ports"
  echo "→ 分配端口对: api/web = $pair（已写入 .wt-ports）"

  # 拷贝 worktree 专属 .dev.vars（含真实凭证，gitignore）：从主目录拷，DEV_USER_EMAIL 改成隔离值
  if [[ -f "$MAIN_ROOT/packages/api/.dev.vars" ]]; then
    local dev_email="dev+${slug}@deepcard.app"
    grep -v '^DEV_USER_EMAIL=' "$MAIN_ROOT/packages/api/.dev.vars" > "$WT_DIR/$slug/packages/api/.dev.vars"
    echo "DEV_USER_EMAIL=$dev_email" >> "$WT_DIR/$slug/packages/api/.dev.vars"
    echo "→ 拷贝 .dev.vars（DEV_USER_EMAIL=$dev_email，数据按用户隔离）"
  else
    echo "⚠ 主目录 packages/api/.dev.vars 不存在，worktree 内需自行配置 env"
  fi

  echo "→ 安装依赖（pnpm install）…"
  ( cd "$WT_DIR/$slug" && pnpm install )
}

_print_ready() {
  local slug="$1" extra="${2:-}"
  local pair; pair="$(ports_of "$WT_DIR/$slug")"
  local api web; api="$(echo "$pair" | awk '{print $1}')"; web="$(echo "$pair" | awk '{print $2}')"
  cat <<EOF

✓ worktree 就绪
  目录:   .worktrees/$slug
  分支:   feat/$slug
  端口:   api=$api  web=$web
  数据:   DEV_USER_EMAIL=dev+${slug}@deepcard.app（与 main 数据隔离）
${extra}
  开工：
    cd .worktrees/$slug
    ../../scripts/wt.sh serve          # 后台起 api+web（缺依赖自动 install）
    ../../scripts/wt.sh restart        # 改后端后只重起这对端口
    ../../scripts/wt.sh stop           # 停掉这个 worktree
EOF
}

cmd_new() {
  local slug="${1:-}"
  [[ -n "$slug" ]] || die "用法: wt.sh new <slug>"
  _create_worktree "$slug"
  _print_ready "$slug"
}

cmd_impl() {
  local num="${1:-}"
  [[ -n "$num" ]] || die "用法: wt.sh impl <spec编号>（如 wt.sh impl 001）"
  [[ "$num" =~ ^[0-9]+$ ]] || die "spec 编号需为数字: $num"
  printf -v num '%03d' "$((10#$num))"

  local matches=()
  shopt -s nullglob
  matches=("$MAIN_ROOT"/specs/${num}-*.md)
  shopt -u nullglob
  [[ ${#matches[@]} -gt 0 ]] || die "找不到 spec: specs/${num}-*.md（先在 main 写好 spec 文档）"
  local spec="${matches[0]}"

  local base; base="$(basename "$spec" .md)"
  local slug="${base#${num}-}"

  echo "→ 实现 spec: $spec  →  slug=$slug"
  _create_worktree "$slug"

  local wt_spec="$WT_DIR/$slug/specs/${num}-${slug}.md"
  if [[ -f "$wt_spec" ]]; then
    sed -i.bak -E 's/^(- \*\*状态\*\*: )(proposed|accepted)/\1in-progress/' "$wt_spec" && rm -f "$wt_spec.bak"
    echo "→ 已把 worktree 内 ${num} spec 状态推进到 in-progress"
  fi

  _print_ready "$slug" "  spec:   ${spec}（worktree 内已置 in-progress）"
}

cmd_list() {
  printf "%-22s %-20s %-12s %s\n" "WORKTREE" "BRANCH" "API/WEB" "RUNNING"
  local m_api m_web
  m_api="$([[ -n "$(pid_on_port 8787)" ]] && echo "●" || echo "-")"
  m_web="$([[ -n "$(pid_on_port 5173)" ]] && echo "●" || echo "-")"
  printf "%-22s %-20s %-12s %s\n" "main (此仓库)" "main" "8787/5173" "api:$m_api web:$m_web"
  [[ -d "$WT_DIR" ]] || { echo "(无 worktree)"; return; }
  for d in "$WT_DIR"/*/; do
    [[ -d "$d" ]] || continue
    local slug; slug="$(basename "$d")"
    local branch; branch="$(cd "$d" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    local api web; api="$(api_port_of "$d")"; web="$(web_port_of "$d")"
    local ra rw
    ra="$([[ -n "$api" && -n "$(pid_on_port "$api")" ]] && echo "●" || echo "-")"
    rw="$([[ -n "$web" && -n "$(pid_on_port "$web")" ]] && echo "●" || echo "-")"
    printf "%-22s %-20s %-12s %s\n" "$slug" "$branch" "${api:-?}/${web:-?}" "api:$ra web:$rw"
  done
}

cmd_serve() {
  local root; root="$(resolve_root "${1:-}")"
  local api web; api="$(api_port_of "$root")"; web="$(web_port_of "$root")"
  [[ -n "$api" && -n "$web" ]] || die "$root 缺 .wt-ports"
  [[ -z "$(pid_on_port "$api")" ]] || die "端口 $api 已被占用（用 wt.sh restart 重起）"
  [[ -z "$(pid_on_port "$web")" ]] || die "端口 $web 已被占用（用 wt.sh restart 重起）"
  _serve "$root" "$api" "$web"
}

cmd_restart() {
  local root; root="$(resolve_root "${1:-}")"
  local api web; api="$(api_port_of "$root")"; web="$(web_port_of "$root")"
  [[ -n "$api" && -n "$web" ]] || die "$root 缺 .wt-ports"
  _stop_ports "$api" "$web"
  _serve "$root" "$api" "$web"
}

cmd_stop() {
  local root; root="$(resolve_root "${1:-}")"
  local api web; api="$(api_port_of "$root")"; web="$(web_port_of "$root")"
  [[ -n "$api" && -n "$web" ]] || die "$root 缺 .wt-ports"
  _stop_ports "$api" "$web"
  echo "✓ 已停 [$(slug_of_root "$root")] api=$api web=$web"
}

cmd_rm() {
  local slug="" force=""
  for a in "$@"; do
    case "$a" in
      --force) force=1 ;;
      *) slug="$a" ;;
    esac
  done
  [[ -n "$slug" ]] || die "用法: wt.sh rm <slug> [--force]"
  local root="$WT_DIR/$slug"
  [[ -d "$root" ]] || die "worktree 不存在: $slug"

  # 先停服务
  local api web; api="$(api_port_of "$root")"; web="$(web_port_of "$root")"
  [[ -n "$api" && -n "$web" ]] && _stop_ports "$api" "$web"

  # 干净度检查
  local dirty=""
  ( cd "$root" && git diff --quiet && git diff --cached --quiet ) || dirty="工作区有未提交改动"
  local branch; branch="$(cd "$root" && git rev-parse --abbrev-ref HEAD)"
  local unmerged; unmerged="$(cd "$MAIN_ROOT" && git log --oneline origin/main.."$branch" 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$unmerged" != "0" ]]; then
    dirty="${dirty:+${dirty}；}分支 ${branch} 有 ${unmerged} 个提交未合并到 origin/main"
  fi
  if [[ -n "$dirty" && -z "$force" ]]; then
    die "拒绝移除：${dirty}。确认要丢弃请加 --force"
  fi

  echo "→ git worktree remove --force .worktrees/$slug"
  ( cd "$MAIN_ROOT" && git worktree remove --force "$root" )
  echo "✓ 已移除 worktree ${slug}（分支 ${branch} 仍保留，需要可 git branch -D ${branch}）"
}

usage() {
  sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

case "${1:-}" in
  new)     shift; cmd_new "$@" ;;
  impl)    shift; cmd_impl "$@" ;;
  list|ls) shift; cmd_list "$@" ;;
  serve)   shift; cmd_serve "$@" ;;
  restart) shift; cmd_restart "$@" ;;
  stop)    shift; cmd_stop "$@" ;;
  rm)      shift; cmd_rm "$@" ;;
  ""|-h|--help|help) usage ;;
  *) die "未知子命令: $1（看 wt.sh --help）" ;;
esac
