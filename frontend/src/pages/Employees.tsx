import { Alert, Badge, Button, Group, Pagination, Select, Table, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { apiFetch, qs } from '../api/client';
import { paginationLabels } from '../lib/format';
import type { EmployeeListItem, Page } from '../api/types';
import { useMeta, useMoney } from '../currency';

const PAGE_SIZE = 25;
type SortKey = 'name' | 'hire_date' | 'salary';

export function Employees() {
  const [params, setParams] = useSearchParams();
  const { data: meta } = useMeta();
  const money = useMoney();
  const navigate = useNavigate();

  const [search, setSearch] = useState(params.get('q') ?? '');
  const [q] = useDebouncedValue(search, 300);

  const filters = {
    q: params.get('q') ?? '',
    country: params.get('country') ?? '',
    department: params.get('department') ?? '',
    level: params.get('level') ?? '',
    status: params.get('status') ?? '',
    sort: (params.get('sort') ?? 'name') as SortKey,
    order: params.get('order') ?? 'asc',
    page: Number(params.get('page') ?? 1),
  };

  /** Updates URL filters; any filter change goes back to page 1. */
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (q !== filters.q) update({ q });
  }, [q]);

  const query = useQuery({
    queryKey: ['employees', filters],
    queryFn: () => apiFetch<Page<EmployeeListItem>>(`/api/employees${qs({ ...filters, pageSize: PAGE_SIZE })}`),
    placeholderData: keepPreviousData,
  });

  const sortBy = (key: SortKey) =>
    update({ sort: key, order: filters.sort === key && filters.order === 'asc' ? 'desc' : 'asc' });
  const SortHeader = ({ k, children, align }: { k: SortKey; children: string; align?: 'right' }) => {
    const active = filters.sort === k;
    return (
      <Table.Th
        ta={align}
        aria-sort={active ? (filters.order === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <UnstyledButton onClick={() => sortBy(k)} fw={600} fz="sm">
          {children} {active ? (filters.order === 'asc' ? '▲' : '▼') : ''}
        </UnstyledButton>
      </Table.Th>
    );
  };

  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const salaryNote =
    money.display === 'local' ? 'Salaries in local currency' : `Salaries converted to ${money.display}`;

  return (
    <>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={1} size="h2">
            Employees
          </Title>
          <Text c="dimmed" size="sm">
            {data ? `${data.total.toLocaleString('en-US')} people. ` : ''}{salaryNote}.
          </Text>
        </div>
        <Button component={Link} to="/employees/new">
          Add employee
        </Button>
      </Group>

      <Group gap="sm" mb="md" align="end" wrap="wrap">
        <TextInput
          label="Search"
          placeholder="Name, employee code or email"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={280}
        />
        <Select
          label="Country"
          placeholder="All"
          clearable
          value={filters.country || null}
          onChange={(v) => update({ country: v ?? '' })}
          data={meta?.countries.map((c) => ({ value: c.code, label: c.name })) ?? []}
          w={170}
        />
        <Select
          label="Department"
          placeholder="All"
          clearable
          value={filters.department || null}
          onChange={(v) => update({ department: v ?? '' })}
          data={meta?.departments ?? []}
          w={170}
        />
        <Select
          label="Level"
          placeholder="All"
          clearable
          value={filters.level || null}
          onChange={(v) => update({ level: v ?? '' })}
          data={meta?.levels ?? []}
          w={110}
        />
        <Select
          label="Status"
          placeholder="All"
          clearable
          value={filters.status || null}
          onChange={(v) => update({ status: v ?? '' })}
          data={[
            { value: 'active', label: 'Active' },
            { value: 'terminated', label: 'Terminated' },
          ]}
          w={130}
        />
      </Group>

      {query.error && <Alert color="red" mb="md">{query.error.message}</Alert>}

      <Table.ScrollContainer minWidth={760}>
        <Table highlightOnHover verticalSpacing="xs" bg="white" withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <SortHeader k="name">Name</SortHeader>
              <Table.Th>Role</Table.Th>
              <Table.Th>Department</Table.Th>
              <Table.Th>Level</Table.Th>
              <Table.Th>Country</Table.Th>
              <SortHeader k="hire_date">Hired</SortHeader>
              <SortHeader k="salary" align="right">
                Salary
              </SortHeader>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
            {data?.items.map((e) => (
              <Table.Tr key={e.id} className="clickable-row" onClick={() => navigate(`/employees/${e.id}`)}>
                <Table.Td>
                  <Link to={`/employees/${e.id}`} onClick={(ev) => ev.stopPropagation()} style={{ color: 'inherit' }}>
                    {e.lastName}, {e.firstName}
                  </Link>{' '}
                  <Text span size="xs" c="dimmed">
                    {e.employeeCode}
                  </Text>
                  {e.status === 'terminated' && (
                    <Badge ml="xs" size="xs" color="gray" variant="light">
                      Terminated
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>{e.jobTitle}</Table.Td>
                <Table.Td>{e.department}</Table.Td>
                <Table.Td>{e.level}</Table.Td>
                <Table.Td>{e.country}</Table.Td>
                <Table.Td className="num">{e.hireDate}</Table.Td>
                <Table.Td ta="right" className="num">
                  {money.format(e.salary.amountMinor, e.salary.currency, { cents: false })}
                </Table.Td>
              </Table.Tr>
            ))}
            {data && data.items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" py="lg" ta="center">
                    No employees match these filters. Clear a filter or change the search.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {pages > 1 && (
        <Group justify="center" mt="md">
          <Pagination getControlProps={paginationLabels} total={pages} value={filters.page} onChange={(p) => update({ page: String(p) })} />
        </Group>
      )}
    </>
  );
}
