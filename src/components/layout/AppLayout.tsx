import { ReactNode, useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useUserStore } from '@/stores/useUserStore';
import { useUIChromeStore } from '@/stores/useUIChromeStore';
import { useGlobalChatRealtime } from '@/features/chat/hooks/useGlobalChatRealtime';
import { usePresence } from '@/features/chat/hooks/usePresence';
import { useProjectMembershipRealtime, useConversationMembershipRealtime } from '@/hooks/useWorkspaceMembershipRealtime';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppLayoutProps {
  children: ReactNode;
  noPadding?: boolean;
}

export function AppLayout({ children, noPadding }: AppLayoutProps) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const preferences = useUserStore((s) => s.preferences);
  const updatePreferences = useUserStore((s) => s.updatePreferences);
  const hideAppHeaderFlag = useUIChromeStore((s) => s.hideAppHeader);

  const { user } = useAuth();

  // Initialize global chat notifications and presence
  useGlobalChatRealtime();
  usePresence(user?.id);
  useProjectMembershipRealtime();
  useConversationMembershipRealtime();

  // Apply compact mode class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.compactMode) {
      root.classList.add('compact');
    } else {
      root.classList.remove('compact');
    }
  }, [preferences.compactMode]);

  const isConversationRoute = /^\/chat\/[^/]+/.test(location.pathname);
  // The assistant page builds its own ChatGPT-style header + drawer nav on
  // mobile (see Assistant.tsx) — the global chrome would just duplicate it.
  const isAssistantRoute = location.pathname.startsWith('/assistant');
  const showAppHeader = !(isMobile && (isConversationRoute || isAssistantRoute || hideAppHeaderFlag));
  const showMobileBottomNav = isMobile && !isConversationRoute && !isAssistantRoute;

  return (
    <SidebarProvider
      defaultOpen={!preferences.sidebarCollapsed}
    >
      <div className="h-screen flex w-full bg-background overflow-hidden">
        {/* Sidebar hidden on mobile */}
        {!isMobile && <AppSidebar />}
        <div className={`flex-1 flex flex-col h-full min-h-0 min-w-0 `}>
          {showAppHeader && <AppHeader />}
          <main
            className={[
              noPadding ? 'flex-1 min-h-0 overflow-hidden' : `flex-1 min-h-0 overflow-y-auto ${isMobile ? 'overflow-x-hidden p-4' : 'p-6'}`,
              showMobileBottomNav ? 'pb-24' : '',
            ].join(' ')}
          >
            {children}
          </main>
        </div>
      </div>
      {/* Mobile bottom navigation */}
      {showMobileBottomNav && <MobileBottomNav />}
    </SidebarProvider>
  );
}

