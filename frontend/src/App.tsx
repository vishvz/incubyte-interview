import { Alert, AppShell, Burger, Button, Center, Group, NavLink, Select, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { createBrowserRouter, Navigate, NavLink as RouterLink, Outlet, useLocation, useRouteError } from 'react-router';
import { clearToken, getToken } from './api/client';
import { useMoney } from './currency';
import { formatDate } from './lib/format';
import { Changes } from './pages/Changes';
import { EmployeeForm } from './pages/EmployeeForm';
import { EmployeeProfile } from './pages/EmployeeProfile';
import { Employees } from './pages/Employees';
import { Login } from './pages/Login';
import { OutsideBand } from './pages/OutsideBand';
import { Payroll } from './pages/Payroll';
import { PayRanges } from './pages/PayRanges';

const NAV = [
  { to: '/employees', label: 'Employees', hint: 'Find and update people' },
  { to: '/pay-ranges', label: 'Pay ranges', hint: 'Median and spread by level' },
  { to: '/outside-band', label: 'Outside band', hint: 'Paid below or above band' },
  { to: '/payroll', label: 'Payroll', hint: 'Cost per department' },
  { to: '/changes', label: 'Recent changes', hint: 'Latest salary changes' },
];

function CurrencyPicker() {
  const { display, setDisplay, currencies, rateAsOf } = useMoney();
  return (
    <Stack gap={2}>
      <Select
        label="Show amounts in"
        size="xs"
        value={display}
        onChange={(v) => v && setDisplay(v)}
        data={[{ value: 'local', label: 'Local currency' }, ...currencies.map((c) => ({ value: c, label: c }))]}
        allowDeselect={false}
        w={160}
      />
      {display !== 'local' && rateAsOf && (
        <Text size="xs" c="dimmed">
          Rates as of {formatDate(rateAsOf)}
        </Text>
      )}
    </Stack>
  );
}

function Layout() {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();
  if (!getToken()) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 232, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <Text fw={700} size="lg">
              ACME Salaries
            </Text>
          </Group>
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            onClick={() => {
              clearToken();
              window.location.assign('/login');
            }}
          >
            Log out
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        <Stack justify="space-between" h="100%">
          <nav aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                component={RouterLink}
                to={n.to}
                label={n.label}
                description={n.hint}
                active={location.pathname.startsWith(n.to)}
                onClick={close}
              />
            ))}
          </nav>
          <CurrencyPicker />
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

function ErrorPage() {
  const error = useRouteError();
  console.error(error);
  return (
    <Center mih="60vh" p="md">
      <Alert color="red" title="This page could not be shown" maw={480}>
        Something went wrong while showing this page. Reload to try again, or{' '}
        <a href="/employees">go back to employees</a>.
      </Alert>
    </Center>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/employees" replace /> },
      { path: '/employees', element: <Employees /> },
      { path: '/employees/new', element: <EmployeeForm /> },
      { path: '/employees/:id', element: <EmployeeProfile /> },
      { path: '/employees/:id/edit', element: <EmployeeForm /> },
      { path: '/pay-ranges', element: <PayRanges /> },
      { path: '/outside-band', element: <OutsideBand /> },
      { path: '/payroll', element: <Payroll /> },
      { path: '/changes', element: <Changes /> },
      { path: '*', element: <Navigate to="/employees" replace /> },
    ],
  },
]);
