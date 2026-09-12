// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { TravelData } from '../../src/domain/travel-data.ts';
import { ExpenseExplorer } from '../../src/features/expense/ExpenseExplorer.tsx';

afterEach(cleanup);

const expenseData = {
  segments: [
    { id: 'plane-1', transportationCategory: 'Plane', baseCostEur: 10, baseDistanceKm: 100 },
    { id: 'plane-2', transportationCategory: 'Plane', baseCostEur: 30, baseDistanceKm: 200 },
    { id: 'plane-free', transportationCategory: 'Plane', baseCostEur: 0, baseDistanceKm: 50 },
    { id: 'plane-airport-only', transportationCategory: 'Plane', baseCostEur: 0, baseDistanceKm: 60 },
    { id: 'train-1', transportationCategory: 'Train', baseCostEur: 12, baseDistanceKm: 80 },
  ] as TravelData['segments'],
  transfers: [
    { segmentId: 'plane-1', expenseInclusion: 'airport-filter', costEur: 5, distanceKm: 10 },
    { segmentId: 'plane-2', expenseInclusion: 'always', costEur: 2, distanceKm: 3 },
    { segmentId: 'plane-airport-only', expenseInclusion: 'airport-filter', costEur: 5, distanceKm: 8 },
  ] as TravelData['transfers'],
};

describe('FR-EXP-01 Expense page selection', () => {
  it('defaults to Transportation and switches between mutually exclusive views', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    const transportation = screen.getByRole('tab', { name: 'Transportation' });
    const accommodation = screen.getByRole('tab', { name: 'Accommodation' });

    expect(transportation).toHaveAttribute('aria-selected', 'true');
    expect(accommodation).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel', { name: 'Transportation' })).toBeVisible();

    await user.click(accommodation);

    expect(transportation).toHaveAttribute('aria-selected', 'false');
    expect(accommodation).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Accommodation' })).toBeVisible();
    expect(screen.queryByRole('tabpanel', { name: 'Transportation' })).not.toBeInTheDocument();
  });

  it('switches tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    const transportation = screen.getByRole('tab', { name: 'Transportation' });
    const accommodation = screen.getByRole('tab', { name: 'Accommodation' });
    transportation.focus();
    await user.keyboard('{ArrowRight}');

    expect(accommodation).toHaveFocus();
    expect(accommodation).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Accommodation' })).toBeVisible();
  });

  it('shows all six transportation categories with total and per-Segment average cost', () => {
    render(<ExpenseExplorer data={expenseData} />);

    const categories = screen.getByRole('group', { name: 'Transportation categories' });
    expect(categories).toHaveTextContent('High-speed Rail');
    expect(categories).toHaveTextContent('Train');
    expect(categories).toHaveTextContent('City Bus');
    expect(categories).toHaveTextContent('InterCity Bus');
    expect(categories).toHaveTextContent('Plane');
    expect(categories).toHaveTextContent('Ferry / Cruise');

    const plane = screen.getByRole('button', { name: /Plane/ });
    expect(plane).toHaveTextContent('Total EUR 52.00');
    expect(plane).toHaveTextContent('Avg. EUR 13.00');
    expect(screen.getByRole('button', { name: /Train/ })).toHaveTextContent('Total EUR 12.00');
    expect(screen.getByRole('button', { name: /High-speed Rail/ })).toHaveTextContent('Total EUR 0.00');
  });

  it('includes Airport Transfers by default and recalculates when they are excluded', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    const airportTransfers = screen.getByRole('checkbox', { name: 'Include airport transfers' });
    expect(airportTransfers).toBeChecked();
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Total EUR 52.00');

    await user.click(airportTransfers);

    expect(airportTransfers).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Total EUR 42.00');
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Avg. EUR 10.50');
  });

  it('classifies zero-cost Segments after applying the Airport Transfer option', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    const zeroCost = screen.getByRole('checkbox', { name: 'Include 0-Cost Segments' });
    expect(zeroCost).toBeChecked();
    await user.click(zeroCost);
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Total EUR 52.00');
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Avg. EUR 17.33');

    await user.click(screen.getByRole('checkbox', { name: 'Include airport transfers' }));
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Total EUR 42.00');
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Avg. EUR 21.00');
  });
});
