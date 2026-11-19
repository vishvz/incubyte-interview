import { Alert, Badge, Button, Select, Table, TextInput, UnstyledButton, type MantineBreakpoint } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { apiFetch, qs } from '../api/client';
import type { EmployeeListItem, Page } from '../api/types';
import { IconArrowsSort, IconPlus, IconSearch, IconSortAscending, IconSortDescending, IconUsers } from '@tabler/icons-react';
import { EmptyState, PageHeader, PageLoader, PersonCell, TableCard, TablePager } from '../components/ui';
import { useMeta, useMoney } from '../currency';
import { formatDate } from '../lib/format';

const PAGE_SIZES = [10, 25, 50];
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
    page: Math.max(1, Math.floor(Number(params.get('page'))) || 1),
    pageSize: PAGE_SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : 10,
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

  // The URL changed from outside (nav link, browser Back): show its search text in the box.
  useEffect(() => {
    if (filters.q !== q) setSearch(filters.q);
  }, [filters.q]);

  const query = useQuery({
    queryKey: ['employees', filters],
    queryFn: () => apiFetch<Page<EmployeeListItem>>(`/api/employees${qs(filters)}`),
    placeholderData: keepPreviousData,
  });

  const sortBy = (key: SortKey) =>
    update({ sort: key, order: filters.sort === key && filters.order === 'asc' ? 'desc' : 'asc' });
  const SortHeader = ({ k, children, align, visibleFrom }: { k: SortKey; children: string; align?: 'right'; visibleFrom?: MantineBreakpoint }) => {
    const active = filters.sort === k;
    return (
      <Table.Th
        ta={align}
        visibleFrom={visibleFrom}
        aria-sort={active ? (filters.order === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <UnstyledButton onClick={() => sortBy(k)} fw={600} fz="sm" className="sort-button" data-align={align}>
          {children}
          {active ? (
            filters.order === 'asc' ? <IconSortAscending size={15} aria-hidden="true" /> : <IconSortDescending size={15} aria-hidden="true" />
          ) : (
            <IconArrowsSort size={15} className="icon-muted" aria-hidden="true" />
          )}
        </UnstyledButton>
      </Table.Th>
    );
  };

  const data = query.data;
  const salaryNote =
    money.display === 'local' ? 'Salaries in local currency' : `Salaries converted to ${money.display}`;
  // The API sorts salaries by USD value, which can look out of order when amounts are in local currencies.
  const sortNote =
    filters.sort === 'salary' && money.display === 'local' ? ' Sorted by salary converted to USD.' : '';

  return (
    <>
      <PageHeader
        icon={IconUsers}
        title="Employees"
        description={<>{data ? `${data.total.toLocaleString('en-US')} people. ` : ''}{salaryNote}.{sortNote}</>}
        actions={
          <Button component={Link} to="/employees/new" leftSection={<IconPlus size={18} />}>
            Add employee
          </Button>
        }
      />

      {query.error && <Alert color="red" mb="md">{query.error.message}</Alert>}

      <TableCard
        toolbar={
          <div className="filter-grid">
            <TextInput
              label="Search"
              placeholder="Name, code or email"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Select
              label="Country"
              placeholder="All countries"
              clearable
              value={filters.country || null}
              onChange={(v) => update({ country: v ?? '' })}
              data={meta?.countries.map((c) => ({ value: c.code, label: c.name })) ?? []}
            />
            <Select
              label="Department"
              placeholder="All departments"
              clearable
              value={filters.department || null}
              onChange={(v) => update({ department: v ?? '' })}
              data={meta?.departments ?? []}
            />
            <Select
              label="Level"
              placeholder="All levels"
              clearable
              value={filters.level || null}
              onChange={(v) => update({ level: v ?? '' })}
              data={meta?.levels ?? []}
            />
            <Select
              label="Status"
              placeholder="Any status"
              clearable
              value={filters.status || null}
              onChange={(v) => update({ status: v ?? '' })}
              data={[
                { value: 'active', label: 'Active' },
                { value: 'terminated', label: 'Terminated' },
              ]}
            />
          </div>
        }
        footer={
          data && data.total > 0 ? (
            <TablePager
              total={data.total}
              page={filters.page}
              pageSize={filters.pageSize}
              noun="employees"
              onPage={(p) => update({ page: String(p) })}
              onPageSize={(size) => update({ size: String(size) })}
            />
          ) : undefined
        }
      >
        {query.isPending && <PageLoader label="Loading employees" minHeight={320} />}
        {data && (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <SortHeader k="name">Name</SortHeader>
                <Table.Th visibleFrom="lg">Role</Table.Th>
                <Table.Th visibleFrom="md">Department</Table.Th>
                <Table.Th>Level</Table.Th>
                <Table.Th visibleFrom="sm">Country</Table.Th>
                <SortHeader k="hire_date" visibleFrom="lg">
                  Hired
                </SortHeader>
                <SortHeader k="salary" align="right">
                  Salary
                </SortHeader>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
              {data.items.map((e) => (
                <Table.Tr key={e.id} className="clickable-row" onClick={() => navigate(`/employees/${e.id}`)}>
                  <Table.Td>
                    <PersonCell
                      id={e.id}
                      firstName={e.firstName}
                      lastName={e.lastName}
                      sub={e.employeeCode}
                      terminated={e.status === 'terminated'}
                    />
                  </Table.Td>
                  <Table.Td visibleFrom="lg">{e.jobTitle}</Table.Td>
                  <Table.Td visibleFrom="md">{e.department}</Table.Td>
                  <Table.Td>
                    <Badge variant="outline" color="gray" tt="none">
                      {e.level}
                    </Badge>
                  </Table.Td>
                  <Table.Td visibleFrom="sm">{e.country}</Table.Td>
                  <Table.Td visibleFrom="lg" className="num">
                    {formatDate(e.hireDate)}
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {money.format(e.salary.amountMinor, e.salary.currency, { cents: false })}
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.items.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <EmptyState title="No employees match">Clear a filter or change the search.</EmptyState>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </TableCard>
    </>
  );
}
