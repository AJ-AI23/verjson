export interface NotationComment {
  id: string;
  timestamp: string;
  user: string;
  message: string;
}

export interface SchemaNotations {
  [path: string]: NotationComment[];
}

export interface NotationData {
  notations?: NotationComment[];
  hasNotations?: boolean;
  notationCount?: number;
}