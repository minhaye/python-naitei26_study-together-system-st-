/** Mirrors app/core/dto/pagination_dto.py's PaginatedResponse -- the `{items, total}`
 * envelope returned by list endpoints that back a paged UI table. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}
