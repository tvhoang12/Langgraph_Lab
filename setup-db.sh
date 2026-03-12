#!/bin/bash

# 📊 Setup PostgreSQL Database Script

echo "🚀 Setting up PostgreSQL Database for Human in the Loop"
echo "========================================================"

# Load environment variables from .env
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | xargs)
  echo "✅ Loaded .env file"
else
  echo "❌ .env file not found"
  exit 1
fi

echo ""
echo "PostgreSQL settings loaded:"
echo "- HOST: $DATABASE_HOST"
echo "- PORT: $DATABASE_PORT"
echo "- USER: $DATABASE_USER"
echo "- DB: $DATABASE_NAME"
echo ""

# Check if PostgreSQL is running
echo "1️⃣ Checking PostgreSQL connection..."

PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -U "$DATABASE_USER" -d "postgres" -c "SELECT 1" > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Cannot connect to PostgreSQL"
  echo "Make sure PostgreSQL is running and credentials in .env are correct"
  echo ""
  echo "Connection details:"
  echo "  Host: $DATABASE_HOST"
  echo "  Port: $DATABASE_PORT"
  echo "  User: $DATABASE_USER"
  echo ""
  echo "Try connecting manually:"
  echo "  psql -h $DATABASE_HOST -U $DATABASE_USER -d postgres"
  exit 1
fi

echo "✅ PostgreSQL connection successful"

# Check if database exists
echo ""
echo "2️⃣ Checking if database exists..."

PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -U "$DATABASE_USER" -d "postgres" -c "SELECT 1 FROM pg_database WHERE datname='$DATABASE_NAME'" | grep -q 1

if [ $? -eq 0 ]; then
  echo "✅ Database '$DATABASE_NAME' already exists"
else
  echo "📝 Creating database '$DATABASE_NAME'..."
  PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -U "$DATABASE_USER" -d "postgres" -c "CREATE DATABASE \"$DATABASE_NAME\";"
  
  if [ $? -eq 0 ]; then
    echo "✅ Database created successfully"
  else
    echo "❌ Failed to create database"
    exit 1
  fi
fi

# Create pending_approvals table if not exists
echo ""
echo "3️⃣ Creating 'pending_approvals' table..."

PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c "
CREATE TABLE IF NOT EXISTS pending_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id varchar(255) NOT NULL,
  user_id varchar(255) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  tool_name varchar(255) NOT NULL,
  tool_input jsonb NOT NULL,
  tool_output jsonb,
  user_notes text,
  modified_output jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by varchar(255),
  conversation_context jsonb
);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_session_id ON pending_approvals(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_user_id ON pending_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_created_at ON pending_approvals(created_at);
"

if [ $? -eq 0 ]; then
  echo "✅ Table 'pending_approvals' is ready"
else
  echo "❌ Failed to create table"
  exit 1
fi

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Database info:"
echo "- Host: $DATABASE_HOST"
echo "- Port: $DATABASE_PORT"
echo "- User: $DATABASE_USER"
echo "- Database: $DATABASE_NAME"
echo "- Table: pending_approvals"
echo ""
echo "You can now run: npm run dev"
