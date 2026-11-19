import { Alert, SegmentedControl, Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../api/client';
import type { RecentChange } from '../api/types';
import { IconHistory } from '@tabler/icons-react';
import { ChangeDelta, EmptyState, PageHeader, PageLoader, PersonCell, ReasonBadge, TableCard, TablePager } from '../components/ui';
import { useMoney } from '../currency';
import { formatDate } from '../lib/format';

export function Changes() {
  const money = useMoney();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Pay changes first: hires dominate the raw feed and hide the question "whose pay changed, and why?".
  const [show, setShow] = useState<'changes' | 'all'>('changes');
  const query = useQuery({
    queryKey: ['recent', 100, show],
    // The API returns at most the 100 latest rows; the page shows them 10 (or 25, 50) at a time.
    queryFn: () =>
      apiFetch<{ items: RecentChange[] }>(`/api/salary-changes/recent?limit=100&excludeHires=${show === 'changes'}`),
  });
  const items = query.data?.items ?? [];
  const visible = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Stack>
      <PageHeader
        icon={IconHistory}
        title="Recent changes"
        description="The latest salary changes by effective date, with the amount each one replaced."
      />
      {query.error && <Alert color="red">{query.error.message}</Alert>}
      <TableCard
        toolbar={
          <SegmentedControl
            value={show}
            onChange={(v) => {
              setShow(v as 'changes' | 'all');
              setPage(1);
            }}
            data={[
              { value: 'changes', label: 'Pay changes' },
              { value: 'all', label: 'Including new hires' },
            ]}
          />
        }
        footer={
          items.length > 0 ? (
            <TablePager
              total={items.length}
              page={page}
              pageSize={pageSize}
              noun={show === 'changes' ? 'latest pay changes' : 'latest changes'}
              onPage={setPage}
              onPageSize={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : undefined
        }
      >
        {query.isPending && <PageLoader label="Loading changes" minHeight={320} />}
        {query.data && (
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th visibleFrom="sm">Effective</Table.Th>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th visibleFrom="md">Reason</Table.Th>
                  <Table.Th ta="right" visibleFrom="lg">From</Table.Th>
                  <Table.Th ta="right">To</Table.Th>
                  <Table.Th ta="right">Change</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td className="num" visibleFrom="sm">{formatDate(c.effectiveDate)}</Table.Td>
                    <Table.Td>
                      <PersonCell
                        id={c.employeeId}
                        firstName={c.employeeName.split(' ')[0]}
                        lastName={c.employeeName.split(' ').slice(1).join(' ')}
                        sub={c.employeeCode}
                      />
                    </Table.Td>
                    <Table.Td visibleFrom="md">
                      <ReasonBadge reason={c.reason} />
                      {c.note && <Text size="xs" c="dimmed">{c.note}</Text>}
                    </Table.Td>
                    <Table.Td ta="right" className="num" visibleFrom="lg">
                      {c.previousMinor === null ? '' : money.format(c.previousMinor, c.currency, { cents: false })}
                    </Table.Td>
                    <Table.Td ta="right" className="num">{money.format(c.amountMinor, c.currency, { cents: false })}</Table.Td>
                    <Table.Td ta="right">
                      {c.changePct === null ? <span className="icon-muted">New hire</span> : <ChangeDelta pct={c.changePct} />}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {query.data.items.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <EmptyState title="No salary changes yet">Record one from an employee's profile.</EmptyState>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
        )}
      </TableCard>
    </Stack>
  );
}
