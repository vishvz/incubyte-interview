import { Alert, AppShell, Avatar, Burger, Center, Group, Menu, Select, Stack, Text, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChartBar,
  IconChevronDown,
  IconCoins,
  IconHistory,
  IconLayoutDashboard,
  IconLogout,
  IconScale,
  IconUsers,
  IconWorld,
  type Icon,
} from '@tabler/icons-react';
import { createBrowserRouter, Navigate, NavLink as RouterLink, Outlet, useLocation, useRouteError } from 'react-router';
import { clearToken, getToken } from './api/client';
import { useMoney } from './currency';
import { BrandMark } from './components/ui';
import { formatDate } from './lib/format';
import { Changes } from './pages/Changes';
import { EmployeeForm } from './pages/EmployeeForm';
import { EmployeeProfile } from './pages/EmployeeProfile';
import { Employees } from './pages/Employees';
import { Login } from './pages/Login';
import { OutsideBand } from './pages/OutsideBand';
import { Overview } from './pages/Overview';
import { Payroll } from './pages/Payroll';
import { PayRanges } from './pages/PayRanges';

interface NavItem {
  to: string;
  label: string;
  icon: Icon;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'People',
    items: [
      { to: '/overview', label: 'Overview', icon: IconLayoutDashboard },
      { to: '/employees', label: 'Employees', icon: IconUsers },
      { to: '/changes', label: 'Recent changes', icon: IconHistory },
    ],
  },
  {
    section: 'Pay insights',
    items: [
      { to: '/pay-ranges', label: 'Pay ranges', icon: IconChartBar },
      { to: '/outside-band', label: 'Outside band', icon: IconScale },
      { to: '/payroll', label: 'Payroll', icon: IconCoins },
    ],
  },
];

const logout = () => {
  clearToken();
  window.location.assign('/login');
};

function CurrencyPicker() {
  const { display, setDisplay, currencies, rateAsOf } = useMoney();
  return (
    <div className="nav-currency">
      <Group gap={6} mb={6}>
        <IconWorld size={16} stroke={1.6} aria-hidden="true" />
        <Text size="xs" fw={600} component="label" htmlFor="display-currency">
          Show amounts in
        </Text>
      </Group>
      <Select
        id="display-currency"
        size="xs"
        value={display}
        onChange={(v) => v && setDisplay(v)}
        data={[{ value: 'local', label: 'Local currency' }, ...currencies.map((c) => ({ value: c, label: c }))]}
        allowDeselect={false}
        aria-label="Show amounts in"
      />
      <Text size="xs" mt={6} className="nav-muted">
        {display === 'local'
          ? 'Each amount in its own currency.'
          : rateAsOf
            ? `Converted at rates as of ${formatDate(rateAsOf)}.`
            : ''}
      </Text>
    </div>
  );
}

function Layout() {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();
  if (!getToken()) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 248, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding={{ base: "md", sm: "xl" }}>
      <AppShell.Header px="lg" className="app-header">
        <Group h="100%" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <BrandMark />
            <div>
              <Text fw={700} lh={1.1}>
                ACME Salaries
              </Text>
              <Text size="xs" c="dimmed" lh={1.1} visibleFrom="xs">
                Compensation records
              </Text>
            </div>
          </Group>
          <Menu position="bottom-end" width={200}>
            <Menu.Target>
              <UnstyledButton aria-label="HR manager, account menu" className="account-button">
                <Group gap={8}>
                  <Avatar size={32} radius="xl" color="ledger">
                    HR
                  </Avatar>
                  <Text size="sm" fw={600} visibleFrom="xs">
                    HR manager
                  </Text>
                  <IconChevronDown size={14} stroke={1.8} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Signed in with the shared HR password</Menu.Label>
              <Menu.Item leftSection={<IconLogout size={16} />} onClick={logout}>
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" className="app-nav">
        <Stack justify="space-between" h="100%">
          <nav aria-label="Main">
            {NAV.map((group) => (
              <div key={group.section} className="nav-group">
                <Text className="nav-section">{group.section}</Text>
                {group.items.map((item) => {
                  const active = location.pathname.startsWith(item.to);
                  return (
                    <RouterLink
                      key={item.to}
                      to={item.to}
                      onClick={close}
                      className="nav-item"
                      data-active={active || undefined}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon size={19} stroke={1.7} aria-hidden="true" />
                      <span>{item.label}</span>
                    </RouterLink>
                  );
                })}
              </div>
            ))}
          </nav>
          <CurrencyPicker />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className="app-main">
        <div className="page">
          <Outlet />
        </div>
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
        Something went wrong while showing this page. Reload to try again, or <a href="/overview">go to the overview</a>.
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
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: '/overview', element: <Overview /> },
      { path: '/employees', element: <Employees /> },
      { path: '/employees/new', element: <EmployeeForm /> },
      { path: '/employees/:id', element: <EmployeeProfile /> },
      { path: '/employees/:id/edit', element: <EmployeeForm /> },
      { path: '/pay-ranges', element: <PayRanges /> },
      { path: '/outside-band', element: <OutsideBand /> },
      { path: '/payroll', element: <Payroll /> },
      { path: '/changes', element: <Changes /> },
      { path: '*', element: <Navigate to="/overview" replace /> },
    ],
  },
]);
