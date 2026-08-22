import { useEffect, useState } from 'react';
import { format } from 'date-fns';

interface DashboardGreetingProps {
  name: string;
  attentionCount: number;
}

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardGreeting({ name, attentionCount }: DashboardGreetingProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
        {greetingForHour(now.getHours())}, {name}
      </h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        {format(now, 'EEEE, MMM d')}
        {attentionCount > 0 && (
          <> · {attentionCount} item{attentionCount === 1 ? '' : 's'} need your attention</>
        )}
      </p>
    </div>
  );
}
