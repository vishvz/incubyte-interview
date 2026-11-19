import { Alert, Group, Loader, Pagination, Paper, SegmentedControl, Select, SimpleGrid, Stack, Table } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { apiFetch, qs } from '../api/client';
import { paginationLabels } from '../lib/format';
import type { BandCheck } from '../api/types';
import { paddedDomain, RangeBar } from '../components/RangeBar';
import { IconArrowDownRight, IconArrowUpRight, IconCircleCheck, IconScale } from '@tabler/icons-react';
import { EmptyState, PageHeader, PersonCell, StatTile } from '../components/ui';
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
        <SimpleGrid cols={{ base: 1, xs: 3 }} maw={780}>
          <StatTile icon={IconArrowDownRight} tone="below" label="Below band" value={counts.below.toLocaleString('en-US')} note={`${share(counts.below)} of people with a band`} />
          <StatTile icon={IconCircleCheck} label="Within band" value={counts.within.toLocaleString('en-US')} note={share(counts.within)} />
          <StatTile icon={IconArrowUpRight} tone="above" label="Above band" value={counts.above.toLocaleString('en-US')} note={share(counts.above)} />
        </SimpleGrid>
      )}

      <SegmentedControl
        w="fit-content"
        value={position}
        onChange={(v) => { setPosition(v as 'below' | 'above'); setPage(1); }}
        data={[
          { value: 'below', label: <span className="seg-label"><IconArrowDownRight size={16} aria-hidden="true" /> Show below band</span> },
          { value: 'above', label: <span className="seg-label"><IconArrowUpRight size={16} aria-hidden="true" /> Show above band</span> },
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
                        <PersonCell id={e.id} firstName={e.firstName} lastName={e.lastName} sub={e.jobTitle} />
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
                      <EmptyState title={`Nobody is paid ${position} band`}>No one matches these filters.</EmptyState>
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
