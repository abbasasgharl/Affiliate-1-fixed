-- Safe additive indexes for the durable queue and pending approval workflow.
CREATE INDEX IF NOT EXISTS tasks_queue_claim_idx
  ON agent_engine.tasks (created_at ASC) WHERE status='queued';

CREATE UNIQUE INDEX IF NOT EXISTS approvals_one_pending_per_task_idx
  ON agent_engine.approvals (task_id) WHERE decision='pending';

CREATE INDEX IF NOT EXISTS executions_model_created_idx
  ON agent_engine.executions (model, created_at DESC);

CREATE INDEX IF NOT EXISTS usage_task_created_idx
  ON agent_engine.usage (task_id, created_at DESC);
