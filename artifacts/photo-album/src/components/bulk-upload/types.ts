export interface FolderEntry {
  id: string;
  name: string;
  files: File[];
}

export interface DuplicateFile {
  name: string;
  size: number;
  folderId: string;
  skip: boolean;
}
