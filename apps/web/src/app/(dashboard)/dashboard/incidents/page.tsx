'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/form';
import { StatusDot } from '@/components/ui/status';
import { Table, TableWrap, Td, Th, EmptyState, Pagination } from '@/components/ui/table';
import { useIncidents } from '@/hooks/api';
import { formatDateTime, formatDuration } from '@/lib/format';
import styles from './incidents.module.css';

export default function IncidentsPage() {
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED' | ''>('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useIncidents(status === '' ? undefined : status, page);

  return (
    <>
      <PageHeader
        title="Incidents"
        subtitle="Every down event with cause and resolution time."
        action={
          <Select
            aria-label="Filter incidents"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as 'OPEN' | 'RESOLVED' | '');
              setPage(1);
            }}
            className={styles.filter}
          >
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
        }
      />

      <Card padded={false}>
        {isLoading ? (
          <div className={styles.loading}>Loading incidents…</div>
        ) : (data?.data ?? []).length === 0 ? (
          <EmptyState
            icon={<AlertTriangle size={22} aria-hidden />}
            title="No incidents"
            hint="When a monitor goes down and confirms, it appears here."
          />
        ) : (
          <>
            <TableWrap>
              <Table aria-label="Incidents">
                <thead>
                  <tr>
                    <Th>Monitor</Th>
                    <Th>Cause</Th>
                    <Th>Started</Th>
                    <Th>Duration</Th>
                    <Th>State</Th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.data ?? []).map((i) => (
                    <tr key={i.id}>
                      <Td className={styles.monitor}>{i.monitorName}</Td>
                      <Td className={styles.cause}>{i.cause ?? 'check failed'}</Td>
                      <Td className="secondary">{formatDateTime(i.startedAt)}</Td>
                      <Td className="numeric">{formatDuration(i.startedAt, i.resolvedAt)}</Td>
                      <Td>
                        <StatusDot status={i.status === 'OPEN' ? 'DOWN' : 'UP'} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <div className={styles.paginationWrap}>
              {data?.meta !== undefined ? (
                <Pagination
                  page={data.meta.page}
                  total={data.meta.total}
                  limit={data.meta.limit}
                  onChange={setPage}
                />
              ) : null}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
