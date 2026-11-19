import { Alert, Anchor, Button, Group, Paper, Select, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, apiFetch, patch, post } from '../api/client';
import type { Employee, EmployeeProfile } from '../api/types';
import { IconArrowLeft, IconCheck, IconPencil, IconUserPlus } from '@tabler/icons-react';
import { focusFirstError, PageHeader, PageLoader } from '../components/ui';
import { useMeta } from '../currency';
import { todayIso } from '../lib/format';
import { parseMajorToMinor } from '../lib/money';
import { type FieldErrors, validateEmployee } from '../lib/validation';

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

  if (editing && existing.isPending) return <PageLoader label="Loading employee" />;
  if (editing && existing.error) return <Alert color="red">{existing.error.message}</Alert>;
  return <FormBody id={id} initial={existing.data ? { ...EMPTY, ...existing.data } : EMPTY} />;
}

function FormBody({ id, initial }: { id?: string; initial: Fields }) {
  const editing = Boolean(id);
  const { data: meta } = useMeta();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [f, setF] = useState<Fields>(initial);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  // Editing a field clears its error, so the message disappears as soon as the user fixes it.
  const set = (k: keyof Fields) => (v: string | null) => {
    setF((prev) => ({ ...prev, [k]: v ?? '' }));
    setClientErrors(({ [k]: _cleared, ...rest }) => rest);
  };
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
      queryClient.invalidateQueries({ queryKey: ['recent'] });
      navigate(`/employees/${saved.id}`);
    },
  });

  const serverErrors = save.error instanceof ApiError ? save.error.fieldErrors() : {};
  // The API names the salary field salaryMinor; the form calls it salary.
  const errors: FieldErrors = { ...serverErrors, salary: serverErrors.salaryMinor, ...clientErrors };
  const FIELDS = ['firstName', 'lastName', 'email', 'jobTitle', 'department', 'level', 'country', 'hireDate', 'salaryMinor'];
  const shownInFields = FIELDS.some((k) => k in serverErrors);
  const currency = meta?.countries.find((c) => c.code === f.country)?.currency;

  return (
    <Stack maw={720}>
      <div>
        <Anchor component={Link} to={editing ? `/employees/${id}` : '/employees'} size="sm" className="back-link" mb="sm">
          <IconArrowLeft size={14} aria-hidden="true" /> {editing ? 'Back to profile' : 'All employees'}
        </Anchor>
        <PageHeader
          icon={editing ? IconPencil : IconUserPlus}
          title={editing ? 'Edit details' : 'Add employee'}
          description={
            editing
              ? 'To change pay, record a salary change on the profile. Country is fixed because salary currency follows it.'
              : 'Creates the employee and their starting salary as the first entry in their history.'
          }
        />
      </div>
      <Paper withBorder p="lg">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const found = validateEmployee(f, { editing, today: todayIso() });
            setClientErrors(found);
            if (Object.keys(found).length) return focusFirstError(e.currentTarget);
            save.mutate(editing ? null : parseMajorToMinor(f.salary));
          }}
        >
          <Stack>
            {save.error && !shownInFields && (
              <Alert color="red">
                {save.error instanceof ApiError && save.error.status === 409
                  ? 'Another employee already uses this email address.'
                  : save.error instanceof ApiError
                    ? save.error.describe()
                    : save.error.message}
              </Alert>
            )}
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="First name" withAsterisk {...input('firstName')} error={errors.firstName} />
              <TextInput label="Last name" withAsterisk {...input('lastName')} error={errors.lastName} />
              <TextInput label="Work email" type="email" withAsterisk {...input('email')} error={errors.email} />
              <TextInput label="Job title" withAsterisk {...input('jobTitle')} error={errors.jobTitle} />
              <Select
                label="Department"
                withAsterisk
                data={meta?.departments ?? []}
                value={f.department || null}
                onChange={set('department')}
                error={errors.department}
              />
              <Select
                label="Level"
                withAsterisk
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
                    withAsterisk
                    data={meta?.countries.map((c) => ({ value: c.code, label: `${c.name} (${c.currency})` })) ?? []}
                    value={f.country || null}
                    onChange={set('country')}
                    error={errors.country}
                  />
                  <TextInput
                    label="Hire date"
                    type="date"
                    withAsterisk
                    max={todayIso()}
                    {...input('hireDate')}
                    error={errors.hireDate}
                  />
                  <TextInput
                    label={`Starting annual salary${currency ? ` (${currency})` : ''}`}
                    withAsterisk
                    inputMode="decimal"
                    {...input('salary')}
                    error={errors.salary}
                  />
                </>
              )}
            </SimpleGrid>
            <Group justify="end">
              <Button variant="default" component={Link} to={editing ? `/employees/${id}` : '/employees'}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending} leftSection={<IconCheck size={16} />}>
                {editing ? 'Save changes' : 'Add employee'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
