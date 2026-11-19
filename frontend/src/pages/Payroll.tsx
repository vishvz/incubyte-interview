import { Alert, Loader, Paper, Stack, Table } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, qs } from '../api/client';
import type { Payroll as PayrollData } from '../api/types';
import { IconCoins } from '@tabler/icons-react';
import { PageHeader } from '../components/ui';
import { useMoney } from '../currency';
import { formatDate } from '../lib/format';
import { formatMinor } from '../lib/money';

export function Payroll() {
  const { apiCurrency: currency } = useMoney();
  const query = useQuery({
    queryKey: ['insights', 'payroll', currency],
    queryFn: () => apiFetch<PayrollData>(`/api/insights/payroll${qs({ currency })}`),
  });
  const data = query.data;
  const rows = [...(data?.rows ?? [])].sort((a, b) => b.totalMinor - a.totalMinor);
  const max = Math.max(1, ...rows.map((r) => r.totalMinor));
  const f = (m: number) => formatMinor(m, currency, { cents: false });

  return (
    <Stack>
      <PageHeader
        icon={IconCoins}
        title="Payroll by department"
        description={`Total annual base salary of active employees, in ${currency}${data ? ` at rates as of ${formatDate(data.rateAsOf)}` : ''}. Choose another currency in the sidebar.`}
      />
      {query.isPending && <Loader />}
      {query.error && <Alert color="red">{query.error.message}</Alert>}
      {data && (
        <Paper withBorder p="lg" maw={900}>
          <Table.ScrollContainer minWidth={560}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Department</Table.Th>
                  <Table.Th ta="right">People</Table.Th>
                  <Table.Th w="40%" aria-label="Share of payroll" />
                  <Table.Th ta="right">Annual payroll</Table.Th>
                  <Table.Th ta="right">Share</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.department}>
                    <Table.Td fw={600}>{r.department}</Table.Td>
                    <Table.Td ta="right" className="num">{r.headcount.toLocaleString('en-US')}</Table.Td>
                    <Table.Td>
                      <div className="bar" style={{ width: `${(r.totalMinor / max) * 100}%` }} title={f(r.totalMinor)} />
                    </Table.Td>
                    <Table.Td ta="right" className="num">{f(r.totalMinor)}</Table.Td>
                    <Table.Td ta="right" className="num">{((r.totalMinor / data.totalMinor) * 100).toFixed(1)}%</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th>Total</Table.Th>
                  <Table.Th ta="right" className="num">
                    {rows.reduce((n, r) => n + r.headcount, 0).toLocaleString('en-US')}
                  </Table.Th>
                  <Table.Th />
                  <Table.Th ta="right" className="num">{f(data.totalMinor)}</Table.Th>
                  <Table.Th ta="right">100%</Table.Th>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}
    </Stack>
  );
}
