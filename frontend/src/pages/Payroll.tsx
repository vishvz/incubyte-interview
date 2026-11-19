import { Alert, Stack, Table } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, qs } from '../api/client';
import type { Payroll as PayrollData } from '../api/types';
import { IconCoins } from '@tabler/icons-react';
import { PageHeader, TableCard, PageLoader } from '../components/ui';
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
      {query.error && <Alert color="red">{query.error.message}</Alert>}
      <TableCard>
        {query.isPending && <PageLoader label="Loading" minHeight={280} />}
        {data && (
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Department</Table.Th>
                  <Table.Th ta="right" visibleFrom="xs">People</Table.Th>
                  <Table.Th w="40%" visibleFrom="sm">Share of payroll</Table.Th>
                  <Table.Th ta="right">Annual payroll</Table.Th>
                  <Table.Th ta="right" visibleFrom="md">Share</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.department}>
                    <Table.Td fw={600}>{r.department}</Table.Td>
                    <Table.Td ta="right" className="num" visibleFrom="xs">{r.headcount.toLocaleString('en-US')}</Table.Td>
                    <Table.Td visibleFrom="sm">
                      <div className="bar" style={{ width: `${(r.totalMinor / max) * 100}%` }} title={f(r.totalMinor)} />
                    </Table.Td>
                    <Table.Td ta="right" className="num">{f(r.totalMinor)}</Table.Td>
                    <Table.Td ta="right" className="num" visibleFrom="md">{((r.totalMinor / data.totalMinor) * 100).toFixed(1)}%</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th>Total</Table.Th>
                  <Table.Th ta="right" className="num" visibleFrom="xs">
                    {rows.reduce((n, r) => n + r.headcount, 0).toLocaleString('en-US')}
                  </Table.Th>
                  <Table.Th visibleFrom="sm" />
                  <Table.Th ta="right" className="num">{f(data.totalMinor)}</Table.Th>
                  <Table.Th ta="right" visibleFrom="md">100%</Table.Th>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
        )}
      </TableCard>
    </Stack>
  );
}
