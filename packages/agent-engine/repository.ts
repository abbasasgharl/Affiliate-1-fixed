import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { AgentTask, GeneratedFile, ValidationReport, WorkerResult } from './index.ts';

export type PersistedTaskStatus = 'queued'|'running'|'validating'|'awaiting_approval'|'ready_to_propose'|'proposing'|'proposed'|'failed'|'cancelled';
export interface PersistedTask {
  id:string; projectId:string; title:string; description:string; category:string;
  executionMode:'approval'|'autonomous'; status:PersistedTaskStatus;
  requestedBy:string|null; input:Record<string,unknown>; result:unknown|null;
  errorMessage:string|null; createdAt:Date; startedAt:Date|null; completedAt:Date|null;
}
export interface CreateTaskInput extends AgentTask { requestedBy?:string|null; }
export interface CreateProjectInput { id:string; name:string; repositoryUrl?:string|null; defaultBranch?:string; rules?:Record<string,unknown>; }
export interface ExecutionInput { taskId:string; agentId?:string|null; model:string; status:string; promptTokens?:number|null; outputTokens?:number|null; estimatedCost?:string|null; durationMs?:number|null; metadata?:Record<string,unknown>; }
export interface AuditInput { projectId?:string|null; taskId?:string|null; actorId?:string|null; action:string; metadata?:Record<string,unknown>; }

const asTask=(r:any):PersistedTask=>({
 id:r.id,projectId:r.project_id,title:r.title,description:r.description,category:r.category,
 executionMode:r.execution_mode,status:r.status,requestedBy:r.requested_by,
 input:r.input??{},result:r.result??null,errorMessage:r.error_message,
 createdAt:r.created_at,startedAt:r.started_at,completedAt:r.completed_at
});

/**
 * Persistence adapter for the existing AffiliateOS PostgreSQL pool.
 * Pass the application's existing pool; this class never creates a second connection pool.
 * Run migrations/0001_agent_engine.sql before using the repository.
 */
export class CloudSqlAgentRepository {
 constructor(private readonly pool:Pool) {}

 private async audit(client:any,input:AuditInput):Promise<void>{
  await client.query(
   'INSERT INTO agent_engine.audit_logs (id,project_id,task_id,actor_id,action,metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
   [randomUUID(),input.projectId??null,input.taskId??null,input.actorId??null,input.action,JSON.stringify(input.metadata??{})]
  );
 }

 async createProject(input:CreateProjectInput):Promise<void>{
  await this.pool.query(
   `INSERT INTO agent_engine.projects (id,name,repository_url,default_branch,rules)
    VALUES ($1,$2,$3,$4,$5::jsonb)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,repository_url=EXCLUDED.repository_url,default_branch=EXCLUDED.default_branch,rules=EXCLUDED.rules,updated_at=now()`,
   [input.id,input.name,input.repositoryUrl??null,input.defaultBranch??'main',JSON.stringify(input.rules??{})]
  );
 }

 async createTask(input:CreateTaskInput):Promise<PersistedTask>{
  const id=input.taskId||randomUUID();
  const payload={targetFiles:input.targetFiles,context:input.context??null};
  const result=await this.pool.query(
   `INSERT INTO agent_engine.tasks (id,project_id,title,description,category,execution_mode,status,requested_by,input)
    VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,$8::jsonb) RETURNING *`,
   [id,input.projectId,input.title,input.description,input.category,input.mode,input.requestedBy??null,JSON.stringify(payload)]
  );
  await this.audit(this.pool,{projectId:input.projectId,taskId:id,actorId:input.requestedBy,action:'agent.task.created',metadata:{category:input.category,mode:input.mode}});
  return asTask(result.rows[0]);
 }

 async getTask(taskId:string):Promise<PersistedTask|null>{
  const r=await this.pool.query('SELECT * FROM agent_engine.tasks WHERE id=$1',[taskId]);
  return r.rowCount?asTask(r.rows[0]):null;
 }

 async listTasks(projectId:string,options:{limit?:number;before?:Date;status?:PersistedTaskStatus}={}):Promise<PersistedTask[]>{
  const limit=Math.max(1,Math.min(options.limit??25,100));
  const r=await this.pool.query(
   `SELECT * FROM agent_engine.tasks
    WHERE project_id=$1 AND ($2::text IS NULL OR status=$2) AND ($3::timestamptz IS NULL OR created_at<$3)
    ORDER BY created_at DESC LIMIT $4`,
   [projectId,options.status??null,options.before??null,limit]
  );
  return r.rows.map(asTask);
 }

 /** Atomically leases one queued task; concurrent workers cannot claim the same task. */
 async recoverStaleTasks(staleAfterSeconds=900):Promise<number>{
  const seconds=Math.max(60,Math.min(Math.floor(staleAfterSeconds),86400));
  const r=await this.pool.query(
   `UPDATE agent_engine.tasks SET status='queued',started_at=NULL,error_message='Worker lease expired; task returned to queue.'
    WHERE status='running' AND started_at < now() - ($1 * interval '1 second') RETURNING id,project_id`,
   [seconds]
  );
  for(const task of r.rows)await this.audit(this.pool,{projectId:task.project_id,taskId:task.id,action:'agent.task.lease_recovered',metadata:{staleAfterSeconds:seconds}});
  return r.rowCount??0;
 }

 async claimNextTask():Promise<PersistedTask|null>{
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const selected=await client.query(
    `SELECT * FROM agent_engine.tasks WHERE status='queued'
     ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
   );
   if(!selected.rowCount){await client.query('COMMIT');return null;}
   const id=selected.rows[0].id;
   const updated=await client.query(
    `UPDATE agent_engine.tasks SET status='running',started_at=now(),error_message=NULL
     WHERE id=$1 RETURNING *`,[id]
   );
   await client.query('COMMIT');
   return asTask(updated.rows[0]);
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }


 /** Atomically claims a validated, approved task for one PR proposal attempt. */
 async claimTaskForProposal(taskId:string,actorId?:string):Promise<boolean>{
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const claimed=await client.query(
    `UPDATE agent_engine.tasks SET status='proposing',error_message=NULL
     WHERE id=$1 AND status='ready_to_propose' RETURNING project_id`,[taskId]
   );
   if(!claimed.rowCount){await client.query('ROLLBACK');return false;}
   await this.audit(client,{projectId:claimed.rows[0].project_id,taskId,actorId,action:'agent.task.proposal_claimed'});
   await client.query('COMMIT');
   return true;
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }

 async setTaskStatus(taskId:string,status:PersistedTaskStatus,errorMessage?:string|null):Promise<void>{
  const allowed:Record<PersistedTaskStatus,PersistedTaskStatus[]> = {
   queued:['running','cancelled'],running:['validating','failed','cancelled'],
   validating:['awaiting_approval','ready_to_propose','failed','cancelled'],
   awaiting_approval:['ready_to_propose','cancelled'],ready_to_propose:['proposing','failed','cancelled'],proposing:['proposed','ready_to_propose','failed'],
   proposed:[],failed:[],cancelled:[]
  };
  const current=await this.getTask(taskId);
  if(!current)throw new Error('Task not found.');
  if(!allowed[current.status].includes(status))throw new Error(`Invalid task transition: ${current.status} -> ${status}`);
  const terminal=['proposed','failed','cancelled'].includes(status);
  const r=await this.pool.query(
   `UPDATE agent_engine.tasks SET status=$2,error_message=$3,
    completed_at=CASE WHEN $4 THEN now() ELSE completed_at END
    WHERE id=$1 RETURNING project_id`,
   [taskId,status,errorMessage??null,terminal]
  );
  if(!r.rowCount)throw new Error('Task not found.');
  await this.audit(this.pool,{projectId:r.rows[0].project_id,taskId,action:'agent.task.status_changed',metadata:{status}});
 }

 async saveExecution(input:ExecutionInput):Promise<string>{
  const id=randomUUID();
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   await client.query(
    `INSERT INTO agent_engine.executions
     (id,task_id,agent_id,provider,model,status,prompt_tokens,output_tokens,estimated_cost,duration_ms,metadata)
     VALUES ($1,$2,$3,'gemini',$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [id,input.taskId,input.agentId??null,input.model,input.status,input.promptTokens??null,input.outputTokens??null,input.estimatedCost??null,input.durationMs??null,JSON.stringify(input.metadata??{})]
   );
   await client.query(
    `INSERT INTO agent_engine.usage (id,task_id,execution_id,provider,model,input_tokens,output_tokens,estimated_cost)
     VALUES ($1,$2,$3,'gemini',$4,$5,$6,$7)`,
    [randomUUID(),input.taskId,id,input.model,input.promptTokens??null,input.outputTokens??null,input.estimatedCost??null]
   );
   await client.query('COMMIT');
   return id;
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }

 async saveWorkerResult(taskId:string,result:WorkerResult):Promise<void>{
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const task=await client.query('SELECT project_id,status FROM agent_engine.tasks WHERE id=$1 FOR UPDATE',[taskId]);
   if(!task.rowCount)throw new Error('Task not found.');
   if(!['running','validating'].includes(task.rows[0].status))throw new Error('Task is not in a writable execution state.');
   await client.query('DELETE FROM agent_engine.artifacts WHERE task_id=$1',[taskId]);
   for(const file of result.files){
    await client.query(
     `INSERT INTO agent_engine.artifacts (id,task_id,file_path,operation,content,content_sha256)
      VALUES ($1,$2,$3,$4,$5,$6)`,
     [randomUUID(),taskId,file.path,file.operation,file.content,createHash('sha256').update(file.content,'utf8').digest('hex')]
    );
   }
   await client.query(
    `UPDATE agent_engine.tasks SET result=$2::jsonb,status='validating' WHERE id=$1`,
    [taskId,JSON.stringify({summary:result.summary,rationale:result.rationale,checklist:result.checklist,risks:result.risks})]
   );
   await this.audit(client,{projectId:task.rows[0].project_id,taskId,action:'agent.artifacts.saved',metadata:{fileCount:result.files.length}});
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }


 async getArtifactMetadata(taskId:string):Promise<Array<{path:string;operation:string}>>{
  const r=await this.pool.query(
   'SELECT file_path,operation FROM agent_engine.artifacts WHERE task_id=$1 ORDER BY created_at ASC',[taskId]
  );
  return r.rows.map(x=>({path:x.file_path,operation:x.operation}));
 }

 async getArtifacts(taskId:string):Promise<GeneratedFile[]>{
  const r=await this.pool.query(
   'SELECT file_path,operation,content FROM agent_engine.artifacts WHERE task_id=$1 ORDER BY created_at ASC',[taskId]
  );
  return r.rows.map(x=>({path:x.file_path,operation:x.operation,content:x.content,rationale:''}));
 }

 async saveValidation(taskId:string,report:ValidationReport,validatorVersion='1'):Promise<void>{
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const task=await client.query('SELECT project_id,status FROM agent_engine.tasks WHERE id=$1 FOR UPDATE',[taskId]);
   if(!task.rowCount)throw new Error('Task not found.');
   if(task.rows[0].status!=='validating')throw new Error('Task must be validating before a validation report can be saved.');
   await client.query(
    `INSERT INTO agent_engine.validation_results (id,task_id,passed,checks,findings,validator_version)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6)`,
    [randomUUID(),taskId,report.passed,JSON.stringify(report.checks),JSON.stringify(report.findings),validatorVersion]
   );
   await client.query(
    `UPDATE agent_engine.tasks SET status=$2,error_message=$3,
     completed_at=CASE WHEN $2='failed' THEN now() ELSE completed_at END WHERE id=$1`,
    [taskId,report.passed?'awaiting_approval':'failed',report.passed?null:report.findings.join('; ').slice(0,4000)]
   );
   await this.audit(client,{projectId:task.rows[0].project_id,taskId,action:'agent.validation.completed',metadata:{passed:report.passed,findings:report.findings.length}});
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }

 async requestApproval(taskId:string,requestedBy?:string|null):Promise<string>{
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const task=await client.query('SELECT project_id,status FROM agent_engine.tasks WHERE id=$1 FOR UPDATE',[taskId]);
   if(!task.rowCount)throw new Error('Task not found.');
   if(task.rows[0].status!=='awaiting_approval')throw new Error('Only validated tasks can be submitted for approval.');
   const id=randomUUID();
   await client.query(
    'INSERT INTO agent_engine.approvals (id,task_id,requested_by,decision) VALUES ($1,$2,$3,\'pending\')',
    [id,taskId,requestedBy??null]
   );
   await this.audit(client,{projectId:task.rows[0].project_id,taskId,actorId:requestedBy,action:'agent.approval.requested'});
   await client.query('COMMIT');return id;
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }

 async decideApproval(approvalId:string,decision:'approved'|'rejected',decidedBy:string,comment?:string):Promise<void>{
  if(!decidedBy)throw new Error('Approver identity is required.');
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const approval=await client.query(
    `SELECT a.task_id,a.decision,t.project_id,t.status FROM agent_engine.approvals a
     JOIN agent_engine.tasks t ON t.id=a.task_id WHERE a.id=$1 FOR UPDATE OF a,t`,[approvalId]
   );
   if(!approval.rowCount)throw new Error('Approval request not found.');
   const row=approval.rows[0];
   if(row.decision!=='pending'||row.status!=='awaiting_approval')throw new Error('Approval is no longer pending.');
   await client.query(
    `UPDATE agent_engine.approvals SET decision=$2,decided_by=$3,comment=$4,decided_at=now() WHERE id=$1`,
    [approvalId,decision,decidedBy,comment??null]
   );
   await client.query(
    `UPDATE agent_engine.tasks SET status=$2,
     completed_at=CASE WHEN $2='cancelled' THEN now() ELSE completed_at END WHERE id=$1`,
    [row.task_id,decision==='approved'?'ready_to_propose':'cancelled']
   );
   await this.audit(client,{projectId:row.project_id,taskId:row.task_id,actorId:decidedBy,action:'agent.approval.decided',metadata:{decision}});
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }

 async getLatestValidation(taskId:string):Promise<ValidationReport|null>{
  const r=await this.pool.query(
   'SELECT passed,checks,findings FROM agent_engine.validation_results WHERE task_id=$1 ORDER BY created_at DESC LIMIT 1',[taskId]
  );
  return r.rowCount?{passed:r.rows[0].passed,checks:r.rows[0].checks,findings:r.rows[0].findings}:null;
 }

 async getUsageSummary(projectId:string):Promise<{executions:number;inputTokens:number;outputTokens:number;estimatedCost:string}>{
  const r=await this.pool.query(
   `SELECT count(*)::int AS executions,COALESCE(sum(u.input_tokens),0)::int AS input_tokens,
    COALESCE(sum(u.output_tokens),0)::int AS output_tokens,
    COALESCE(sum(u.estimated_cost),0)::text AS estimated_cost
    FROM agent_engine.usage u JOIN agent_engine.tasks t ON t.id=u.task_id WHERE t.project_id=$1`,
   [projectId]
  );
  const x=r.rows[0];return {executions:x.executions,inputTokens:x.input_tokens,outputTokens:x.output_tokens,estimatedCost:x.estimated_cost};
 }
}
