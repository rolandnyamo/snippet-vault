export type ItemType = 'link' | 'kusto_query';

export interface Item {
  id: string;
  type: ItemType;
  payload: string;
  description: string;
  created_at: string;
  last_accessed_at: string;
  embedding_model: string;
}

export interface Config {
  storage_path: string;
}

export interface SearchResult extends Omit<Item, 'vector'> {
  score?: number;
}
