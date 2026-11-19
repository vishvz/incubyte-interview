import { Alert, Group, Loader, Paper, SegmentedControl, Select, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, qs } from '../api/client';
import type { CountryLevelRow, DepartmentRow, Distribution } from '../api/types';
import { paddedDomain, RangeBar } from '../components/RangeBar';
import { useMeta, useMoney } from '../currency';
import { formatDate } from '../lib/format';
import { formatMinor } from '../lib/money';

function Legend({ withBand }: { withBand: boolean }) {
  return (
    <Group gap="lg" mb="sm" aria-hidden="true">
      {withBand && (
        <Group gap={6}>
          <span style={{ width: 22, height: 12, background: 'var(--band)', border: '1px solid var(--band-edge)' }} />
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
      <div>
        <Title order={1} size="h2">
          Pay ranges
        </Title>
        <Text c="dimmed" size="sm">
          Medians rather than averages, so a few high earners do not skew the picture. Active employees only.
        </Text>
      </div>
      <SegmentedControl
        w="fit-content"
        value={view}
        onChange={(v) => setView(v as 'level' | 'department')}
        data={[
          { value: 'level', label: 'By level in a country' },
          { value: 'department', label: 'By department' },
        ]}
      />
      {view === 'level' ? <ByLevel /> : <ByDepartment />}
    </Stack>
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
  const rows = query.data?.rows ?? [];
  const domain = paddedDomain(rows.flatMap((r) => [r.p25Minor, r.p75Minor, r.band?.minMinor ?? r.p25Minor, r.band?.maxMinor ?? r.p75Minor]));

  return (
    <Paper withBorder p="lg">
      <Group justify="space-between" align="end" mb="md">
        <Select
          label="Country"
          value={country}
          onChange={(v) => v && setCountry(v)}
          data={meta?.countries.map((c) => ({ value: c.code, label: c.name })) ?? []}
          allowDeselect={false}
          w={200}
        />
        {query.data && currency !== 'local' && (
          <Text size="xs" c="dimmed">
            Converted to {currency} at rates as of {formatDate(query.data.rateAsOf)}
          </Text>
        )}
      </Group>
      <Legend withBand />
      {query.isPending && <Loader />}
      {query.error && <Alert color="red">{query.error.message}</Alert>}
      <Table.ScrollContainer minWidth={720}>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Level</Table.Th>
              <Table.Th ta="right">People</Table.Th>
              <Table.Th w="45%">Range</Table.Th>
              <Table.Th ta="right">P25</Table.Th>
              <Table.Th ta="right">Median</Table.Th>
              <Table.Th ta="right">P75</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => {
              const f = (m: number) => formatMinor(m, r.currency, { cents: false });
              return (
                <Table.Tr key={r.level}>
                  <Table.Td fw={600}>{r.level}</Table.Td>
                  <Table.Td ta="right" className="num">
                    {r.headcount.toLocaleString('en-US')}
                  </Table.Td>
                  <Table.Td>
                    <RangeBar
                      domain={domain}
                      band={r.band}
                      quartiles={r}
                      label={`${r.level}: median ${f(r.medianMinor)}, middle half ${f(r.p25Minor)} to ${f(r.p75Minor)}${r.band ? `, band ${f(r.band.minMinor)} to ${f(r.band.maxMinor)}` : ''}`}
                    />
                  </Table.Td>
                  <Table.Td ta="right" className="num">{f(r.p25Minor)}</Table.Td>
                  <Table.Td ta="right" className="num" fw={650}>{f(r.medianMinor)}</Table.Td>
                  <Table.Td ta="right" className="num">{f(r.p75Minor)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

function ByDepartment() {
  const money = useMoney();
  const currency = money.apiCurrency;
  const query = useQuery({
    queryKey: ['insights', 'distribution', 'department', currency],
    queryFn: () => apiFetch<Distribution<DepartmentRow>>(`/api/insights/distribution${qs({ by: 'department', currency })}`),
  });
  const rows = query.data?.rows ?? [];
  const domain = paddedDomain(rows.flatMap((r) => [r.p25Minor, r.p75Minor]));

  return (
    <Paper withBorder p="lg">
      <Text size="xs" c="dimmed" mb="md">
        Departments span countries, so every salary is converted to {currency}
        {query.data ? ` at rates as of ${formatDate(query.data.rateAsOf)}` : ''}. Compare with care: pay levels differ by
        country.
      </Text>
      <Legend withBand={false} />
      {query.isPending && <Loader />}
      {query.error && <Alert color="red">{query.error.message}</Alert>}
      <Table.ScrollContainer minWidth={720}>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Department</Table.Th>
              <Table.Th ta="right">People</Table.Th>
              <Table.Th w="45%">Range</Table.Th>
              <Table.Th ta="right">P25</Table.Th>
              <Table.Th ta="right">Median</Table.Th>
              <Table.Th ta="right">P75</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => {
              const f = (m: number) => formatMinor(m, r.currency, { cents: false });
              return (
                <Table.Tr key={r.department}>
                  <Table.Td fw={600}>{r.department}</Table.Td>
                  <Table.Td ta="right" className="num">
                    {r.headcount.toLocaleString('en-US')}
                  </Table.Td>
                  <Table.Td>
                    <RangeBar
                      domain={domain}
                      quartiles={r}
                      label={`${r.department}: median ${f(r.medianMinor)}, middle half ${f(r.p25Minor)} to ${f(r.p75Minor)}`}
                    />
                  </Table.Td>
                  <Table.Td ta="right" className="num">{f(r.p25Minor)}</Table.Td>
                  <Table.Td ta="right" className="num" fw={650}>{f(r.medianMinor)}</Table.Td>
                  <Table.Td ta="right" className="num">{f(r.p75Minor)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
