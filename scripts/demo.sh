#!/usr/bin/env bash
# demo.sh — starts the CI server, creates a long-running workflow, and
#            streams live SSE events to the terminal until the run completes.
set -euo pipefail

# ── config ──────────────────────────────────────────────────────────────────
PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}"
DB_FILE="/tmp/ci-demo-$$.db"   # isolated DB per run; cleaned up on exit

# ── colours ─────────────────────────────────────────────────────────────────
BOLD='\033[1m'; DIM='\033[2m'
GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; BLUE='\033[0;34m'
NC='\033[0m'

section() { echo -e "\n${BOLD}${BLUE}▶ $*${NC}"; }
ok()      { echo -e "  ${GREEN}✔${NC}  $*"; }
info()    { echo -e "  ${CYAN}→${NC}  $*"; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $*"; }
die()     { echo -e "  ${RED}✖${NC}  $*" >&2; exit 1; }

# pretty-print JSON if jq is available, otherwise raw
pjson() { command -v jq &>/dev/null && jq -C '.' <<< "$1" || echo "$1"; }

# ── cleanup ──────────────────────────────────────────────────────────────────
SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    info "Stopping server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$DB_FILE"
}
trap cleanup EXIT INT TERM

# ── 1. start server ──────────────────────────────────────────────────────────
section "Starting CI server"

DB_PATH="$DB_FILE" PORT="$PORT" npx tsx server.ts &>/tmp/ci-demo-server.log &
SERVER_PID=$!
info "Server PID: $SERVER_PID  |  log: /tmp/ci-demo-server.log"

# wait until /health responds (up to 20 s)
for i in $(seq 1 20); do
  if curl -sf "${BASE_URL}/health" > /dev/null 2>&1; then
    ok "Server ready at ${BASE_URL}"
    break
  fi
  if [[ $i -eq 20 ]]; then
    warn "Server logs:"
    tail -20 /tmp/ci-demo-server.log >&2
    die "Server did not become ready within 20 s"
  fi
  sleep 1
done

# ── 2. create workflow ────────────────────────────────────────────────────────
section "Creating long-running workflow"

PAYLOAD=$(cat <<'JSON'
{
  "name": "Long-running Demo Pipeline",
  "event": "push",
  "projectId": "demo-project",
  "jobs": [
    {
      "name": "setup",
      "steps": [
        {
          "name": "install-deps",
          "type": "shell",
          "command": "echo '[ setup ] Installing dependencies...' && for i in $(seq 1 35); do printf '.'; sleep 1; done && echo '' && echo '[ setup ] Dependencies installed'"
        },
        {
          "name": "lint",
          "type": "shell",
          "command": "echo '[ setup ] Running linter...' && for i in $(seq 1 32); do printf '.'; sleep 1; done && echo '' && echo '[ setup ] Lint passed'"
        }
      ]
    },
    {
      "name": "build",
      "steps": [
        {
          "name": "compile",
          "type": "shell",
          "command": "echo '[ build ] Compiling sources...' && for i in $(seq 1 33); do printf '.'; sleep 1; done && echo '' && echo '[ build ] Compilation done'"
        }
      ]
    },
    {
      "name": "test",
      "steps": [
        {
          "name": "unit-tests",
          "type": "shell",
          "command": "echo '[ test  ] Running unit tests...' && for i in $(seq 1 30); do printf '.'; sleep 1; done && echo '' && echo '[ test  ] All tests passed'"
        }
      ]
    }
  ]
}
JSON
)

WORKFLOW_JSON=$(curl -sf -X POST "${BASE_URL}/workflows" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD") || die "Failed to create workflow"

WORKFLOW_ID=$(echo "$WORKFLOW_JSON" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[[ -n "$WORKFLOW_ID" ]] || die "Could not parse workflow id from response"

ok "Workflow created: ${BOLD}${WORKFLOW_ID}${NC}"
info "4 steps across 3 jobs — each step takes 30-35 seconds"

# ── 3. trigger run ────────────────────────────────────────────────────────────
section "Triggering run"

RUN_JSON=$(curl -sf -X POST "${BASE_URL}/workflows/${WORKFLOW_ID}/run") \
  || die "Failed to trigger run"

RUN_ID=$(echo "$RUN_JSON" | grep -o '"runId":"[^"]*"' | cut -d'"' -f4)
[[ -n "$RUN_ID" ]] || die "Could not parse runId from response"

ok "Run started: ${BOLD}${RUN_ID}${NC}"

# ── 4. stream live events ─────────────────────────────────────────────────────
section "Streaming live events  ${DIM}(Ctrl-C to abort)${NC}"
echo ""

# Use awk to parse the SSE stream.
# Each SSE message is:
#   event: <type>\n
#   data: <json>\n
#   \n
#
# awk accumulates (event, data) pairs and prints a formatted line per message.
# It exits (closing the curl pipe) when run:complete is received.

FINAL_STATUS=""

curl -N -s -H "Accept: text/event-stream" \
  "${BASE_URL}/workflows/${RUN_ID}/events" \
| awk \
    -v bold="$BOLD" -v nc="$NC" \
    -v green="$GREEN" -v yellow="$YELLOW" -v red="$RED" -v cyan="$CYAN" \
    -v dim="$DIM" \
'
function ts(    cmd, result) {
  cmd = "date +%H:%M:%S"
  cmd | getline result
  close(cmd)
  return result
}
function colour(status) {
  if (status == "success") return green
  if (status == "running") return cyan
  if (status == "failed")  return red
  return yellow
}
/^event:/ {
  event = substr($0, 8)   # strip "event: "
  next
}
/^data:/ {
  data = substr($0, 7)    # strip "data: "

  # extract "status" field
  match(data, /"status":"([^"]+)"/, arr)
  status = arr[1]

  # extract "type" field (node:status events)
  match(data, /"type":"([^"]+)"/, tarr)
  ntype = tarr[1]

  # extract "id" field
  match(data, /"id":"([^"]+)"/, idarr)
  nid = idarr[1]

  t = ts()

  if (event == "node:status") {
    col = colour(status)
    printf "  %s[%s]%s  %-10s  %s%-8s%s  %s\n", \
      dim, t, nc,  ntype,  col, status, nc,  nid
  } else if (event == "run:complete") {
    printf "\n  %s[%s]%s  %srun:complete%s  status=%s%s%s\n", \
      dim, t, nc,  bold, nc,  colour(status), status, nc
    fflush()
    exit 0
  } else {
    printf "  %s[%s]%s  %s  %s\n", dim, t, nc, event, data
  }
  fflush()
  next
}
' || true  # curl exits non-zero when awk closes the pipe early; that is expected

# ── 5. final status ───────────────────────────────────────────────────────────
section "Final workflow status"

STATUS_JSON=$(curl -sf "${BASE_URL}/workflows/${WORKFLOW_ID}/status") \
  || die "Failed to fetch final status"

FINAL=$(echo "$STATUS_JSON" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

echo ""
pjson "$STATUS_JSON"
echo ""

if [[ "$FINAL" == "success" ]]; then
  ok "${GREEN}${BOLD}Pipeline succeeded${NC}"
elif [[ "$FINAL" == "failed" ]]; then
  warn "${RED}${BOLD}Pipeline failed${NC}"
else
  info "Pipeline status: $FINAL"
fi
