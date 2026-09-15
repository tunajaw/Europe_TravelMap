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
    { id: 'plane-1', date: '2026-01-01', globalSequence: 1, originCityId: 'alpha', destinationCityId: 'beta', originCountryId: 'country-a', transportationCategory: 'Plane', company: 'Ryanair', notes: 'Base note / Seat reserved', baseCostEur: 10, baseDistanceKm: 100 },
    { id: 'plane-2', date: '2026-01-02', globalSequence: 2, originCityId: 'beta', destinationCityId: 'gamma', originCountryId: 'country-a', transportationCategory: 'Plane', baseCostEur: 30, baseDistanceKm: 200 },
    { id: 'plane-free', date: '2026-01-03', globalSequence: 3, originCityId: 'gamma', destinationCityId: 'alpha', originCountryId: 'country-a', transportationCategory: 'Plane', baseCostEur: 0, baseDistanceKm: 50 },
    { id: 'plane-airport-only', date: '2026-01-04', globalSequence: 4, originCityId: 'alpha', destinationCityId: 'gamma', originCountryId: 'country-a', transportationCategory: 'Plane', baseCostEur: 0, baseDistanceKm: 60 },
    { id: 'train-1', date: '2026-01-05', globalSequence: 5, originCityId: 'gamma', destinationCityId: 'beta', originCountryId: 'country-b', transportationCategory: 'Train', baseCostEur: 12, baseDistanceKm: 80 },
  ] as TravelData['segments'],
  transfers: [
    { id: 'transfer-plane-1', segmentId: 'plane-1', side: 'departure', endpointKind: 'airport', expenseInclusion: 'airport-filter', costEur: 5, distanceKm: 10, notes: 'Airport coach / Early shuttle' },
    { id: 'transfer-plane-2', segmentId: 'plane-2', side: 'arrival', endpointKind: 'local', expenseInclusion: 'always', costEur: 2, distanceKm: 3, notes: 'Port shuttle / Walk' },
    { id: 'transfer-airport-only', segmentId: 'plane-airport-only', side: 'arrival', endpointKind: 'airport', expenseInclusion: 'airport-filter', costEur: 5, distanceKm: 8, notes: null },
  ] as TravelData['transfers'],
  cities: [
    { id: 'alpha', name: 'Alpha' },
    { id: 'beta', name: 'Beta' },
    { id: 'gamma', name: 'Gamma' },
  ] as TravelData['cities'],
  countries: [
    { id: 'country-a', name: 'France', boundaryId: '250', isMicrostate: false, marker: { longitude: 2.35, latitude: 48.86 } },
    { id: 'country-b', name: 'Germany', boundaryId: '276', isMicrostate: false, marker: { longitude: 13.4, latitude: 52.52 } },
  ] as TravelData['countries'],
  accommodations: [
    { id: 'stay-a', sequence: 1, cityId: 'alpha', countryId: 'country-a', type: 'Airbnb', label: 'Airbnb in Alpha', nights: 2, pricePerNightEur: 30, totalCostEur: 60, commuteMinutes: 10, rating: { components: [1, 1, .5, .5, .5, .5, 0], total: 4 }, notes: 'A note', nearestStationName: 'Alpha Station' },
    { id: 'stay-h', sequence: 2, cityId: 'beta', countryId: 'country-a', type: 'Hostel', label: 'Hostel in Beta', nights: 1, pricePerNightEur: 20, totalCostEur: 20, commuteMinutes: 20, rating: { components: [1, 1, 1, .5, .5, .5, .5], total: 5 }, notes: null, nearestStationName: 'Beta Station' },
    { id: 'stay-hotel', sequence: 3, cityId: 'gamma', countryId: 'country-b', type: 'Hotel', label: 'Hotel in Gamma', nights: 1, pricePerNightEur: 50, totalCostEur: 50, commuteMinutes: 15, rating: { components: [1, .5, 0, .5, .5, .5, 0], total: 3 }, notes: null, nearestStationName: 'Gamma Station' },
    { id: 'stay-airport', sequence: 4, cityId: 'gamma', countryId: 'country-b', type: 'Airport', label: 'Airport in Gamma', nights: 1, pricePerNightEur: 0, totalCostEur: 0, commuteMinutes: null, rating: { components: [1, 1, 1, .5, .5], total: 4 }, notes: null, nearestStationName: null },
  ] as TravelData['accommodations'],
};

describe('Expense explorer (FR-EXP-01 through FR-EXP-15)', () => {
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

  it('renders the complete Accommodation analysis with weighted summaries and Airport control', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);
    await user.click(screen.getByRole('tab', { name: 'Accommodation' }));

    const categories = screen.getByRole('group', { name: 'Accommodation categories' });
    const airbnb = within(categories).getByRole('button', { name: /Airbnb/ });
    expect(airbnb).toHaveTextContent('Total € 60.00');
    expect(airbnb).toHaveTextContent('Avg. € 30.00 / night');
    expect(airbnb).toHaveTextContent('Avg. commute 10.00 min');
    const airport = within(categories).getByRole('button', { name: /Airport/ });
    expect(within(categories).getAllByRole('button')).toHaveLength(4);
    expect(airport).toHaveAttribute('aria-pressed', 'false');
    expect(airport).toHaveTextContent('Avg. commute Not applicable');
    expect(screen.queryByRole('checkbox', { name: 'Include airport overnight stays' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Accommodation barplot' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Accommodation expense heatmap' })).toBeVisible();
  });

  it('filters Accommodation bars and updates Airport-weighted heatmap data', async () => {
    const user = userEvent.setup();
    const { container } = render(<ExpenseExplorer data={expenseData} />);
    await user.click(screen.getByRole('tab', { name: 'Accommodation' }));

    const categories = screen.getByRole('group', { name: 'Accommodation categories' });
    const chart = screen.getByRole('list', { name: 'Accommodation barplot' });
    await user.click(within(categories).getByRole('button', { name: /Hostel/ }));
    expect(within(chart).getAllByRole('listitem')).toHaveLength(2);
    await user.click(within(categories).getByRole('button', { name: /Airport/ }));
    expect(within(chart).getAllByRole('listitem')).toHaveLength(3);
    expect(within(chart).getByRole('button', { name: /Select Gamma · Airport, € 0.00/ })).toBeVisible();

    await user.hover(container.querySelector('[data-heatmap-country="country-b"]')!);
    expect(screen.getByRole('region', { name: 'Germany heatmap details' }))
      .toHaveTextContent('€ 25.00 / night');
  });

  it('switches Accommodation metrics and sorts bars chronologically', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);
    await user.click(screen.getByRole('tab', { name: 'Accommodation' }));

    const metric = screen.getByRole('combobox', { name: 'Accommodation display metric' });
    const sort = screen.getByRole('combobox', { name: 'Accommodation sort order' });
    const chart = screen.getByRole('list', { name: 'Accommodation barplot' });
    expect(metric).toHaveValue('nightly-price');
    expect(within(chart).getAllByRole('listitem')[0]).toHaveTextContent('Gamma · Hotel');

    await user.selectOptions(metric, 'commute');
    expect(within(chart).getAllByRole('listitem')[0]).toHaveTextContent('Beta · Hostel');

    await user.selectOptions(sort, 'chronological');
    expect(within(chart).getAllByRole('listitem')[0]).toHaveTextContent('Alpha · Airbnb');

    await user.selectOptions(sort, 'rating');
    expect(sort).toHaveValue('rating');
    expect(within(chart).getAllByRole('listitem')[0]).toHaveTextContent('Beta · Hostel');
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
    expect(plane).toHaveTextContent('Total € 52.00');
    expect(plane).toHaveTextContent('Avg. € 13.00');
    expect(screen.getByRole('button', { name: /Train/ })).toHaveTextContent('Total € 12.00');
    expect(screen.getByRole('button', { name: /High-speed Rail/ })).toHaveTextContent('Total € 0.00');
  });

  it('includes Airport Transfers by default and recalculates when they are excluded', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    const airportTransfers = screen.getByRole('checkbox', { name: 'Include airport transfers' });
    expect(airportTransfers).toBeChecked();
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Total € 52.00');

    await user.click(airportTransfers);

    expect(airportTransfers).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Total € 42.00');
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Avg. € 10.50');
  });

  it('classifies zero-cost Segments after applying the Airport Transfer option', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    const zeroCost = screen.getByRole('checkbox', { name: 'Include 0-Cost Segments' });
    expect(zeroCost).toBeChecked();
    await user.click(zeroCost);
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Total € 52.00');
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Avg. € 17.33');

    await user.click(screen.getByRole('checkbox', { name: 'Include airport transfers' }));
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Total € 42.00');
    expect(screen.getByRole('button', { name: /Plane/ })).toHaveTextContent('Avg. € 21.00');
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
    expect(initialRows[0]).toHaveTextContent('€ 32.00');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort order' }), 'chronological');
    expect(within(chart).getAllByRole('listitem')[0]).toHaveTextContent('Alpha → Beta');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Display metric' }), 'cost-per-100-km');
    expect(within(chart).getAllByRole('listitem')[0]).toHaveTextContent('€ 13.64 / 100 km');
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

  it('applies category filters to both the barplot and Country heatmap', async () => {
    const user = userEvent.setup();
    const { container } = render(<ExpenseExplorer data={expenseData} />);
    const scaleBeforeFiltering = screen.getByLabelText('Heatmap scale').textContent;
    expect(container.querySelector('[data-heatmap-country="country-a"]'))
      .toHaveClass('transportation-heatmap-country--data');

    await user.click(screen.getByRole('button', { name: /Plane/ }));

    expect(container.querySelector('[data-heatmap-country="country-a"]'))
      .not.toHaveClass('transportation-heatmap-country--data');
    expect(container.querySelector('[data-heatmap-country="country-b"]'))
      .toHaveClass('transportation-heatmap-country--data');
    expect(screen.getByLabelText('Heatmap scale')).toHaveTextContent(scaleBeforeFiltering ?? '');
  });

  it('shows Segment and Transfer metadata when a bar is hovered or focused', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer data={expenseData} />);

    expect(screen.getByText(/Hover over or focus a Segment bar/)).toBeVisible();
    const row = screen.getByRole('button', { name: /Select Alpha to Beta/ });
    await user.hover(row);

    const details = screen.getByRole('region', { name: 'Alpha to Beta details' });
    expect(details.compareDocumentPosition(screen.getByRole('list', { name: 'Transportation barplot' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(details).toHaveTextContent('Base Segment');
    expect(details).toHaveTextContent('Ryanair');
    expect(within(details).getByRole('img', { name: 'Ryanair icon' })).toHaveAttribute(
      'src',
      '/images/companies/ryanair.png',
    );
    expect(details).toHaveTextContent('Base note');
    expect(within(details).getByText('Base note')).toBeVisible();
    expect(within(details).getByText('Seat reserved')).toBeVisible();
    expect(details).toHaveTextContent('Departure Transfer');
    expect(details).toHaveTextContent('€ 5.00');
    expect(details).toHaveTextContent('Airport coach');
    expect(within(details).getByText('Airport coach')).toBeVisible();
    expect(within(details).getByText('Early shuttle')).toBeVisible();
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
    expect(within(localTransferDetails).getByText('Port shuttle')).toBeVisible();
    expect(within(localTransferDetails).getByText('Walk')).toBeVisible();
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
