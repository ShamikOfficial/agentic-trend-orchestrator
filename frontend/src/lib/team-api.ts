import { apiRequest } from "@/lib/api-client";
import type {
  ExtractTasksRequest,
  ExtractTasksResponse,
  ListTeamTasksResponse,
  RunRemindersRequest,
  RunRemindersResponse,
  TeamSummaryRequest,
  TeamSummaryResponse,
  UpdateTeamTaskRequest,
  UpdateTeamTaskResponse,
} from "@/types/api";

export function summarizeTeamContent(payload: TeamSummaryRequest) {
  return apiRequest<TeamSummaryResponse>("/team/summaries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function extractTasks(payload: ExtractTasksRequest) {
  return apiRequest<ExtractTasksResponse>("/team/tasks/extract", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listTeamTasks() {
  return apiRequest<ListTeamTasksResponse>("/team/tasks");
}

export function updateTeamTask(taskId: string, payload: UpdateTeamTaskRequest) {
  return apiRequest<UpdateTeamTaskResponse>(`/team/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function runDeadlineReminders(payload: RunRemindersRequest) {
  return apiRequest<RunRemindersResponse>("/team/reminders/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
