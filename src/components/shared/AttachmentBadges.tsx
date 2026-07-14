import { Link2, Image as ImageIcon, Video, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AttachmentCounts } from '@/types';

interface AttachmentBadgesProps {
  attachmentCounts?: AttachmentCounts;
  videoLinksCount?: number;
  className?: string;
  iconClassName?: string;
}

/** Small icon+count row for links/images/videos/other files — used on task & issue cards next to the date. */
export function AttachmentBadges({
  attachmentCounts,
  videoLinksCount = 0,
  className,
  iconClassName = 'h-3 w-3',
}: AttachmentBadgesProps) {
  const images = attachmentCounts?.images ?? 0;
  const videos = attachmentCounts?.videos ?? 0;
  const other = attachmentCounts?.other ?? 0;

  if (videoLinksCount === 0 && images === 0 && videos === 0 && other === 0) return null;

  return (
    <span className={cn('flex items-center gap-2 text-muted-foreground shrink-0', className)}>
      {videoLinksCount > 0 && (
        <span className="flex items-center gap-0.5">
          <Link2 className={iconClassName} />
          {videoLinksCount}
        </span>
      )}
      {images > 0 && (
        <span className="flex items-center gap-0.5">
          <ImageIcon className={iconClassName} />
          {images}
        </span>
      )}
      {videos > 0 && (
        <span className="flex items-center gap-0.5">
          <Video className={iconClassName} />
          {videos}
        </span>
      )}
      {other > 0 && (
        <span className="flex items-center gap-0.5">
          <Paperclip className={iconClassName} />
          {other}
        </span>
      )}
    </span>
  );
}
