export class Migration20260309100000 {
  async up(db: any): Promise<void> {
    await db.execute(`
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
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "approved_at" timestamptz,
        "approved_by" varchar(255),
        "conversation_context" jsonb,
        PRIMARY KEY ("id")
      );

      CREATE INDEX "idx_pending_approvals_session_id" ON "pending_approvals" ("session_id");
      CREATE INDEX "idx_pending_approvals_user_id" ON "pending_approvals" ("user_id");
      CREATE INDEX "idx_pending_approvals_status" ON "pending_approvals" ("status");
      CREATE INDEX "idx_pending_approvals_created_at" ON "pending_approvals" ("created_at");
    `);
  }

  async down(db: any): Promise<void> {
    await db.execute(`DROP TABLE IF EXISTS "pending_approvals" CASCADE;`);
  }
}
