import { Alert, Group, SegmentedControl, Select, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, qs } from '../api/client';
import type { Band, CountryLevelRow, DepartmentRow, Distribution, Quartiles } from '../api/types';
import { paddedDomain, RangeBar } from '../components/RangeBar';
import { IconBuilding, IconChartBar, IconStairs, IconWorld } from '@tabler/icons-react';
import { PageHeader, TableCard, PageLoader } from '../components/ui';
import { useMeta, useMoney } from '../currency';
import { formatDate } from '../lib/format';
import { formatMinor } from '../lib/money';

function Legend({ withBand }: { withBand: boolean }) {
  return (
    <Group gap="lg" mb="sm" aria-hidden="true">
      {withBand && (
        <Group gap={6}>
          <span style={{ width: 22, height: 12, background: 'var(--band-strong)', borderRadius: 4 }} />
          <Text size="xs">Pay band (min to max)</Text>
        </Group>
      )}
      <Group gap={6}>
        <span style={{ width: 22, height: 8, background: 'var(--quartile)', borderRadius: 4 }} />
        <Text size="xs">Middle half of salaries (P25 to P75)</Text>
      </Group>
      <Group gap={6}>
        <span style={{ width: 3, height: 16, background: 'var(--median)', borderRadius: 2 }} />
        <Text size="xs">Median</Text>
      </Group>
    </Group>
  );
}

export function PayRanges() {
  const [view, setView] = useState<'level' | 'department'>('level');
  return (
    <Stack>
      <PageHeader
        icon={IconChartBar}
        title="Pay ranges"
        description="Medians rather than averages, so a few high earners do not skew the picture. Active employees only."
      />
      <SegmentedControl
        w="fit-content"
        value={view}
        onChange={(v) => setView(v as 'level' | 'department')}
        data={[
          { value: 'level', label: <span className="seg-label"><IconStairs size={16} aria-hidden="true" /> By level in a country</span> },
          { value: 'department', label: <span className="seg-label"><IconBuilding size={16} aria-hidden="true" /> By department</span> },
        ]}
      />
      {view === 'level' ? <ByLevel /> : <ByDepartment />}
    </Stack>
  );
}

function RangeTable<T extends Quartiles & { band?: Band | null }>({
  rows,
  name,
  rowKey,
  withBand,
}: {
  rows: T[];
  name: string;
  rowKey: (r: T) => string;
  withBand: boolean;
}) {
  const domain = paddedDomain(
    rows.flatMap((r) => [r.p25Minor, r.p75Minor, r.band?.minMinor ?? r.p25Minor, r.band?.maxMinor ?? r.p75Minor]),
  );
  return (
    <Table verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{name}</Table.Th>
          <Table.Th ta="right" visibleFrom="xs">People</Table.Th>
          <Table.Th w="40%" visibleFrom="sm">{withBand ? 'Salaries against the pay band' : 'Spread of salaries'}</Table.Th>
          <Table.Th ta="right" visibleFrom="md">P25</Table.Th>
          <Table.Th ta="right">Median</Table.Th>
          <Table.Th ta="right" visibleFrom="md">P75</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((r) => {
          const f = (m: number) => formatMinor(m, r.currency, { cents: false });
          return (
            <Table.Tr key={rowKey(r)}>
              <Table.Td fw={600}>{rowKey(r)}</Table.Td>
              <Table.Td ta="right" className="num" visibleFrom="xs">
                {r.headcount.toLocaleString('en-US')}
              </Table.Td>
              <Table.Td visibleFrom="sm">
                <RangeBar
                  domain={domain}
                  band={r.band}
                  quartiles={r}
                  label={`${rowKey(r)}: median ${f(r.medianMinor)}, middle half ${f(r.p25Minor)} to ${f(r.p75Minor)}${r.band ? `, band ${f(r.band.minMinor)} to ${f(r.band.maxMinor)}` : ''}`}
                />
              </Table.Td>
              <Table.Td ta="right" className="num" visibleFrom="md">{f(r.p25Minor)}</Table.Td>
              <Table.Td ta="right" className="num" fw={650}>{f(r.medianMinor)}</Table.Td>
              <Table.Td ta="right" className="num" visibleFrom="md">{f(r.p75Minor)}</Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

function ByLevel() {
  const { data: meta } = useMeta();
  const money = useMoney();
  const [country, setCountry] = useState('US');
  const currency = money.display;
  const query = useQuery({
    queryKey: ['insights', 'distribution', 'country_level', country, currency],
    queryFn: () =>
      apiFetch<Distribution<CountryLevelRow>>(`/api/insights/distribution${qs({ by: 'country_level', country, currency })}`),
  });

  return (
    <TableCard
      toolbar={
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <Select
              aria-label="Country"
              leftSection={<IconWorld size={16} />}
              value={country}
              onChange={(v) => v && setCountry(v)}
              data={meta?.countries.map((c) => ({ value: c.code, label: c.name })) ?? []}
              allowDeselect={false}
              w={220}
            />
            {query.data && currency !== 'local' && (
              <Text size="xs" c="dimmed">
                Converted to {currency} at rates as of {formatDate(query.data.rateAsOf)}
              </Text>
            )}
          </Group>
          <Legend withBand />
        </Stack>
      }
    >
      {query.isPending && <PageLoader label="Loading" minHeight={280} />}
      {query.error && <Alert color="red" m="md">{query.error.message}</Alert>}
      {query.data && <RangeTable rows={query.data.rows} name="Level" rowKey={(r) => r.level} withBand />}
    </TableCard>
  );
}

function ByDepartment() {
  const money = useMoney();
  const currency = money.apiCurrency;
  const query = useQuery({
    queryKey: ['insights', 'distribution', 'department', currency],
    queryFn: () => apiFetch<Distribution<DepartmentRow>>(`/api/insights/distribution${qs({ by: 'department', currency })}`),
  });

  return (
    <TableCard
      toolbar={
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Departments span countries, so every salary is converted to {currency}
            {query.data ? ` at rates as of ${formatDate(query.data.rateAsOf)}` : ''}. Compare with care: pay levels differ by
            country.
          </Text>
          <Legend withBand={false} />
        </Stack>
      }
    >
      {query.isPending && <PageLoader label="Loading" minHeight={280} />}
      {query.error && <Alert color="red" m="md">{query.error.message}</Alert>}
      {query.data && <RangeTable rows={query.data.rows} name="Department" rowKey={(r) => r.department} withBand={false} />}
    </TableCard>
  );
}
