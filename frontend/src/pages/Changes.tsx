import { Alert, Loader, Paper, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../api/client';
import type { RecentChange } from '../api/types';
import { IconHistory } from '@tabler/icons-react';
import { ChangeDelta, EmptyState, PageHeader, PersonCell, ReasonBadge } from '../components/ui';
import { useMoney } from '../currency';
import { formatDate } from '../lib/format';

export function Changes() {
  const money = useMoney();
  const query = useQuery({
    queryKey: ['recent'],
    queryFn: () => apiFetch<{ items: RecentChange[] }>('/api/salary-changes/recent?limit=50'),
  });

  return (
    <Stack>
      <PageHeader
        icon={IconHistory}
        title="Recent changes"
        description="The 50 latest salary changes by effective date, including new hires."
      />
      {query.isPending && <Loader />}
      {query.error && <Alert color="red">{query.error.message}</Alert>}
      {query.data && (
        <Paper withBorder>
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Effective</Table.Th>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Reason</Table.Th>
                  <Table.Th ta="right">From</Table.Th>
                  <Table.Th ta="right">To</Table.Th>
                  <Table.Th ta="right">Change</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td className="num">{formatDate(c.effectiveDate)}</Table.Td>
                    <Table.Td>
                      <PersonCell
                        id={c.employeeId}
                        firstName={c.employeeName.split(' ')[0]}
                        lastName={c.employeeName.split(' ').slice(1).join(' ')}
                        sub={c.employeeCode}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ReasonBadge reason={c.reason} />
                      {c.note && <Text size="xs" c="dimmed">{c.note}</Text>}
                    </Table.Td>
                    <Table.Td ta="right" className="num">
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
          </Table.ScrollContainer>
        </Paper>
      )}
    </Stack>
  );
}
