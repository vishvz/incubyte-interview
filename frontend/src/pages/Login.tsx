import { Alert, Button, Center, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ApiError, post, setToken } from '../api/client';

export function Login() {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const login = useMutation({
    mutationFn: () => post<{ token: string }>('/api/login', { password }),
    onSuccess: ({ token }) => {
      setToken(token);
      navigate((location.state as { from?: string } | null)?.from ?? '/employees', { replace: true });
    },
  });

  const error =
    login.error instanceof ApiError && login.error.status === 401 ? 'That password is not right. Try again.' : login.error?.message;

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder p="xl" w={380} maw="100%">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <Stack>
            <div>
              <Title order={2}>ACME Salaries</Title>
              <Text c="dimmed" size="sm">
                Salary records for HR. Sign in to continue.
              </Text>
            </div>
            {error && <Alert color="red">{error}</Alert>}
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              autoFocus
            />
            <Button type="submit" loading={login.isPending}>
              Sign in
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
