import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation } from 'react-router-dom';
import { ProjectDetailSkeleton } from '@/features/projects/components/ProjectDetailSkeleton';

interface AppLayoutSkeletonProps {
  variant?: 'dashboard' | 'list' | 'detail' | 'project-detail' | 'default' | 'projects' | 'chat' | 'team' | 'settings' | 'notifications' | 'calendar' | 'reports';
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page title */}
      <div>
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-card p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <Skeleton className="h-5 w-28 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListPageSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 w-full min-w-0 animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-8 w-8" />
              </div>
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(col => (
          <div key={col} className="space-y-3">
            <div className="flex items-center gap-2 pb-3">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <div className="space-y-2 p-2 rounded-lg bg-muted/30 min-h-[200px]">
              {[0, 1].map(card => (
                <div key={card} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Main content card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="space-y-6">
          {/* Section 1 */}
          <div>
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div>
            <Skeleton className="h-5 w-28 mb-4" />
            <Skeleton className="h-24 w-full" />
          </div>

          {/* Section 3 */}
          <div>
            <Skeleton className="h-5 w-36 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded border">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultPageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page title */}
      <div>
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Generic content blocks */}
      <div className="rounded-lg border bg-card p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </div>
  );
}

function ProjectsPageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 flex-1 max-w-sm" />
        <Skeleton className="h-9 w-9 rounded" />
        <Skeleton className="h-9 w-9 rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-5 rounded" />
              </div>
            </div>
            <Skeleton className="h-4 w-3/4" />
            <div className="space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatSkeleton() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const hasConversationInRoute = /^\/chat\/[^/]+/.test(location.pathname);

  if (isMobile) {
    if (hasConversationInRoute) {
      return (
        <div className="flex h-full flex-col overflow-hidden animate-fade-in bg-background">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/70 shrink-0">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-4" />
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-3 py-3 space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`flex items-end gap-2 ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                {i % 2 === 0 && <Skeleton className="h-7 w-7 rounded-full shrink-0" />}
                <Skeleton className={`h-9 rounded-2xl ${i % 2 ? 'w-[62%]' : 'w-[72%]'}`} />
              </div>
            ))}
          </div>

          <div className="border-t border-border/70 px-2 py-2 shrink-0">
            <div className="flex items-center gap-2 rounded-2xl border border-input/80 px-2 py-1.5">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-8 flex-1 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col overflow-hidden animate-fade-in bg-background">
        <div className="px-3 py-3 border-b border-border/70 shrink-0">
          <Skeleton className="h-5 w-20 mb-3" />
          <Skeleton className="h-9 w-full rounded-md mb-2" />
          <div className="grid grid-cols-3 gap-1">
            <Skeleton className="h-7 rounded-md" />
            <Skeleton className="h-7 rounded-md" />
            <Skeleton className="h-7 rounded-md" />
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-1.5 py-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2.5 py-2.5 rounded-md">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-2.5 w-8" />
                </div>
                <Skeleton className="h-3 w-[72%] mt-1.5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden animate-fade-in">
      {/* Left: Conversation list - 280px */}
      <div className="w-[280px] shrink-0 flex flex-col border-r h-full">
        {/* Search bar */}
        <div className="p-3 border-b">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        {/* Conversation rows */}
        <div className="flex-1 overflow-hidden divide-y">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Message area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Chat header */}
        <div className="flex items-center gap-3 p-4 border-b shrink-0">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-hidden p-4 space-y-4">
          {/* Received message */}
          <div className="flex items-end gap-2">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-10 w-52 rounded-xl" />
            </div>
          </div>
          {/* Sent message */}
          <div className="flex items-end gap-2 justify-end">
            <Skeleton className="h-12 w-64 rounded-xl" />
          </div>
          {/* Received message */}
          <div className="flex items-end gap-2">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-16 w-48 rounded-xl" />
            </div>
          </div>
          {/* Sent message */}
          <div className="flex items-end gap-2 justify-end">
            <Skeleton className="h-10 w-40 rounded-xl" />
          </div>
        </div>

        {/* Message input */}
        <div className="p-3 border-t shrink-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="rounded-lg border bg-card p-4 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      {/* Search + view toggle */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-80" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded" />
          <Skeleton className="h-9 w-9 rounded" />
        </div>
      </div>
      {/* Member table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 p-3 border-b bg-muted/30">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-40 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-16" />
        </div>
        {/* Rows */}
        {[0,1,2,3,4].map(i => (
          <div key={i} className="flex items-center gap-4 p-3 border-b last:border-0">
            <div className="flex items-center gap-3 w-28">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40 flex-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Skeleton className="h-9 w-28 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* 5-tab nav */}
      <div className="flex gap-1">
        {[0,1,2,3,4].map(i => (
          <Skeleton key={i} className="h-10 w-24 rounded-md" />
        ))}
      </div>
      {/* Settings card */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        {/* Logo/avatar row */}
        <div className="flex items-center gap-6">
          <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        {/* Form fields */}
        {[0,1].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-4">
          {[0,1].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-44 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border bg-card p-4 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
      {/* Tab bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-9 w-20 rounded-md" />
        ))}
      </div>
      {/* Notification list */}
      <div className="rounded-lg border bg-card divide-y">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-start gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Layout Match */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div>
            <Skeleton className="h-8 w-32 mb-1.5" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Filters Row Layout Match */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-10 w-[200px] rounded-md" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-[280px] rounded-md" />
          <Skeleton className="h-9 w-[90px] rounded-md" />
        </div>
      </div>

      {/* KPI Row Layout Match */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="mt-3">
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Grid for Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-6 flex flex-col h-[400px]">
             <div className="flex justify-between items-center mb-6">
               <Skeleton className="h-5 w-40" />
               <Skeleton className="h-8 w-24 rounded-md" />
             </div>
             <Skeleton className="flex-1 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Full Width Chart Match */}
      <div className="rounded-lg border bg-card p-6 h-[400px] flex flex-col">
          <Skeleton className="h-5 w-40 mb-6" />
          <Skeleton className="flex-1 w-full rounded-lg" />
      </div>
    </div>
  );
}

// Used as Suspense fallback for /calendar route (full page)
function CalendarSkeleton() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-background animate-fade-in px-3 py-3">
        <div className="px-2 pt-2 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-5 w-10" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>

        <div className="px-2 py-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>

          <div className="flex justify-center mt-2">
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-border/50 px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-14" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-4" />
              </div>

              {i % 2 === 0 ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-2 rounded-md border border-border/60">
                    <Skeleton className="h-4 w-4 rounded-full mt-1" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </div>
              ) : (
                <Skeleton className="h-4 w-20" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6 animate-fade-in px-6 py-6">
      {/* Page Header - matches "Calendar" title + subtitle */}
      <div>
        <Skeleton className="h-8 w-28 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Calendar Nav row - matches: ← Today → [Date label] ............. [Month|Week|Day] [Filters] */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* ← Today → */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-14 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          {/* "March 2026" */}
          <Skeleton className="h-5 w-32" />
        </div>
        {/* Right: [Month|Week|Day] tabs + Filters */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-[140px] rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Calendar Grid - full bordered card */}
      <div className="flex-1 min-h-0 border border-border rounded-lg overflow-hidden bg-card flex flex-col">
        <CalendarGridSkeleton />
      </div>
    </div>
  );
}

// Exported — used inline inside Calendar.tsx while data loads
// (the page header + nav are already rendered, only the grid area is loading)
export function CalendarGridSkeleton() {
  return (
    <>
      {/* Weekday header row */}
      <div className="grid grid-cols-7 border-b border-border">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2 flex items-center justify-center">
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>

      {/* Fixed 6-row grid (42 cells) to match standard calendar layout and avoid dynamic allocation */}
      <div className="grid grid-cols-7 flex-1 min-h-0 auto-rows-fr">
        {[...Array(42)].map((_, i) => (
          <div
            key={i}
            className="p-2 border-b border-r border-border flex flex-col gap-1.5 min-h-[90px]"
          >
            {/* Date circle */}
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            {/* Sparse event bars to match real calendar look */}
            {i % 4 === 0 && <Skeleton className="h-5 w-full rounded" />}
            {i % 7 === 1 && <Skeleton className="h-5 w-3/4 rounded" />}
            {i % 9 === 2 && <Skeleton className="h-5 w-5/6 rounded" />}
          </div>
        ))}
      </div>
    </>
  );
}

function ProjectDetailAppSkeleton() {
  return <ProjectDetailSkeleton />;
}

const VARIANT_SKELETONS: Record<NonNullable<AppLayoutSkeletonProps['variant']>, React.ReactNode> = {
  dashboard: <DashboardSkeleton />,
  list: <ListPageSkeleton />,
  projects: <ProjectsPageSkeleton />,
  team: <TeamSkeleton />,
  settings: <SettingsSkeleton />,
  notifications: <NotificationsSkeleton />,
  chat: <ChatSkeleton />,
  detail: <DetailPageSkeleton />,
  'project-detail': <ProjectDetailAppSkeleton />,
  calendar: <CalendarSkeleton />,
  reports: <ReportsSkeleton />,
  default: <DefaultPageSkeleton />,
};

export function AppLayoutSkeleton({ variant = 'default' }: AppLayoutSkeletonProps) {
  return (
    <div role="status" aria-label="Loading" aria-busy="true">
      {VARIANT_SKELETONS[variant] ?? <DefaultPageSkeleton />}
    </div>
  );
}

