import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { ToggleableFeature } from '@/stores/useFeatureTogglesStore';

export type FeatureTogglesResponse = Record<ToggleableFeature, boolean>;

// Backend field names differ slightly from the frontend's ToggleableFeature
// keys ('my-tasks' vs 'myTasks') — kept separate so each side stays idiomatic.
interface ApiFeatureToggles {
  myTasks: boolean;
  calendar: boolean;
  reports: boolean;
  inventory: boolean;
  support: boolean;
}

function fromApi(raw: ApiFeatureToggles): FeatureTogglesResponse {
  return {
    'my-tasks': raw.myTasks,
    calendar: raw.calendar,
    reports: raw.reports,
    inventory: raw.inventory,
    support: raw.support,
  };
}

function toApiKey(feature: ToggleableFeature): keyof ApiFeatureToggles {
  return feature === 'my-tasks' ? 'myTasks' : feature;
}

export const featureTogglesService = {
  async getToggles(): Promise<FeatureTogglesResponse> {
    const raw = await apiClient.get<ApiFeatureToggles>(ENDPOINTS.FEATURE_TOGGLES);
    return fromApi(raw);
  },

  async setToggle(feature: ToggleableFeature, enabled: boolean): Promise<FeatureTogglesResponse> {
    const raw = await apiClient.patch<ApiFeatureToggles>(ENDPOINTS.FEATURE_TOGGLES, {
      [toApiKey(feature)]: enabled,
    });
    return fromApi(raw);
  },
};
