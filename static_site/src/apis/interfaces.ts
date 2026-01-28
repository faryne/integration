export type ListByPaginationRequest<T> = {
  random?: number;
  page: number;
} & T;

export interface CommonResponse<T> {
  code: string;
  cost_time: number;
  message: string;
  uri: string;
  method: string;
  data: T;
}

export interface Pagination<T> {
  data: T,
  current_page: number,
  first_page_url: string,
  from: number,
  last_page: number,
  last_page_url: string,
  next_page_url: string,
  path: string,
  per_page: number,
  prev_page_url: string,
  to: number,
  total: number,
}