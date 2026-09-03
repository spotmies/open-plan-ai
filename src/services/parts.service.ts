import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { ApiPartResponse, ApiRevisionResponse, BOMStatus, BOMCategory, SupplierEntry } from '@/features/projects/components/bomData';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreatePartDto {
  partNumber: string;
  name: string;
  description: string;
  category: BOMCategory;
  manufacturer?: string;
  distributor?: string;
  mpn?: string;
  unit?: string;
  notes?: string;
  imageUrl?: string | null;
  // Initial revision overrides (the revision itself only ever has these two
  // states — 'draft'/'rejected' exist only at the BOM-node level)
  initialStatus?: 'approved' | 'pending';
  initialRev?: string;
  initialPrice?: number;
  initialLeadTimeDays?: number;
  initialSuppliers?: SupplierEntry[];
  /** "Additional Fields" — accepted on create, not only on update. */
  customFields?: CustomFieldEntry[] | null;
}

export interface CustomFieldEntry {
  label: string;
  value: string;
}

export type UpdatePartDto = Partial<Omit<CreatePartDto, 'partNumber'>>;

export interface CreateRevisionDto {
  rev: string;
  changes: string;
  author?: string;
  status: BOMStatus;
  price?: number;
  leadTimeDays?: number;
  quantity?: number;
  ecoId?: string;
  name?: string;
  description?: string;
  category?: BOMCategory;
  manufacturer?: string;
  distributor?: string;
  mpn?: string;
  suppliers?: SupplierEntry[];
}

export interface ListPartsResult {
  data: ApiPartResponse[];
  meta: PaginationMeta;
}

export const partsService = {
  async list(
    orgId: string,
    params?: { search?: string; category?: string; page?: number; limit?: number },
  ): Promise<ListPartsResult> {
    const query = new URLSearchParams();
    if (params?.search)   query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.page)     query.set('page', String(params.page));
    if (params?.limit)    query.set('limit', String(params.limit));
    const qs = query.toString();
    const url = qs ? `${ENDPOINTS.PARTS.LIST(orgId)}?${qs}` : ENDPOINTS.PARTS.LIST(orgId);
    return apiClient.raw.get(url).then((r) => ({ data: r.data.data, meta: r.data.meta }));
  },

  async create(orgId: string, dto: CreatePartDto): Promise<ApiPartResponse> {
    return apiClient.post<ApiPartResponse>(ENDPOINTS.PARTS.CREATE(orgId), dto);
  },

  async getById(partId: string): Promise<ApiPartResponse> {
    return apiClient.get<ApiPartResponse>(ENDPOINTS.PARTS.BY_ID(partId));
  },

  async update(partId: string, dto: UpdatePartDto): Promise<ApiPartResponse> {
    return apiClient.put<ApiPartResponse>(ENDPOINTS.PARTS.BY_ID(partId), dto);
  },

  async delete(partId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.PARTS.BY_ID(partId));
  },

  async getRevisions(partId: string): Promise<ApiRevisionResponse[]> {
    return apiClient.get<ApiRevisionResponse[]>(ENDPOINTS.PARTS.REVISIONS(partId));
  },

  async createRevision(partId: string, dto: CreateRevisionDto): Promise<ApiRevisionResponse> {
    return apiClient.post<ApiRevisionResponse>(ENDPOINTS.PARTS.REVISIONS(partId), dto);
  },
};
