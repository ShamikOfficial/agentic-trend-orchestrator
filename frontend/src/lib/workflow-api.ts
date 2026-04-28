import { apiRequest } from "@/lib/api-client";
import type {
  CreateWorkflowItemRequest,
  CreateWorkflowItemResponse,
  DeleteWorkflowItemResponse,
  ListWorkflowActivityResponse,
  ListWorkflowItemsResponse,
  UploadWorkflowAttachmentResponse,
  WorkflowItem,
  UpdateWorkflowItemRequest,
  UpdateWorkflowItemResponse,
  UpdateWorkflowStageRequest,
  UpdateWorkflowStageResponse,
} from "@/types/api";

export function createWorkflowItem(payload: CreateWorkflowItemRequest) {
  return apiRequest<CreateWorkflowItemResponse>("/workflow/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listWorkflowItems() {
  return apiRequest<ListWorkflowItemsResponse>("/workflow/items");
}

export function getWorkflowItem(itemId: string) {
  return apiRequest<WorkflowItem>(`/workflow/items/${itemId}`);
}

export function updateWorkflowStage(
  itemId: string,
  payload: UpdateWorkflowStageRequest,
) {
  return apiRequest<UpdateWorkflowStageResponse>(
    `/workflow/items/${itemId}/stage`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function updateWorkflowItem(itemId: string, payload: UpdateWorkflowItemRequest) {
  return apiRequest<UpdateWorkflowItemResponse>(`/workflow/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteWorkflowItem(itemId: string) {
  return apiRequest<DeleteWorkflowItemResponse>(`/workflow/items/${itemId}`, {
    method: "DELETE",
  });
}

export function listWorkflowActivityLogs() {
  return apiRequest<ListWorkflowActivityResponse>("/workflow/logs");
}

export async function uploadWorkflowAttachment(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  const response = await fetch(`${baseUrl}/workflow/uploads`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
  return (await response.json()) as UploadWorkflowAttachmentResponse;
}
