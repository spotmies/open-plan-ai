import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

// Org-wide Warehouse -> Shelf -> Box location hierarchy. The backend also
// auto-registers a top-level node for any free-text location still supplied
// by a caller that hasn't moved to the real picker (see the backend's
// ensureLocation) — so a location can still show up here just from being
// used once, same as before the hierarchy existed.
export type LocationKind = 'warehouse' | 'shelf' | 'box';

export interface ApiLocation {
  id: string;
  orgId: string;
  parentId: string | null;
  kind: LocationKind;
  name: string;
  // Resolved "Warehouse A / Shelf 3 / Box 12" — the backend computes this,
  // not stored, so it's always current even if a name changed upstream.
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
  parentId?: string | null;
  kind?: LocationKind;
}

export const locationsService = {
  async getByOrgId(orgId: string): Promise<ApiLocation[]> {
    return (await apiClient.get<ApiLocation[]>(ENDPOINTS.LOCATIONS.LIST(orgId))) || [];
  },

  async create(orgId: string, input: CreateLocationInput): Promise<ApiLocation> {
    return apiClient.post<ApiLocation>(ENDPOINTS.LOCATIONS.CREATE(orgId), input);
  },

  async rename(orgId: string, locationId: string, name: string): Promise<ApiLocation> {
    return apiClient.patch<ApiLocation>(ENDPOINTS.LOCATIONS.UPDATE(orgId, locationId), { name });
  },

  async remove(orgId: string, locationId: string): Promise<void> {
    await apiClient.delete<void>(ENDPOINTS.LOCATIONS.DELETE(orgId, locationId));
  },
};
