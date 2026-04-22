export interface CrawlerRule {
  name: string;
  pattern: string;
  multiple: boolean;
  trim?: boolean;
  attrs?: string[];
  child?: CrawlerRule[];
}
