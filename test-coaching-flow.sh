#!/bin/bash

# 🧪 Test Human Coaching Loop - Complete Flow
# Flow test tính năng coaching:
# 1️⃣ Tạo session ID với API POST /chatbot-calendar
# 2️⃣ Dùng session ID để lấy approval ID từ PATCH /chatbot-calendar/{sessionId}
# 3️⃣ Dùng approval ID để test tính năng human coaching

API_URL="${1:-http://localhost:3001}"
echo "🚀 Testing Coaching Loop on $API_URL"
echo "=========================================="

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Variables
SESSION_ID=""
APPROVAL_ID=""
USER_ID="user-001"
REVIEWER_ID="reviewer-john"

# Lưu output để đối chiếu
RUN_TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="./test-output/coaching-$RUN_TS"
mkdir -p "$OUT_DIR"

save_json() {
  local content="$1"
  local file="$2"
  if echo "$content" | jq '.' >/dev/null 2>&1; then
    echo "$content" | jq '.' > "$file"
  else
    echo "$content" > "$file"
  fi
}

extract_response_text() {
  local file="$1"
  local out="$2"
  jq -r '.data.response // .data.aiResponse // .response // .aiResponse // empty' "$file" > "$out" 2>/dev/null || true
}

# ================================================================
# BƯỚC 1️⃣: Tạo Session ID với API POST /chatbot-calendar
# ================================================================
echo ""
echo -e "${BLUE}====== BƯỚC 1️⃣: TẠO SESSION ID ======${NC}"

REQUEST_CREATE_SESSION=$(cat <<'EOF'
{
  "userId": "user-001",
  "message": "Xin chào, tôi cần tư vấn ngày tốt để khai trương trong tháng này",
  "lunarBirthYear": 1990,
  "activity": "khai-truong"
}
EOF
)

echo "📤 Request:"
echo "$REQUEST_CREATE_SESSION" | jq '.'

INIT_RESPONSE=$(curl -s -X POST "$API_URL/chatbot-calendar" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_CREATE_SESSION")

save_json "$INIT_RESPONSE" "$OUT_DIR/01-create-session-response.json"

echo ""
echo "📥 Response:"
echo "$INIT_RESPONSE" | jq '.' 2>/dev/null || echo "$INIT_RESPONSE"

SESSION_ID=$(echo "$INIT_RESPONSE" | jq -r '.data.sessionId // empty' 2>/dev/null)

if [ -z "$SESSION_ID" ]; then
  SESSION_ID=$(echo "$INIT_RESPONSE" | grep -o '"sessionId":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$SESSION_ID" ]; then
  echo -e "${RED}❌ Lỗi: Không thể lấy được sessionId${NC}"
  echo "Full response: $INIT_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Session ID được tạo: $SESSION_ID${NC}"

# ================================================================
# BƯỚC 2️⃣: Lấy Approval ID từ PATCH /chatbot-calendar/{sessionId}
# ================================================================
echo ""
echo -e "${BLUE}====== BƯỚC 2️⃣: LẤY APPROVAL ID TỪ PATCH ======${NC}"

REQUEST_GET_APPROVAL=$(cat <<EOF
{
  "userId": "$USER_ID",
  "message": "Ngày nào tốt để khai trương năm sinh 1990?",
  "lunarBirthYear": 1990,
  "activity": "khai-truong"
}
EOF
)

echo "📤 Request PATCH /chatbot-calendar/$SESSION_ID:"
echo "$REQUEST_GET_APPROVAL" | jq '.'

PATCH_RESPONSE=$(curl -s -X PATCH "$API_URL/chatbot-calendar/$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_GET_APPROVAL")

save_json "$PATCH_RESPONSE" "$OUT_DIR/02-patch-get-approval-response.json"

echo ""
echo "📥 Response từ PATCH:"
echo "$PATCH_RESPONSE" | jq '.' 2>/dev/null || echo "$PATCH_RESPONSE"

# Lấy approval ID từ response
APPROVAL_ID=$(echo "$PATCH_RESPONSE" | jq -r '.data.approvalId // empty' 2>/dev/null)

if [ -z "$APPROVAL_ID" ]; then
  APPROVAL_ID=$(echo "$PATCH_RESPONSE" | grep -o '"approvalId":"[^"]*' | cut -d'"' -f4 | head -1)
fi

if [ -z "$APPROVAL_ID" ]; then
  echo -e "${RED}❌ Lỗi: Không thể lấy được approvalId từ PATCH response${NC}"
  echo "Full response: $PATCH_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Approval ID được lấy: $APPROVAL_ID${NC}"

# ================================================================
# BƯỚC 3️⃣: Test Human Coaching Feedback
# ================================================================
echo ""
echo -e "${BLUE}====== BƯỚC 3️⃣: TEST HUMAN COACHING ======${NC}"

echo ""
echo -e "${YELLOW}📋 Lấy thông tin chi tiết approval trước khi coaching${NC}"

APPROVAL_DETAIL=$(curl -s -X GET "$API_URL/approval/$APPROVAL_ID" \
  -H "Content-Type: application/json")

save_json "$APPROVAL_DETAIL" "$OUT_DIR/03-approval-detail-before-coaching.json"

echo "$APPROVAL_DETAIL" | jq '.' 2>/dev/null || echo "$APPROVAL_DETAIL"

TOOL_NAME=$(echo "$APPROVAL_DETAIL" | jq -r '.data.toolName // empty' 2>/dev/null)
if [ -z "$TOOL_NAME" ]; then
  TOOL_NAME=$(echo "$APPROVAL_DETAIL" | grep -o '"toolName":"[^"]*' | cut -d'"' -f4)
fi

if [ ! -z "$TOOL_NAME" ]; then
  echo -e "${GREEN}✅ Tool Name: $TOOL_NAME${NC}"
fi

echo ""
echo -e "${YELLOW}📤 Gửi coaching feedback (MODIFY + Coaching)${NC}"

REQUEST_COACHING=$(cat <<EOF
{
  "action": "MODIFY",
  "approvedBy": "$REVIEWER_ID",
  "sessionId": "$SESSION_ID",
  "notes": "Sửa để kiểm tra timezone",
  "modifiedData": {
    "lunar_birth_year": 1990,
    "activity": "Khai trương",
    "start_date": "2026-03-01",
    "end_date": "2026-03-31"
  },
  "coaching": {
    "errorType": "DOMAIN",
    "reason": "AI chưa xác nhận timezone người dùng trước khi đề xuất ngày tốt",
    "correction": "Phải kiểm tra timezone của user (GMT+7) trước khi tính ngày tốt",
    "tags": ["timezone", "calendar", "domain"],
    "confidence": 0.95,
    "coachedBy": "$REVIEWER_ID"
  }
}
EOF
)

echo "$REQUEST_COACHING" | jq '.'

COACHING_RESPONSE=$(curl -s -X PATCH "$API_URL/approval/$APPROVAL_ID/submit-and-get-response" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_COACHING")

save_json "$COACHING_RESPONSE" "$OUT_DIR/04-submit-coaching-response.json"

echo ""
echo "📥 Response từ coaching:"
echo "$COACHING_RESPONSE" | jq '.' 2>/dev/null || echo "$COACHING_RESPONSE"

# Check for error
if echo "$COACHING_RESPONSE" | grep -q '"error"'; then
  echo -e "${RED}❌ Lỗi gửi coaching:${NC}"
  echo "$COACHING_RESPONSE" | jq '.message // .error // .' 2>/dev/null || echo "$COACHING_RESPONSE"
  exit 1
fi

# Lấy status sau coaching
MODIFIED_STATUS=$(echo "$COACHING_RESPONSE" | jq -r '.data.status // empty' 2>/dev/null)
if [ -z "$MODIFIED_STATUS" ]; then
  MODIFIED_STATUS=$(echo "$COACHING_RESPONSE" | jq -r '.approval.status // empty' 2>/dev/null)
fi
if [ -z "$MODIFIED_STATUS" ]; then
  MODIFIED_STATUS=$(echo "$COACHING_RESPONSE" | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)
fi

if [ "$MODIFIED_STATUS" = "MODIFIED" ]; then
  echo -e "${GREEN}✅ Status thay đổi thành: MODIFIED${NC}"
else
  echo -e "${YELLOW}⚠️ Status hiện tại: $MODIFIED_STATUS${NC}"
fi

echo ""
echo -e "${YELLOW}📋 Xác nhận coaching đã được lưu${NC}"

APPROVAL_WITH_COACHING=$(curl -s -X GET "$API_URL/approval/$APPROVAL_ID" \
  -H "Content-Type: application/json")

save_json "$APPROVAL_WITH_COACHING" "$OUT_DIR/05-approval-detail-after-coaching.json"

echo "$APPROVAL_WITH_COACHING" | jq '.' 2>/dev/null || echo "$APPROVAL_WITH_COACHING"

# Coaching được lưu ở .data.coachingFeedback
COACHING_REASON=$(echo "$APPROVAL_WITH_COACHING" | jq -r '.data.coachingFeedback.reason // empty' 2>/dev/null)
if [ -z "$COACHING_REASON" ]; then
  COACHING_REASON=$(echo "$APPROVAL_WITH_COACHING" | grep -o '"reason":"[^"]*' | head -1 | cut -d'"' -f4)
fi

COACHED_BY=$(echo "$APPROVAL_WITH_COACHING" | jq -r '.data.coachingFeedback.coachedBy // empty' 2>/dev/null)
if [ -z "$COACHED_BY" ]; then
  COACHED_BY=$(echo "$APPROVAL_WITH_COACHING" | grep -o '"coachedBy":"[^"]*' | cut -d'"' -f4)
fi

ERROR_TYPE=$(echo "$APPROVAL_WITH_COACHING" | jq -r '.data.coachingFeedback.errorType // empty' 2>/dev/null)
CONFIDENCE=$(echo "$APPROVAL_WITH_COACHING" | jq -r '.data.coachingFeedback.confidence // empty' 2>/dev/null)

if [ ! -z "$COACHING_REASON" ]; then
  echo -e "${GREEN}✅ Coaching Reason: $COACHING_REASON${NC}"
  echo -e "${GREEN}✅ Coached By: $COACHED_BY${NC}"
  [ ! -z "$ERROR_TYPE" ] && echo -e "${GREEN}✅ Error Type: $ERROR_TYPE${NC}"
  [ ! -z "$CONFIDENCE" ] && echo -e "${GREEN}✅ Confidence: $CONFIDENCE${NC}"
else
  echo -e "${YELLOW}⚠️ Không tìm thấy coaching feedback${NC}"
fi

# ================================================================
# BƯỚC 4️⃣: Tạo file đối chiếu before/after
# ================================================================
echo ""
echo -e "${BLUE}====== BƯỚC 4️⃣: TẠO FILE ĐỐI CHIẾU JSON ======${NC}"

if command -v jq >/dev/null 2>&1; then
  jq -S '.' "$OUT_DIR/03-approval-detail-before-coaching.json" > "$OUT_DIR/03-before-sorted.json" 2>/dev/null || cp "$OUT_DIR/03-approval-detail-before-coaching.json" "$OUT_DIR/03-before-sorted.json"
  jq -S '.' "$OUT_DIR/05-approval-detail-after-coaching.json" > "$OUT_DIR/05-after-sorted.json" 2>/dev/null || cp "$OUT_DIR/05-approval-detail-after-coaching.json" "$OUT_DIR/05-after-sorted.json"
fi

if command -v diff >/dev/null 2>&1; then
  diff -u "$OUT_DIR/03-before-sorted.json" "$OUT_DIR/05-after-sorted.json" > "$OUT_DIR/06-before-vs-after.diff" || true
  echo -e "${GREEN}✅ Đã tạo file diff: $OUT_DIR/06-before-vs-after.diff${NC}"
fi

extract_response_text "$OUT_DIR/02-patch-get-approval-response.json" "$OUT_DIR/07-response-before.txt"
extract_response_text "$OUT_DIR/04-submit-coaching-response.json" "$OUT_DIR/08-response-after.txt"

echo -e "${GREEN}✅ Đã tạo file response text:${NC}"
echo "  - $OUT_DIR/07-response-before.txt"
echo "  - $OUT_DIR/08-response-after.txt"

# ================================================================
# TÓМTAT KẾT
# ================================================================
echo ""
echo "=========================================="
echo -e "${GREEN}✅ TEST HOÀN THÀNH!${NC}"
echo "=========================================="
echo ""
echo "📊 Tóm tắt kết quả:"
echo "  Session ID: $SESSION_ID"
echo "  Approval ID: $APPROVAL_ID"
echo "  Final Status: $MODIFIED_STATUS"
echo ""
echo "🔍 Các bước kiểm tra:"
echo "  ✓ Session được tạo: $([ ! -z "$SESSION_ID" ] && echo 'CÓ' || echo 'KHÔNG')"
echo "  ✓ Approval ID được lấy: $([ ! -z "$APPROVAL_ID" ] && echo 'CÓ' || echo 'KHÔNG')"
echo "  ✓ Coaching feedback được lưu: $([ ! -z "$COACHING_REASON" ] && echo 'CÓ' || echo 'KHÔNG')"
echo ""
echo "📁 Thư mục output: $OUT_DIR"
echo "  - 01-create-session-response.json"
echo "  - 02-patch-get-approval-response.json"
echo "  - 03-approval-detail-before-coaching.json"
echo "  - 04-submit-coaching-response.json"
echo "  - 05-approval-detail-after-coaching.json"
echo "  - 06-before-vs-after.diff"
echo "  - 07-response-before.txt"
echo "  - 08-response-after.txt"
echo ""
