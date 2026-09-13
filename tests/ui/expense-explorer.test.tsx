// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { TravelData } from '../../src/domain/travel-data.ts';
import { ExpenseExplorer } from '../../src/features/expense/ExpenseExplorer.tsx';

afterEach(cleanup);

const expenseData = {
  segments: [
    { id: 'plane-1', date: '2026-01-01', globalSequence: 1, originCityId: 'alpha', destinationCityId: 'beta', transportationCategory: 'Plane', company: 'Ryanair', notes: 'Base note', baseCostEur: 10, baseDistanceKm: 100 },
    { id: 'plane-2', date: '2026-01-02', globalSequence: 2, originCityId: 'beta', destinationCityId: 'gamma', transportationCategory: 'Plane', baseCostEur: 30, baseDistanceKm: 200 },
    { id: 'plane-free', date: '2026-01-03', globalSequence: 3, originCityId: 'gamma', destinationCityId: 'alpha', transportationCategory: 'Plane', baseCostEur: 0, baseDistanceKm: 50 },
    { id: 'plane-airport-only', date: '2026-01-04', globalSequence: 4, originCityId: 'alpha', destinationCityId: 'gamma', transportationCategory: 'Plane', baseCostEur: 0, baseDistanceKm: 60 },
    { id: 'train-1', date: '2026-01-05', globalSequence: 5, originCityId: 'gamma', destinationCityId: 'beta', transportationCategory: 'Train', baseCostEur: 12, baseDistanceKm: 80 },
  ] as TravelData['segments'],
  transfers: [
    { id: 'transfer-plane-1', segmentId: 'plane-1', side: 'departure', endpointKind: 'airport', expenseInclusion: 'airport-filter', costEur: 5, distanceKm: 10, notes: 'Airport coach' },
    { id: 'transfer-plane-2', segmentId: 'plane-2', side: 'arrival', endpointKind: 'local', expenseInclusion: 'always', costEur: 2, distanceKm: 3, notes: 'Port shuttle' },
    { id: 'transfer-airport-only', segmentId: 'plane-airport-only', side: 'arrival', endpointKind: 'airport', expenseInclusion: 'airport-filter', costEur: 5, distanceKm: 8, notes: null },
  ] as TravelData['transfers'],
  cities: [
    { id: 'alpha', name: 'Alpha' },
    { id: 'beta', name: 'Beta' },
    { id: 'gamma', name: 'Gamma' },
  ] as TravelData['cities'],
};

describe('Expense explorer (FR-EXP-01 through FR-EXP-06)', () => {
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

  it('defaults to total cost and allows selecting cost per 100 km', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    const metric = screen.getByRole('combobox', { name: 'Display metric' });
    expect(metric).toHaveValue('total-cost');

    await user.selectOptions(metric, 'cost-per-100-km');

    expect(metric).toHaveValue('cost-per-100-km');
  });

  it('defaults to descending order and allows chronological sorting', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    const sortOrder = screen.getByRole('combobox', { name: 'Sort order' });
    expect(sortOrder).toHaveValue('descending');

    await user.selectOptions(sortOrder, 'chronological');

    expect(sortOrder).toHaveValue('chronological');
  });

  it('renders one horizontal bar per included Segment in the selected order', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    const chart = screen.getByRole('list', { name: 'Transportation barplot' });
    const initialRows = within(chart).getAllByRole('listitem');
    expect(initialRows).toHaveLength(5);
    expect(initialRows[0]).toHaveTextContent('Beta → Gamma');
    expect(initialRows[0]).toHaveTextContent('EUR 32.00');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort order' }), 'chronological');
    expect(within(chart).getAllByRole('listitem')[0]).toHaveTextContent('Alpha → Beta');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Display metric' }), 'cost-per-100-km');
    expect(within(chart).getAllByRole('listitem')[0]).toHaveTextContent('EUR 13.64 / 100 km');
  });

  it('uses the category buttons to filter the barplot', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    await user.click(screen.getByRole('button', { name: /Plane/ }));

    expect(screen.getByRole('button', { name: /Plane/ })).toHaveAttribute('aria-pressed', 'false');
    const rows = within(screen.getByRole('list', { name: 'Transportation barplot' })).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Gamma → Beta');
  });

  it('shows Segment and Transfer metadata when a bar is hovered or focused', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    expect(screen.getByText(/Hover over or focus a Segment bar/)).toBeVisible();
    const row = screen.getByRole('button', { name: /Select Alpha to Beta/ });
    await user.hover(row);

    const details = screen.getByRole('region', { name: 'Alpha to Beta details' });
    expect(details).toHaveTextContent('Base Segment');
    expect(details).toHaveTextContent('Ryanair');
    expect(within(details).getByRole('img', { name: 'Ryanair icon' })).toHaveAttribute(
      'src',
      '/images/companies/ryanair.png',
    );
    expect(details).toHaveTextContent('Base note');
    expect(details).toHaveTextContent('Departure Transfer');
    expect(details).toHaveTextContent('EUR 5.00');
    expect(details).toHaveTextContent('Airport coach');
    expect(details).toHaveTextContent('Included in current value');

    await user.unhover(row);
    expect(screen.queryByRole('region', { name: 'Alpha to Beta details' })).not.toBeInTheDocument();
    expect(screen.getByText(/Hover over or focus a Segment bar/)).toBeVisible();
    fireEvent.focus(row);
    expect(screen.getByRole('region', { name: 'Alpha to Beta details' })).toBeVisible();

    await user.unhover(row);
    const localTransferRow = screen.getByRole('listitem', { name: /Beta to Gamma/ });
    await user.hover(localTransferRow);
    const localTransferDetails = screen.getByRole('region', { name: 'Beta to Gamma details' });
    expect(localTransferDetails).toHaveTextContent('Arrival Transfer');
    expect(localTransferDetails).toHaveTextContent('Local transfer');
    expect(localTransferDetails).toHaveTextContent('Port shuttle');
  });

  it('marks an Airport Transfer excluded when its checkbox is off', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);
    await user.click(screen.getByRole('checkbox', { name: 'Include airport transfers' }));
    await user.hover(screen.getByRole('button', { name: /Select Alpha to Beta/ }));

    expect(screen.getByRole('region', { name: 'Alpha to Beta details' }))
      .toHaveTextContent('Excluded by current filter');
  });

  it('locks metadata on click while hover remains a temporary preview', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    const alphaToBeta = screen.getByRole('button', { name: /Select Alpha to Beta/ });
    const betaToGamma = screen.getByRole('button', { name: /Select Beta to Gamma/ });

    await user.click(alphaToBeta);
    await user.unhover(alphaToBeta);
    expect(alphaToBeta).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Alpha to Beta details' })).toBeVisible();

    await user.hover(betaToGamma);
    expect(screen.getByRole('region', { name: 'Beta to Gamma details' })).toBeVisible();
    expect(alphaToBeta).toHaveAttribute('aria-pressed', 'true');

    await user.unhover(betaToGamma);
    expect(screen.getByRole('region', { name: 'Alpha to Beta details' })).toBeVisible();

    await user.click(alphaToBeta);
    await user.unhover(alphaToBeta);
    expect(alphaToBeta).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('region', { name: 'Alpha to Beta details' })).not.toBeInTheDocument();
    expect(screen.getByText(/Hover over or focus a Segment bar/)).toBeVisible();
  });
});
