import { Alert, Group, Loader, Pagination, Paper, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiFetch, qs } from '../api/client';
import { paginationLabels } from '../lib/format';
import type { BandCheck } from '../api/types';
import { paddedDomain, RangeBar } from '../components/RangeBar';
import { useMeta, useMoney } from '../currency';

const PAGE_SIZE = 25;

export function OutsideBand() {
  const { data: meta } = useMeta();
  const money = useMoney();
  const navigate = useNavigate();
  const [position, setPosition] = useState<'below' | 'above'>('below');
  const [country, setCountry] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['insights', 'band-check', position, country, level, page],
    queryFn: () =>
      apiFetch<BandCheck>(`/api/insights/band-check${qs({ position, country, level, page, pageSize: PAGE_SIZE })}`),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const counts = data?.counts;
  const inBand = counts ? counts.below + counts.within + counts.above : 0;
  const share = (n: number) => (inBand ? `${((n / inBand) * 100).toFixed(1)}%` : '');

  return (
    <Stack>
      <div>
        <Title order={1} size="h2">
          Outside band
        </Title>
        <Text c="dimmed" size="sm">
          Active employees whose current salary is outside the pay band for their level and country. Biggest gaps first.
        </Text>
      </div>

      <Group gap="sm" align="end" wrap="wrap">
        <Select
          label="Country"
          placeholder="All"
          clearable
          value={country}
          onChange={(v) => { setCountry(v); setPage(1); }}
          data={meta?.countries.map((c) => ({ value: c.code, label: c.name })) ?? []}
          w={180}
        />
        <Select
          label="Level"
          placeholder="All"
          clearable
          value={level}
          onChange={(v) => { setLevel(v); setPage(1); }}
          data={meta?.levels ?? []}
          w={110}
        />
      </Group>

      {counts && (
        <SimpleGrid cols={{ base: 1, xs: 3 }} maw={640}>
          <Paper withBorder p="md">
            <Text size="sm" fw={600} className="position-below">Below band</Text>
            <Text fz={28} fw={650} className="num">{counts.below.toLocaleString('en-US')}</Text>
            <Text size="xs" c="dimmed">{share(counts.below)} of people with a band</Text>
          </Paper>
          <Paper withBorder p="md">
            <Text size="sm" fw={600}>Within band</Text>
            <Text fz={28} fw={650} className="num">{counts.within.toLocaleString('en-US')}</Text>
            <Text size="xs" c="dimmed">{share(counts.within)}</Text>
          </Paper>
          <Paper withBorder p="md">
            <Text size="sm" fw={600} className="position-above">Above band</Text>
            <Text fz={28} fw={650} className="num">{counts.above.toLocaleString('en-US')}</Text>
            <Text size="xs" c="dimmed">{share(counts.above)}</Text>
          </Paper>
        </SimpleGrid>
      )}

      <SegmentedControl
        w="fit-content"
        value={position}
        onChange={(v) => { setPosition(v as 'below' | 'above'); setPage(1); }}
        data={[
          { value: 'below', label: 'Show below band' },
          { value: 'above', label: 'Show above band' },
        ]}
      />

      {query.isPending && <Loader />}
      {query.error && <Alert color="red">{query.error.message}</Alert>}
      {data && (
        <Paper withBorder>
          <Table.ScrollContainer minWidth={820}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Level, country</Table.Th>
                  <Table.Th ta="right">Salary</Table.Th>
                  <Table.Th ta="right">{position === 'below' ? 'Band minimum' : 'Band maximum'}</Table.Th>
                  <Table.Th ta="right">Gap</Table.Th>
                  <Table.Th w="22%">Position in band</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
                {data.items.map((e) => {
                  const bound = position === 'below' ? e.band.minMinor : e.band.maxMinor;
                  return (
                    <Table.Tr key={e.id} className="clickable-row" onClick={() => navigate(`/employees/${e.id}`)}>
                      <Table.Td>
                        <Link to={`/employees/${e.id}`} onClick={(ev) => ev.stopPropagation()} style={{ color: 'inherit' }}>
                          {e.firstName} {e.lastName}
                        </Link>
                        <Text size="xs" c="dimmed">{e.jobTitle}</Text>
                      </Table.Td>
                      <Table.Td>{e.level}, {e.country}</Table.Td>
                      <Table.Td ta="right" className="num">{money.format(e.amountMinor, e.currency, { cents: false })}</Table.Td>
                      <Table.Td ta="right" className="num">{money.format(bound, e.currency, { cents: false })}</Table.Td>
                      <Table.Td ta="right" className={`num position-${position}`} fw={600}>
                        {money.format(e.gapMinor, e.currency, { cents: false })} ({e.gapPct}%)
                      </Table.Td>
                      <Table.Td>
                        <RangeBar
                          domain={paddedDomain([e.band.minMinor, e.band.maxMinor, e.amountMinor])}
                          band={e.band}
                          marker={{ amountMinor: e.amountMinor, position }}
                          label={`${e.gapPct}% ${position} band`}
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {data.items.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed" ta="center" py="lg">
                        Nobody is paid {position} band for these filters.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}
      {data && data.total > PAGE_SIZE && (
        <Group justify="center">
          <Pagination getControlProps={paginationLabels} total={Math.ceil(data.total / PAGE_SIZE)} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
}
