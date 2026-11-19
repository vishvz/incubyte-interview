import { Alert, Button, Group, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { IconChartBar, IconHistory, IconLock, IconScale } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ApiError, post, setToken } from '../api/client';
import { BrandMark } from '../components/ui';

const POINTS = [
  { icon: IconHistory, text: 'Every salary change kept, with its date and reason' },
  { icon: IconChartBar, text: 'Medians and spread by level, country and department' },
  { icon: IconScale, text: 'Who is paid below or above their pay band' },
];

export function Login() {
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useMutation({
    mutationFn: () => post<{ token: string }>('/api/login', { password }),
    onSuccess: ({ token }) => {
      setToken(token);
      navigate((location.state as { from?: string } | null)?.from ?? '/overview', { replace: true });
    },
  });

  const error =
    login.error instanceof ApiError && login.error.status === 401 ? 'That password is not right. Try again.' : login.error?.message;

  return (
    <div className="login">
      <section className="login__brand">
        <Group gap="sm">
          <BrandMark size={36} />
          <Text fw={700} size="lg" c="white">
            ACME Salaries
          </Text>
        </Group>
        <div>
          <Title order={2} c="white" fw={650} maw={420} lh={1.25}>
            Salary records for 10,000 people, in one place instead of spreadsheets.
          </Title>
          <Stack gap="md" mt="xl">
            {POINTS.map(({ icon: Icon, text }) => (
              <Group key={text} gap="sm" wrap="nowrap">
                <Icon size={20} stroke={1.7} className="login__icon" aria-hidden="true" />
                <Text size="sm" className="login__point">
                  {text}
                </Text>
              </Group>
            ))}
          </Stack>
        </div>
        <Text size="xs" className="login__point">
          For ACME's HR team.
        </Text>
      </section>

      <main className="login__form">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!password) return setMissing(true);
            login.mutate();
          }}
          style={{ width: '100%', maxWidth: 360 }}
        >
          <Stack>
            <div>
              <Title order={1} size="h2">
                Sign in
              </Title>
              <Text c="dimmed" size="sm">
                Use the shared HR password.
              </Text>
            </div>
            {error && <Alert color="red">{error}</Alert>}
            <PasswordInput
              label="Password"
              leftSection={<IconLock size={16} />}
              value={password}
              onChange={(e) => {
                setPassword(e.currentTarget.value);
                setMissing(false);
              }}
              error={missing ? 'Enter the HR password' : undefined}
              withAsterisk
              autoFocus
              size="md"
            />
            <Button type="submit" loading={login.isPending} size="md">
              Sign in
            </Button>
          </Stack>
        </form>
      </main>
    </div>
  );
}
