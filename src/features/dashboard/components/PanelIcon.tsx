import { softTint } from '../utils/colors';

interface PanelIconProps {
  icon: React.ElementType;
  color: string;
}

export function PanelIcon({ icon: Icon, color }: PanelIconProps) {
  return (
    <span
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: softTint(color, 0.12) }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color }} />
    </span>
  );
}
