export type TeamTaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type WorkflowStage = "Idea" | "Brief" | "Production" | "Review" | "Publish";

export interface TeamSummaryRequest {
  source_type: "chat" | "meeting";
  content: string;
  title?: string;
}

export interface TeamSummaryResponse {
  message?: string;
  summary_id?: string;
  summary?: string;
  action_items_preview?: string[];
}

export interface ProcessTeamInputRequest {
  source_type: "chat" | "meeting";
  content: string;
  title?: string;
  owner_candidates?: string[];
  default_due_days?: number;
}

export interface ProcessTeamInputResponse {
  note_log: TeamNoteLog;
  summary: TeamSummaryResponse;
  tasks: TeamTask[];
}

export interface TeamNoteLog {
  note_id: string;
  raw_text: string;
  category: string;
  category_result: string;
  source_type: "chat" | "meeting";
  created_at: string;
}

export interface ExtractTasksRequest {
  source_ref?: string;
  content?: string;
  owner_candidates?: string[];
  default_due_days?: number;
}

export interface ExtractTasksResponse {
  message?: string;
  tasks?: Array<{
    task_id: string;
    title: string;
    owner?: string;
    due_date?: string;
    priority?: "low" | "medium" | "high";
    status?: TeamTaskStatus;
  }>;
}

export interface TeamTask {
  task_id: string;
  title: string;
  description?: string;
  owner?: string;
  due_date?: string;
  priority?: "low" | "medium" | "high";
  status: TeamTaskStatus;
  notes?: string;
}

export interface ListTeamTasksResponse {
  items: TeamTask[];
  total: number;
}

export interface UpdateTeamTaskRequest {
  owner?: string;
  status?: TeamTaskStatus;
  due_date?: string;
  notes?: string;
}

export interface UpdateTeamTaskResponse {
  task_id: string;
  updated: boolean;
}

export interface RunRemindersRequest {
  window_hours: number;
  task_ids?: string[];
}

export interface RunRemindersResponse {
  generated_at: string | null;
  reminders: Array<{
    task_id: string;
    owner?: string;
    due_date?: string;
    severity: "overdue" | "due_soon";
    message: string;
  }>;
}

export interface ListTeamNotesLogsResponse {
  items: TeamNoteLog[];
}

export interface CreateWorkflowItemRequest {
  title: string;
  description?: string;
  owner?: string;
  linked_trend?: string;
  project?: string;
  stage?: WorkflowStage;
  due_date?: string;
  comments?: string[];
  links?: string[];
  attachments?: string[];
}

export interface WorkflowItem {
  item_id: string;
  title: string;
  description?: string;
  stage: WorkflowStage;
  owner?: string;
  linked_trend?: string;
  project?: string;
  due_date?: string;
  comments?: string[];
  links?: string[];
  attachments?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateWorkflowItemResponse {
  message?: string;
  item_id?: string;
  stage?: WorkflowStage;
}

export interface ListWorkflowItemsResponse {
  items: WorkflowItem[];
}

export interface UpdateWorkflowStageRequest {
  to_stage: WorkflowStage;
  note?: string;
}

export interface UpdateWorkflowStageResponse {
  item_id: string;
  updated: boolean;
  from_stage?: WorkflowStage;
  to_stage?: WorkflowStage;
}

export interface UpdateWorkflowItemRequest {
  title?: string;
  description?: string;
  owner?: string;
  linked_trend?: string;
  project?: string;
  due_date?: string;
  comments?: string[];
  links?: string[];
  attachments?: string[];
}

export interface UpdateWorkflowItemResponse {
  item_id: string;
  updated: boolean;
}

export interface DeleteWorkflowItemResponse {
  item_id: string;
  deleted: boolean;
}

export interface WorkflowActivityLog {
  log_id: string;
  action: string;
  item_id?: string;
  item_title?: string;
  details: string;
  actor: string;
  created_at: string;
}

export interface ListWorkflowActivityResponse {
  items: WorkflowActivityLog[];
}

export interface UploadWorkflowAttachmentResponse {
  name: string;
  url: string;
}
