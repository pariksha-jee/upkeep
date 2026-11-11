'use client';

import { use } from 'react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { MonitorForm } from '@/components/monitors/MonitorForm';
import { CardSkeleton } from '@/components/ui/card';
import { useMonitor } from '@/hooks/api';

export default function EditMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: monitor, isLoading } = useMonitor(id);

  return (
    <>
      <PageHeader title="Edit monitor" subtitle={monitor?.name ?? ''} />
      {isLoading || monitor === undefined ? (
        <CardSkeleton rows={6} />
      ) : (
        <MonitorForm monitor={monitor} />
      )}
    </>
  );
}
