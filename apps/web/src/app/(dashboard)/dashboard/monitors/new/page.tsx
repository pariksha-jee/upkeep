'use client';

import { PageHeader } from '@/components/layout/DashboardLayout';
import { MonitorForm } from '@/components/monitors/MonitorForm';

export default function NewMonitorPage() {
  return (
    <>
      <PageHeader
        title="Add monitor"
        subtitle="Watch a public endpoint, or reach private ones through a tunnel."
      />
      <MonitorForm />
    </>
  );
}
