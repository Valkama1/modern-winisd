import { ReactNode } from "react";

interface PanelHeaderProps {
  children: ReactNode;
  action?: ReactNode;
}

export function PanelHeader({ children, action }: PanelHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <h4 className="text-xs font-semibold opacity-70 uppercase tracking-wider">{children}</h4>
      {action}
    </div>
  );
}
