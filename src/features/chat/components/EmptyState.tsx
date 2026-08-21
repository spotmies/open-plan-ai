import { MessageSquare, MessagesSquare, AlertCircle, Bookmark, Star, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  type:
    | 'no-selection'
    | 'no-conversations'
    | 'no-messages'
    | 'no-favourites'
    | 'no-drafts'
    | 'no-saved-selection'
    | 'no-favourite-selection'
    | 'no-draft-selection'
    | 'error';
  onCreateGroup?: () => void;
  onRetry?: () => void;
  description?: string;
}

export function EmptyState({ type, onCreateGroup, onRetry, description }: EmptyStateProps) {
  const config = {
    'no-selection': {
      icon: MessageSquare,
      title: 'Select a conversation',
      description: 'Choose a conversation from the list to start messaging',
    },
    'no-conversations': {
      icon: MessagesSquare,
      title: 'No conversations yet',
      description: 'Start a new direct message or create a group to get started',
    },
    'no-favourites': {
      icon: MessagesSquare,
      title: 'No favorites yet',
      description: 'Hover a chat and pin it to add it to your favorites',
    },
    'no-drafts': {
      icon: MessagesSquare,
      title: 'No drafts',
      description: 'Messages you start typing but don’t send will show up here',
    },
    // Shown in the chat pane while a quick view is open but nothing in it has
    // been picked yet — Teams does the same rather than leaving whichever
    // conversation happened to be open behind the panel.
    'no-saved-selection': {
      icon: Bookmark,
      title: 'No saved item selected',
      description: 'When you select a saved item, it’ll show up here',
    },
    'no-favourite-selection': {
      icon: Star,
      title: 'No favorite selected',
      description: 'When you select a favorite chat, it’ll show up here',
    },
    'no-draft-selection': {
      icon: PenLine,
      title: 'No draft selected',
      description: 'When you select a draft, it’ll show up here',
    },
    'no-messages': {
      icon: MessageSquare,
      title: 'No messages yet',
      description: 'Send the first message to start the conversation',
    },
    'error': {
      icon: AlertCircle,
      title: 'Couldn’t load messages',
      description: 'Something went wrong while fetching this conversation. Please try again.',
    },
  }[type];

  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{config.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description || config.description}</p>
        {type === 'no-conversations' && onCreateGroup && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onCreateGroup}
          >
            + Create new Group
          </Button>
        )}
        {type === 'error' && onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
