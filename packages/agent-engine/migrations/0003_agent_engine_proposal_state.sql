-- Add an atomic in-progress state so concurrent API requests/workers cannot create
-- multiple pull requests for the same approved task.
ALTER TABLE agent_engine.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE agent_engine.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'queued',
    'running',
    'validating',
    'awaiting_approval',
    'ready_to_propose',
    'proposing',
    'proposed',
    'failed',
    'cancelled'
  ));
