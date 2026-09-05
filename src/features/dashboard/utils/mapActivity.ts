import { Activity } from '@/types';

interface RawActivity {
  id: string;
  type: Activity['type'];
  description?: string;
  title?: string;
  user?: { id?: string; name?: string };
  projectId: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt?: string;
}

// The activities endpoint doesn't return the `Activity` shape 1:1 (e.g. `createdAt`
// instead of `timestamp`, no `projectName`) — this normalizes a raw API record into
// the shape ActivityFeed/ActivityRow expect. Shared by the Dashboard card and the
// Settings > Activity full-list page so both interpret the API response the same way.
export function mapRawActivity(activity: RawActivity): Activity {
  const userName: string = activity.user?.name || 'Team Member';
  const initials: string = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'TM';

  return {
    id: activity.id,
    type: activity.type,
    title: (activity.description || activity.title || 'Activity').split(' ').slice(0, 3).join(' '),
    description: activity.description || activity.title || '',
    user: {
      id: activity.user?.id || 'unknown',
      name: userName,
      email: '',
      role: '',
      initials,
    },
    projectId: activity.projectId,
    projectName: '',
    entityType: activity.entityType ?? null,
    entityId: activity.entityId ?? null,
    timestamp: activity.createdAt || new Date().toISOString(),
  };
}
