import { it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Dashboard, { Progress } from '../src/components/Dashboard';
import { emptyData } from '../src/types';
import { unknown } from '../src/nutrition';
const state = vi.hoisted(() => ({ data: {} as any, queue: [], owner: 'u', mutate: vi.fn() }));
vi.mock('../src/store', () => ({
  useStore: () => state,
  base: () => ({ id: 'new', user_id: 'u' }),
  op: vi.fn(),
}));
it('updates all dashboard nutrients after diary changes, with independent overage and incomplete totals', () => {
  state.data = emptyData();
  state.data.nutrition_targets = [
    {
      id: 't',
      user_id: 'u',
      effective_date: '2026-01-01',
      nutrition: { calories: 2100, protein: 140, carbs: 200, fat: 60, fibre: null },
    },
  ];
  state.data.diary_entries = [
    {
      id: 'e',
      user_id: 'u',
      date: '2026-10-11',
      meal: 'Lunch',
      name: 'Paneer',
      quantity: 100,
      unit: 'g',
      nutrition: { calories: 1450, protein: 85, carbs: 220, fat: 30, fibre: null },
    },
  ];
  const props = {
    date: '2026-10-11',
    setDate: vi.fn(),
    onAdd: vi.fn(),
    onScan: vi.fn(),
    onEdit: vi.fn(),
    onSettings: vi.fn(),
  };
  const { rerender } = render(<Dashboard {...props} />);
  expect(screen.getByText('650')).toBeVisible();
  expect(screen.getByText('55 g remaining')).toBeVisible();
  expect(screen.getByText('Over by 20 g')).toBeVisible();
  expect(screen.getByText('30 g remaining')).toBeVisible();
  state.data.diary_entries.push({
    id: 'e2',
    user_id: 'u',
    date: '2026-10-11',
    meal: 'Snacks',
    name: 'Quick',
    quantity: 1,
    unit: 'entry',
    nutrition: { ...unknown(), calories: 100 },
  });
  rerender(<Dashboard {...props} />);
  expect(screen.getByText('550')).toBeVisible();
  expect(screen.getByText('Incomplete · 55 g remaining')).toBeVisible();
});
it('caps visuals and does not invent percentages for unset targets', () => {
  const { rerender, container } = render(
    <Progress label="Protein" k="protein" consumed={200} target={140} incomplete={false} />,
  );
  expect(screen.getByText('Over by 60 g')).toBeVisible();
  expect(container.querySelector('.bar>div')).toHaveStyle({ width: '100%' });
  rerender(
    <Progress label="Protein" k="protein" consumed={200} target={null} incomplete={false} />,
  );
  expect(screen.getByText('Set target')).toBeVisible();
  expect(container.querySelector('.bar>div')).toHaveStyle({ width: '0%' });
});
