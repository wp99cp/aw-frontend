export interface Bucket {
  id: string;
  name: string;
  type: string;
  client: string;
  hostname: string;
  created: string;
  data: Record<string, unknown>;
  events?: Event[];
}

export interface EventData {
  app?: string;
  title?: string;
  url?: string;
  tags?: string[];
  description?: string;
  [key: string]: unknown;
}

export interface Event {
  id?: number;
  bucketId?: string; // valid for tracking source bucket
  timestamp: string;
  duration: number;
  data: EventData;
}

export interface CreateBucket {
  client: string;
  type: string;
  hostname: string;
}

export interface Query {
  timeperiods: string[];
  query: string[];
}

export interface UncategorizedGroup {
  key: string;
  events: Event[];
  duration: number;
  appName: string;
  title: string;
  domain?: string;
  isWebsite?: boolean;
}

export type FilterType = "all" | "websites" | "apps";
