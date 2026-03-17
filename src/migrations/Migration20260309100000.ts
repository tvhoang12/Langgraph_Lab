import { Migration } from '@mikro-orm/migrations';

export class Migration20260309100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "pending_approvals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "session_id" varchar(255) NOT NULL,
        "user_id" varchar(255) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "tool_name" varchar(255) NOT NULL,
        "tool_input" jsonb NOT NULL,
        "tool_output" jsonb,
        "user_notes" text,
        "modified_output" jsonb,
        "coaching_feedback" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "approved_at" timestamptz,
        "approved_by" varchar(255),
        "conversation_context" jsonb,
        PRIMARY KEY ("id")
      );

      ALTER TABLE "pending_approvals"
      ADD COLUMN IF NOT EXISTS "coaching_feedback" jsonb;

      CREATE INDEX IF NOT EXISTS "idx_pending_approvals_session_id" ON "pending_approvals" ("session_id");
      CREATE INDEX IF NOT EXISTS "idx_pending_approvals_user_id" ON "pending_approvals" ("user_id");
      CREATE INDEX IF NOT EXISTS "idx_pending_approvals_status" ON "pending_approvals" ("status");
      CREATE INDEX IF NOT EXISTS "idx_pending_approvals_created_at" ON "pending_approvals" ("created_at");
    `);
  }

  override async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS "pending_approvals" CASCADE;');
  }
}

