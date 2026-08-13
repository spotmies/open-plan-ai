import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OnlineStatus } from './OnlineStatus';
import { HighlightedText } from './HighlightedText';
import type { ReachableUser } from '../types';

interface PeopleListProps {
    users: ReachableUser[];
    onSelect: (userId: string) => void;
    onlineUserIds?: Set<string>;
    searchQuery?: string;
}

export function PeopleList({ users, onSelect, onlineUserIds, searchQuery }: PeopleListProps) {
    if (users.length === 0) return null;

    return (
        <div className="mt-4">
            <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                People
            </h3>
            <div className="space-y-0.5">
                {users.map((user) => (
                    <button
                        key={user.id}
                        onClick={() => onSelect(user.id)}
                        className="flex items-center gap-3 w-full px-3 py-2 text-left rounded-md hover:bg-accent/50 transition-colors"
                    >
                        <div className="relative shrink-0">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatarUrl} alt={user.name} />
                                <AvatarFallback className="text-xs">
                                    {user.initials}
                                </AvatarFallback>
                            </Avatar>
                            <OnlineStatus
                                isOnline={onlineUserIds?.has(user.id) ?? false}
                                className="absolute -bottom-0.5 -right-0.5"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate"><HighlightedText text={user.name} query={searchQuery} /></p>
                            <p className="text-xs text-muted-foreground truncate">{user.role}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
