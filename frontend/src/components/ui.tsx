import { Avatar, Badge, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconInboxOff,
  IconAdjustments,
  IconRosette,
  IconCalendarRepeat,
  IconUserPlus,
  type Icon,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { SalaryReason } from '../api/types';
import { REASON_LABELS } from '../lib/format';

/** Title row shared by every page: icon, title, one line of context, actions on the right. */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: Icon;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="start" mb="md" wrap="wrap" gap="md">
      <Group gap="md" align="start" wrap="nowrap">
        <ThemeIcon size={44} radius="md" variant="light">
          <Icon size={24} stroke={1.6} />
        </ThemeIcon>
        <div>
          <Title order={1} size="h2" lh={1.2}>
            {title}
          </Title>
          {description && (
            <Text c="dimmed" size="sm" mt={2}>
              {description}
            </Text>
          )}
        </div>
      </Group>
      {actions && <Group gap="sm">{actions}</Group>}
    </Group>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  note,
  tone,
  to,
}: {
  icon: Icon;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'below' | 'above';
  to?: string;
}) {
  const body = (
    <Paper withBorder p="md" className={to ? 'tile tile--link' : 'tile'} h="100%">
      <Group justify="space-between" align="start" wrap="nowrap">
        <Text size="sm" fw={600} className={tone ? `position-${tone}` : undefined}>
          {label}
        </Text>
        <Icon size={20} stroke={1.6} className={tone ? `position-${tone}` : 'icon-muted'} aria-hidden="true" />
      </Group>
      <Text fz={28} fw={650} lh={1.2} mt={6} className="num">
        {value}
      </Text>
      {note && (
        <Text size="xs" c="dimmed" mt={4}>
          {note}
        </Text>
      )}
    </Paper>
  );
  return to ? (
    <Link to={to} className="tile-anchor">
      {body}
    </Link>
  ) : (
    body
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Stack align="center" gap={6} py="xl">
      <ThemeIcon size={48} radius="xl" variant="light" color="gray">
        <IconInboxOff size={26} stroke={1.5} />
      </ThemeIcon>
      <Text fw={600}>{title}</Text>
      {children && (
        <Text size="sm" c="dimmed" ta="center" maw={420}>
          {children}
        </Text>
      )}
    </Stack>
  );
}

const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();

/** Avatar with initials, linked name and employee code. */
export function PersonCell({
  id,
  firstName,
  lastName,
  sub,
  terminated,
}: {
  id: number;
  firstName: string;
  lastName: string;
  sub?: ReactNode;
  terminated?: boolean;
}) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Avatar size={34} radius="xl" color="ledger" variant="light">
        {initials(firstName, lastName)}
      </Avatar>
      <div style={{ minWidth: 0 }}>
        <Group gap={6} wrap="nowrap">
          <Link
            to={`/employees/${id}`}
            onClick={(e) => e.stopPropagation()}
            className="person-link"
          >
            {firstName} {lastName}
          </Link>
          {terminated && (
            <Badge size="xs" color="gray" variant="light">
              Terminated
            </Badge>
          )}
        </Group>
        {sub && (
          <Text size="xs" c="dimmed" truncate>
            {sub}
          </Text>
        )}
      </div>
    </Group>
  );
}

const REASON_STYLE: Record<SalaryReason, { color: string; icon: Icon }> = {
  hire: { color: 'gray', icon: IconUserPlus },
  promotion: { color: 'ledger', icon: IconRosette },
  annual_review: { color: 'blue', icon: IconCalendarRepeat },
  adjustment: { color: 'grape', icon: IconAdjustments },
};

export function ReasonBadge({ reason }: { reason: SalaryReason }) {
  const { color, icon: Icon } = REASON_STYLE[reason];
  return (
    <Badge variant="light" color={color} leftSection={<Icon size={12} stroke={2} />} tt="none" fw={600}>
      {REASON_LABELS[reason]}
    </Badge>
  );
}

/** "+5.3%" with an arrow; text carries the meaning, colour only supports it. */
export function ChangeDelta({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  const Icon = up ? IconArrowUpRight : IconArrowDownRight;
  return (
    <Group gap={2} justify="end" wrap="nowrap" className={up ? 'delta-up' : 'delta-down'}>
      <Icon size={14} stroke={2} aria-hidden="true" />
      <span className="num">
        {up ? '+' : ''}
        {pct.toFixed(1)}%
      </span>
    </Group>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  // Three bars of rising height: a pay range at a glance.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--quartile)" />
      <rect x="7" y="17" width="4" height="8" rx="2" fill="#fff" opacity="0.7" />
      <rect x="14" y="12" width="4" height="13" rx="2" fill="#fff" />
      <rect x="21" y="7" width="4" height="18" rx="2" fill="#fff" opacity="0.85" />
    </svg>
  );
}

/**
 * Card that holds a table: optional title row and filter toolbar on top, the table edge to edge,
 * and an optional footer (paging). Narrow screens hide columns instead of clipping them; the body
 * scrolls natively (visible scrollbar) only as a last resort.
 */
export function TableCard({
  title,
  icon: Icon,
  meta,
  actions,
  toolbar,
  footer,
  children,
}: {
  title?: string;
  icon?: Icon;
  meta?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper withBorder radius="md" className="table-card">
      {(title || toolbar) && (
        <div className="table-card__head">
          {title && (
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <Group gap={8} wrap="nowrap">
                {Icon && <Icon size={20} stroke={1.7} aria-hidden="true" />}
                <Title order={2} size="h4">
                  {title}
                </Title>
                {meta && (
                  <Text size="sm" c="dimmed">
                    {meta}
                  </Text>
                )}
              </Group>
              {actions}
            </Group>
          )}
          {toolbar && <div className="table-card__toolbar">{toolbar}</div>}
        </div>
      )}
      <div className="table-card__body">{children}</div>
      {footer && <div className="table-card__foot">{footer}</div>}
    </Paper>
  );
}
