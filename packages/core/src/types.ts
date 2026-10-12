export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
}

export interface FileRecord {
  id: string;

  path: string;

  name: string;

  ext: string;
  size: number;
  mimeType: string;
  contentHash: string;

  createdAt: string;

  updatedAt: string;
  uploadedBy: UserSummary;
  editedBy: UserSummary | null;
}
