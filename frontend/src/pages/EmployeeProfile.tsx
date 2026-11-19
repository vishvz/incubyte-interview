import { Alert, Anchor, Avatar, Badge, Button, Grid, Group, Loader, Paper, Select, Stack, Table, Text, Textarea, TextInput, Title } from '@mantine/core';
import {
  IconArrowLeft,
  IconBriefcase,
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconHistory,
  IconId,
  IconMail,
  IconPencil,
  IconTrendingUp,
  IconWorld,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ApiError, apiFetch, post } from '../api/client';
import type { EmployeeProfile as Profile, Salary, SalaryReason } from '../api/types';
import { paddedDomain, RangeBar } from '../components/RangeBar';
import { ChangeDelta, ReasonBadge } from '../components/ui';
import { useMoney } from '../currency';
import { formatDate, REASON_LABELS, todayIso } from '../lib/format';
import { formatMinor, parseMajorToMinor } from '../lib/money';

const POSITION_TEXT = { below: 'Below band', within: 'Within band', above: 'Above band' } as const;

export function EmployeeProfile() {
  const { id } = useParams();
  const money = useMoney();
  const query = useQuery({ queryKey: ['employee', id], queryFn: () => apiFetch<Profile>(`/api/employees/${id}`) });

  if (query.isPending) return <Loader />;
  if (query.error) {
    const missing = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 400);
    return (
      <Alert color={missing ? 'gray' : 'red'}>
        {missing ? 'No employee with this ID. ' : query.error.message}{' '}
        <Anchor component={Link} to="/employees">
          Back to employees
        </Anchor>
      </Alert>
    );
  }

  const e = query.data;
  const current = e.currentSalary;
  const band = e.band;
  // Band and salary share the employee's currency; convert both together for display.
  const c = (m: number) => money.convert(m, current?.currency ?? 'USD').amountMinor;
  const shownCurrency = current ? money.convert(0, current.currency).currency : 'USD';

  return (
    <Stack gap="lg">
      <div>
        <Anchor component={Link} to="/employees" size="sm" className="back-link">
          <IconArrowLeft size={14} aria-hidden="true" /> All employees
        </Anchor>
        <Group justify="space-between" align="start" mt="xs" wrap="wrap">
          <Group gap="md" wrap="nowrap" align="center">
            <Avatar size={64} radius="xl" color="ledger" variant="filled">
              {(e.firstName[0] + e.lastName[0]).toUpperCase()}
            </Avatar>
            <div>
              <Group gap="sm">
                <Title order={1} size="h2">
                  {e.firstName} {e.lastName}
                </Title>
                <Badge variant="outline" color="gray" tt="none">
                  {e.level}
                </Badge>
                {e.status === 'terminated' && (
                  <Badge color="gray" variant="light">
                    Terminated
                  </Badge>
                )}
              </Group>
              <Group gap="lg" mt={6} className="meta-row">
                <span><IconBriefcase size={15} aria-hidden="true" /> {e.jobTitle}</span>
                <span><IconBuilding size={15} aria-hidden="true" /> {e.department}</span>
                <span><IconWorld size={15} aria-hidden="true" /> {e.country}</span>
                <span><IconCalendarEvent size={15} aria-hidden="true" /> Hired {formatDate(e.hireDate)}</span>
                <span><IconId size={15} aria-hidden="true" /> {e.employeeCode}</span>
                <span><IconMail size={15} aria-hidden="true" /> {e.email}</span>
              </Group>
            </div>
          </Group>
          <Button variant="default" component={Link} to={`/employees/${e.id}/edit`} leftSection={<IconPencil size={16} />}>
            Edit details
          </Button>
        </Group>
      </div>

      {current && (
        <Paper withBorder p="lg">
          <Group align="end" gap="xl" wrap="wrap">
            <div>
              <Text size="sm" c="dimmed">
                Current salary, since {formatDate(current.effectiveDate)}
              </Text>
              <Text fz={40} fw={650} lh={1.1} className="num">
                {money.format(current.amountMinor, current.currency)}
              </Text>
              {shownCurrency !== current.currency && (
                <Text size="sm" c="dimmed" className="num">
                  {formatMinor(current.amountMinor, current.currency)} in local currency
                </Text>
              )}
            </div>
            {band && (
              <Stack gap={4} style={{ flex: 1, minWidth: 260 }}>
                <Text size="sm" fw={600} className={`position-${band.position}`}>
                  {POSITION_TEXT[band.position]} for {e.level} in {e.country}
                </Text>
                <RangeBar
                  // Wider padding leaves room for the min and max labels at the band edges.
                  domain={paddedDomain([band.minMinor, band.maxMinor, current.amountMinor].map(c), 0.15)}
                  band={{ minMinor: c(band.minMinor), midMinor: c(band.midMinor), maxMinor: c(band.maxMinor) }}
                  marker={{ amountMinor: c(current.amountMinor), position: band.position }}
                  label={`Salary ${money.format(current.amountMinor, current.currency)}, band ${money.format(band.minMinor, current.currency)} to ${money.format(band.maxMinor, current.currency)}`}
                  ticks={(['min', 'mid', 'max'] as const).map((k) => ({
                    value: c(band[`${k}Minor`]),
                    text: `${k[0].toUpperCase()}${k.slice(1)} ${money.format(band[`${k}Minor`], current.currency, { cents: false })}`,
                  }))}
                />
              </Stack>
            )}
          </Group>
        </Paper>
      )}

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder p="lg">
            <Title order={2} size="h4" mb="sm" className="panel-title">
              <IconHistory size={20} stroke={1.7} aria-hidden="true" /> Salary history
            </Title>
            {e.history.length > 1 && <HistoryChart history={e.history} />}
            <HistoryTable history={e.history} />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          {e.status === 'active' ? (
            <RecordChange employeeId={e.id} currency={current?.currency ?? 'USD'} hireDate={e.hireDate} />
          ) : (
            <Alert color="gray">Salary changes cannot be recorded for terminated employees.</Alert>
          )}
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function HistoryChart({ history }: { history: Salary[] }) {
  const money = useMoney();
  // Oldest first, extended to today so the current salary has a visible step.
  const points = [...history].reverse().map((s) => ({ date: s.effectiveDate, ...money.convert(s.amountMinor, s.currency) }));
  points.push({ ...points[points.length - 1], date: todayIso() });
  const currency = points[0].currency;
  const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);

  return (
    <div style={{ height: 200 }} aria-hidden="true">
      <ResponsiveContainer>
        <LineChart accessibilityLayer={false} data={points.map((p) => ({ t: toTime(p.date), v: p.amountMinor }))} margin={{ left: 8, right: 16, top: 8 }}>
          <CartesianGrid stroke="var(--rule)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t) => new Date(t).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
            stroke="var(--ink-muted)"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatMinor(v, currency, { cents: false })}
            stroke="var(--ink-muted)"
            fontSize={12}
            width={90}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip
            labelFormatter={(t) => formatDate(new Date(Number(t)).toISOString().slice(0, 10))}
            formatter={(v) => [formatMinor(Number(v), currency), 'Salary']}
          />
          <Line type="stepAfter" dataKey="v" stroke="var(--quartile)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HistoryTable({ history }: { history: Salary[] }) {
  const money = useMoney();
  return (
    <Table.ScrollContainer minWidth={480}>
      <Table verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Effective</Table.Th>
            <Table.Th>Reason</Table.Th>
            <Table.Th ta="right">Salary</Table.Th>
            <Table.Th ta="right">Change</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {history.map((s, i) => {
            const prev = history[i + 1];
            const pct = prev ? ((s.amountMinor - prev.amountMinor) / prev.amountMinor) * 100 : null;
            return (
              <Table.Tr key={s.id}>
                <Table.Td className="num">{formatDate(s.effectiveDate)}</Table.Td>
                <Table.Td>
                  <ReasonBadge reason={s.reason} />
                  {s.note && (
                    <Text size="xs" c="dimmed">
                      {s.note}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {money.format(s.amountMinor, s.currency)}
                </Table.Td>
                <Table.Td ta="right">
                  <ChangeDelta pct={pct} />
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function RecordChange({ employeeId, currency, hireDate }: { employeeId: number; currency: string; hireDate: string }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState<SalaryReason>('annual_review');
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (amountMinor: number) =>
      post<Salary>(`/api/employees/${employeeId}/salaries`, { amountMinor, effectiveDate: date, reason, note: note || undefined }),
    onSuccess: () => {
      setAmount('');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['employee', String(employeeId)] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['recent'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });
  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors() : {};
  const shownInFields = ['amountMinor', 'effectiveDate'].some((k) => k in fieldErrors);

  return (
    <Paper withBorder p="lg">
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          const minor = parseMajorToMinor(amount);
          if (minor === null || minor === 0) {
            setLocalError('Enter an amount like 85000 or 85,000.50');
            return;
          }
          setLocalError(null);
          save.mutate(minor);
        }}
      >
        <Stack>
          <Title order={2} size="h4" className="panel-title">
            <IconTrendingUp size={20} stroke={1.7} aria-hidden="true" /> Record salary change
          </Title>
          <Text size="sm" c="dimmed">
            Adds a new entry. Earlier salaries stay in the history.
          </Text>
          <TextInput
            label={`New annual salary (${currency})`}
            value={amount}
            onChange={(ev) => setAmount(ev.currentTarget.value)}
            inputMode="decimal"
            error={localError ?? fieldErrors.amountMinor}
            required
          />
          <TextInput
            type="date"
            label="Effective date"
            value={date}
            min={hireDate}
            max={todayIso()}
            onChange={(ev) => setDate(ev.currentTarget.value)}
            error={fieldErrors.effectiveDate}
            required
          />
          <Select
            label="Reason"
            value={reason}
            onChange={(v) => v && setReason(v as SalaryReason)}
            data={(['annual_review', 'promotion', 'adjustment'] as const).map((r) => ({ value: r, label: REASON_LABELS[r] }))}
            allowDeselect={false}
          />
          <Textarea label="Note (optional)" value={note} onChange={(ev) => setNote(ev.currentTarget.value)} maxLength={500} />
          {save.error && !shownInFields && (
            <Alert color="red">{save.error instanceof ApiError ? save.error.describe() : save.error.message}</Alert>
          )}
          {save.isSuccess && (
            <Alert color="ledger" icon={<IconCheck size={18} />}>
              Salary change recorded.
            </Alert>
          )}
          <Button type="submit" loading={save.isPending} leftSection={<IconCheck size={16} />}>
            Record salary change
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
