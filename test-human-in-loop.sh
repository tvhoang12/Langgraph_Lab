#!/bin/bash

# 🧪 Quick Test Script for Human in the Loop Feature

API_URL="http://localhost:3000"
SESSION_ID=""
APPROVAL_ID=""

echo "🚀 Testing Human in the Loop Feature"
echo "======================================"

# Step 1: Create new session and send message
echo ""
echo "1️⃣ Creating new session with message..."
RESPONSE=$(curl -s -X POST "$API_URL/chatbot-calendar" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "message": "Ngày nào tốt để khai trương?",
    "lunarBirthYear": 1990,
    "activity": "khai-truong"
  }')

SESSION_ID=$(echo $RESPONSE | jq -r '.data.sessionId')
echo "✅ Session created: $SESSION_ID"
echo "Response: $(echo $RESPONSE | jq '.')"

# Step 2: Send follow-up message that may trigger approval
echo ""
echo "2️⃣ Sending follow-up message (may trigger pending approval)..."
RESPONSE=$(curl -s -X PATCH "$API_URL/chatbot-calendar/$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "message": "Vậy tuần này có ngày nào tốt không?",
    "lunarBirthYear": 1990,
    "activity": "khai-truong"
  }')

echo "Response: $(echo $RESPONSE | jq '.')"

# Check if pending approval was created
STATUS=$(echo $RESPONSE | jq -r '.data.status // empty')
APPROVAL_ID=$(echo $RESPONSE | jq -r '.data.approvalId // empty')

if [ "$STATUS" = "PENDING_APPROVAL" ]; then
  echo "✅ Pending approval created: $APPROVAL_ID"
  
  # Step 3: Get pending approvals
  echo ""
  echo "3️⃣ Getting pending approvals..."
  PENDING=$(curl -s -X GET "$API_URL/approval/pending")
  echo "Pending Approvals: $(echo $PENDING | jq '.')"
  
  # Step 4: Get approval details
  if [ ! -z "$APPROVAL_ID" ]; then
    echo ""
    echo "4️⃣ Getting approval details..."
    APPROVAL=$(curl -s -X GET "$API_URL/approval/$APPROVAL_ID")
    echo "Approval Details: $(echo $APPROVAL | jq '.')"
    
    # Step 5: Approve the action
    echo ""
    echo "5️⃣ Approving the action..."
    APPROVED=$(curl -s -X POST "$API_URL/approval/submit" \
      -H "Content-Type: application/json" \
      -d "{
        \"approvalId\": \"$APPROVAL_ID\",
        \"userId\": \"test-user\",
        \"action\": \"APPROVE\",
        \"notes\": \"Looks good, proceed with tool execution\"
      }")
    echo "Approval Result: $(echo $APPROVED | jq '.')"
    
    # Step 6: Get final output
    echo ""
    echo "6️⃣ Getting final output..."
    OUTPUT=$(curl -s -X GET "$API_URL/approval/$APPROVAL_ID/output")
    echo "Final Output: $(echo $OUTPUT | jq '.')"
  fi
else
  echo "⚠️ No pending approval created. Response status: $STATUS"
fi

# Step 7: Get all pending approvals for session
echo ""
echo "7️⃣ Getting all pending approvals for session..."
SESSION_APPROVALS=$(curl -s -X GET "$API_URL/approval/session/$SESSION_ID")
echo "Session Approvals: $(echo $SESSION_APPROVALS | jq '.')"

echo ""
echo "✅ Test complete!"
