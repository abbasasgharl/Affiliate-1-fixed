-- Add an atomic in-progress state so concurrent API requests/workers cannot create
-- multiple pull requests for the same approved task. Find the existing status CHECK by
-- its definition instead of assuming PostgreSQL's generated constraint name.
DO $$
DECLARE
  status_check record;
BEGIN
  FOR status_check IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'agent_engine.tasks'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE agent_engine.tasks DROP CONSTRAINT %I', status_check.conname);
  END LOOP;
END $$;

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
