import { Anchor, Group, Paper, SimpleGrid, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { IconCoins, IconHistory, IconLayoutDashboard, IconScale, IconUsers } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { apiFetch, qs } from '../api/client';
import type { BandCheck, Payroll, RecentChange } from '../api/types';
import { ChangeDelta, PageHeader, PersonCell, ReasonBadge, StatTile } from '../components/ui';
import { useMoney } from '../currency';
import { formatDate } from '../lib/format';
import { formatMinor } from '../lib/money';

const compact = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(
    minor / 100,
  );

export function Overview() {
  const money = useMoney();
  const currency = money.apiCurrency;
  const payroll = useQuery({
    queryKey: ['insights', 'payroll', currency],
    queryFn: () => apiFetch<Payroll>(`/api/insights/payroll${qs({ currency })}`),
  });
  const bands = useQuery({
    queryKey: ['insights', 'band-check', 'below', null, null, 1, 'summary'],
    queryFn: () => apiFetch<BandCheck>('/api/insights/band-check?position=below&pageSize=1'),
  });
  const recent = useQuery({
    queryKey: ['recent', 6],
    queryFn: () => apiFetch<{ items: RecentChange[] }>('/api/salary-changes/recent?limit=6'),
  });

  const headcount = payroll.data?.rows.reduce((n, r) => n + r.headcount, 0);
  const counts = bands.data?.counts;
  const withBand = counts ? counts.below + counts.within + counts.above : 0;
  const outside = counts ? counts.below + counts.above : 0;
  const rows = [...(payroll.data?.rows ?? [])].sort((a, b) => b.totalMinor - a.totalMinor);
  const max = Math.max(1, ...rows.map((r) => r.totalMinor));

  return (
    <>
      <PageHeader
        icon={IconLayoutDashboard}
        title="Overview"
        description={`Where ACME's pay stands today. Company-wide figures in ${currency}.`}
      />

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} mb="lg">
        <StatTile
          icon={IconUsers}
          label="Active employees"
          value={headcount?.toLocaleString('en-US') ?? <Skeleton h={34} w={90} />}
          note="Across 5 countries"
          to="/employees?status=active"
        />
        <StatTile
          icon={IconCoins}
          label="Annual payroll"
          value={payroll.data ? compact(payroll.data.totalMinor, currency) : <Skeleton h={34} w={110} />}
          note={payroll.data ? `Base salary, rates as of ${formatDate(payroll.data.rateAsOf)}` : ' '}
          to="/payroll"
        />
        <StatTile
          icon={IconScale}
          label="Outside their band"
          value={counts ? outside.toLocaleString('en-US') : <Skeleton h={34} w={70} />}
          note={counts ? `${counts.below} below, ${counts.above} above (${((outside / withBand) * 100).toFixed(1)}%)` : ' '}
          to="/outside-band"
        />
        <StatTile
          icon={IconHistory}
          label="Latest salary change"
          value={recent.data?.items[0] ? formatDate(recent.data.items[0].effectiveDate) : <Skeleton h={34} w={120} />}
          note={recent.data?.items[0]?.employeeName}
          to="/changes"
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Paper withBorder p="lg">
          <Group justify="space-between" mb="md">
            <Title order={2} size="h4" className="panel-title">
              <IconCoins size={20} stroke={1.7} aria-hidden="true" /> Payroll by department
            </Title>
            <Anchor component={Link} to="/payroll" size="sm">
              See all
            </Anchor>
          </Group>
          <Stack gap="sm">
            {payroll.isPending && <Skeleton h={180} />}
            {rows.slice(0, 6).map((r) => (
              <div key={r.department}>
                <Group justify="space-between" mb={4}>
                  <Text size="sm" fw={600}>
                    {r.department}
                  </Text>
                  <Text size="sm" className="num">
                    {formatMinor(r.totalMinor, currency, { cents: false })}
                  </Text>
                </Group>
                <div className="bar" style={{ width: `${(r.totalMinor / max) * 100}%` }} />
              </div>
            ))}
          </Stack>
        </Paper>

        <Paper withBorder p="lg">
          <Group justify="space-between" mb="md">
            <Title order={2} size="h4" className="panel-title">
              <IconHistory size={20} stroke={1.7} aria-hidden="true" /> Recent salary changes
            </Title>
            <Anchor component={Link} to="/changes" size="sm">
              See all
            </Anchor>
          </Group>
          {recent.isPending && <Skeleton h={180} />}
          <Table verticalSpacing={8}>
            <Table.Tbody>
              {recent.data?.items.map((c) => {
                const [firstName, ...rest] = c.employeeName.split(' ');
                return (
                  <Table.Tr key={c.id}>
                    <Table.Td>
                      <PersonCell id={c.employeeId} firstName={firstName} lastName={rest.join(' ')} sub={formatDate(c.effectiveDate)} />
                    </Table.Td>
                    <Table.Td>
                      <ReasonBadge reason={c.reason} />
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" className="num">
                        {money.format(c.amountMinor, c.currency, { cents: false })}
                      </Text>
                      <ChangeDelta pct={c.changePct} />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      </SimpleGrid>
    </>
  );
}
