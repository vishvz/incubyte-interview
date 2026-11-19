import { Alert, Anchor, Button, Group, Loader, Paper, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, apiFetch, patch, post } from '../api/client';
import type { Employee, EmployeeProfile } from '../api/types';
import { useMeta } from '../currency';
import { todayIso } from '../lib/format';
import { parseMajorToMinor } from '../lib/money';

type Fields = Pick<Employee, 'firstName' | 'lastName' | 'email' | 'jobTitle' | 'department' | 'level' | 'country' | 'status'> & {
  hireDate: string;
  salary: string;
};

const EMPTY: Fields = {
  firstName: '', lastName: '', email: '', jobTitle: '', department: '', level: '', country: '', status: 'active',
  hireDate: todayIso(), salary: '',
};

/** Create (/employees/new) or edit (/employees/:id/edit). Salary is only set here on create. */
export function EmployeeForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const existing = useQuery({
    queryKey: ['employee', id],
    queryFn: () => apiFetch<EmployeeProfile>(`/api/employees/${id}`),
    enabled: editing,
  });

  if (editing && existing.isPending) return <Loader />;
  if (editing && existing.error) return <Alert color="red">{existing.error.message}</Alert>;
  return <FormBody id={id} initial={existing.data ? { ...EMPTY, ...existing.data } : EMPTY} />;
}

function FormBody({ id, initial }: { id?: string; initial: Fields }) {
  const editing = Boolean(id);
  const { data: meta } = useMeta();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [f, setF] = useState<Fields>(initial);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const set = (k: keyof Fields) => (v: string | null) => setF((prev) => ({ ...prev, [k]: v ?? '' }));
  const input = (k: keyof Fields) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k)(e.currentTarget.value),
  });

  const save = useMutation({
    mutationFn: (salaryMinor: number | null) => {
      const common = {
        firstName: f.firstName, lastName: f.lastName, email: f.email, jobTitle: f.jobTitle,
        department: f.department, level: f.level,
      };
      return editing
        ? patch<Employee>(`/api/employees/${id}`, { ...common, status: f.status })
        : post<Employee>('/api/employees', { ...common, country: f.country, hireDate: f.hireDate, salaryMinor });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', String(saved.id)] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      navigate(`/employees/${saved.id}`);
    },
  });

  const errors = save.error instanceof ApiError ? save.error.fieldErrors() : {};
  const currency = meta?.countries.find((c) => c.code === f.country)?.currency;

  return (
    <Stack maw={720}>
      <div>
        <Anchor component={Link} to={editing ? `/employees/${id}` : '/employees'} size="sm">
          {editing ? 'Back to profile' : 'Employees'}
        </Anchor>
        <Title order={1} size="h2">
          {editing ? 'Edit details' : 'Add employee'}
        </Title>
        {editing && (
          <Text c="dimmed" size="sm">
            To change pay, record a salary change on the profile. Country cannot be changed because salary currency
            follows it.
          </Text>
        )}
      </div>
      <Paper withBorder p="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editing) return save.mutate(null);
            const minor = parseMajorToMinor(f.salary);
            if (minor === null || minor === 0) return setSalaryError('Enter an amount like 85000 or 85,000.50');
            setSalaryError(null);
            save.mutate(minor);
          }}
        >
          <Stack>
            {save.error && !Object.keys(errors).length && (
              <Alert color="red">
                {save.error instanceof ApiError && save.error.status === 409
                  ? 'Another employee already uses this email address.'
                  : save.error.message}
              </Alert>
            )}
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="First name" required {...input('firstName')} error={errors.firstName} />
              <TextInput label="Last name" required {...input('lastName')} error={errors.lastName} />
              <TextInput label="Work email" type="email" required {...input('email')} error={errors.email} />
              <TextInput label="Job title" required {...input('jobTitle')} error={errors.jobTitle} />
              <Select
                label="Department"
                required
                data={meta?.departments ?? []}
                value={f.department || null}
                onChange={set('department')}
                error={errors.department}
              />
              <Select
                label="Level"
                required
                data={meta?.levels ?? []}
                value={f.level || null}
                onChange={set('level')}
                error={errors.level}
              />
              {editing ? (
                <Select
                  label="Status"
                  data={[
                    { value: 'active', label: 'Active' },
                    { value: 'terminated', label: 'Terminated' },
                  ]}
                  value={f.status}
                  onChange={set('status')}
                  allowDeselect={false}
                />
              ) : (
                <>
                  <Select
                    label="Country"
                    required
                    data={meta?.countries.map((c) => ({ value: c.code, label: `${c.name} (${c.currency})` })) ?? []}
                    value={f.country || null}
                    onChange={set('country')}
                    error={errors.country}
                  />
                  <TextInput
                    label="Hire date"
                    type="date"
                    required
                    max={todayIso()}
                    {...input('hireDate')}
                    error={errors.hireDate}
                  />
                  <TextInput
                    label={`Starting annual salary${currency ? ` (${currency})` : ''}`}
                    required
                    inputMode="decimal"
                    {...input('salary')}
                    error={salaryError ?? errors.salaryMinor}
                  />
                </>
              )}
            </SimpleGrid>
            <Group justify="end">
              <Button variant="default" component={Link} to={editing ? `/employees/${id}` : '/employees'}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending}>
                {editing ? 'Save changes' : 'Add employee'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
