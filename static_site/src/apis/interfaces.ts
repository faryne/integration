export type ListByPaginationRequest<T> = {
  random: number;
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
