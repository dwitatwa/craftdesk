import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto bg-background/50 relative">
          {/* Dot Grid Overlay */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#1A1A1A_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
          <div className="relative h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
