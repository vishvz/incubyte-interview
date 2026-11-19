import { Alert, Group, Loader, Pagination, SegmentedControl, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { apiFetch, qs } from '../api/client';
import { paginationLabels } from '../lib/format';
import type { BandCheck } from '../api/types';
import { paddedDomain, RangeBar } from '../components/RangeBar';
import { IconArrowDownRight, IconArrowUpRight, IconCircleCheck, IconScale } from '@tabler/icons-react';
import { EmptyState, PageHeader, PersonCell, StatTile, TableCard } from '../components/ui';
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
      <PageHeader
        icon={IconScale}
        title="Outside band"
        description="Active employees whose current salary is outside the pay band for their level and country. Biggest gaps first."
      />

      {counts && (
        <SimpleGrid cols={{ base: 1, xs: 3 }}>
          <StatTile icon={IconArrowDownRight} tone="below" label="Below band" value={counts.below.toLocaleString('en-US')} note={`${share(counts.below)} of people with a band`} />
          <StatTile icon={IconCircleCheck} label="Within band" value={counts.within.toLocaleString('en-US')} note={`${share(counts.within)} of people with a band`} />
          <StatTile icon={IconArrowUpRight} tone="above" label="Above band" value={counts.above.toLocaleString('en-US')} note={`${share(counts.above)} of people with a band`} />
        </SimpleGrid>
      )}

      {query.error && <Alert color="red">{query.error.message}</Alert>}

      <TableCard
        toolbar={
          <Group justify="space-between" align="end" wrap="wrap" gap="sm">
            <SegmentedControl
              value={position}
              onChange={(v) => { setPosition(v as 'below' | 'above'); setPage(1); }}
              data={[
                { value: 'below', label: <span className="seg-label"><IconArrowDownRight size={16} aria-hidden="true" /> Below band</span> },
                { value: 'above', label: <span className="seg-label"><IconArrowUpRight size={16} aria-hidden="true" /> Above band</span> },
              ]}
            />
            <Group gap="sm" wrap="wrap">
              <Select
                aria-label="Country"
                placeholder="All countries"
                clearable
                value={country}
                onChange={(v) => { setCountry(v); setPage(1); }}
                data={meta?.countries.map((c) => ({ value: c.code, label: c.name })) ?? []}
                w={180}
              />
              <Select
                aria-label="Level"
                placeholder="All levels"
                clearable
                value={level}
                onChange={(v) => { setLevel(v); setPage(1); }}
                data={meta?.levels ?? []}
                w={130}
              />
            </Group>
          </Group>
        }
        footer={
          data && data.total > 0 ? (
            <>
              <Text size="sm" c="dimmed" className="num">
                {data.total.toLocaleString('en-US')} people {position} band
              </Text>
              {data.total > PAGE_SIZE && (
                <Pagination size="sm" getControlProps={paginationLabels} total={Math.ceil(data.total / PAGE_SIZE)} value={page} onChange={setPage} />
              )}
            </>
          ) : undefined
        }
      >
        {query.isPending && (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        )}
        {data && (
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Employee</Table.Th>
                <Table.Th visibleFrom="md">Level, country</Table.Th>
                <Table.Th ta="right" visibleFrom="sm">Salary</Table.Th>
                <Table.Th ta="right" visibleFrom="lg">{position === 'below' ? 'Band minimum' : 'Band maximum'}</Table.Th>
                <Table.Th ta="right">Gap</Table.Th>
                <Table.Th w="24%" visibleFrom="lg">Position in band</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
              {data.items.map((e) => {
                const bound = position === 'below' ? e.band.minMinor : e.band.maxMinor;
                return (
                  <Table.Tr key={e.id} className="clickable-row" onClick={() => navigate(`/employees/${e.id}`)}>
                    <Table.Td>
                      <PersonCell id={e.id} firstName={e.firstName} lastName={e.lastName} sub={e.jobTitle} />
                    </Table.Td>
                    <Table.Td visibleFrom="md">{e.level}, {e.country}</Table.Td>
                    <Table.Td ta="right" className="num" visibleFrom="sm">{money.format(e.amountMinor, e.currency, { cents: false })}</Table.Td>
                    <Table.Td ta="right" className="num" visibleFrom="lg">{money.format(bound, e.currency, { cents: false })}</Table.Td>
                    <Table.Td ta="right" className={`num position-${position}`} fw={600}>
                      {money.format(e.gapMinor, e.currency, { cents: false })}
                      <Text size="xs" span display="block">{e.gapPct}%</Text>
                    </Table.Td>
                    <Table.Td visibleFrom="lg">
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
                    <EmptyState title={`Nobody is paid ${position} band`}>No one matches these filters.</EmptyState>
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
