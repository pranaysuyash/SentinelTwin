"use client";

import { type ReactNode } from "react";

export function DockLayout({
  leftDock,
  rightDock,
  bottomDock,
  children,
}: {
  leftDock: ReactNode;
  rightDock: ReactNode;
  bottomDock: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {leftDock}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
        {bottomDock}
      </div>
      {rightDock}
    </div>
  );
}
