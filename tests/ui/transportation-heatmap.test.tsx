// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { TravelData } from '../../src/domain/travel-data.ts';
import { TransportationHeatmap } from '../../src/features/expense/TransportationHeatmap.tsx';
import type { TransportationBarRow } from '../../src/features/expense/transportation-bar-data.ts';

afterEach(cleanup);

const countries = [
  { id: 'france', name: 'France', boundaryId: '250', isMicrostate: false, marker: { longitude: 2.35, latitude: 48.86 } },
  { id: 'germany', name: 'Germany', boundaryId: '276', isMicrostate: false, marker: { longitude: 13.4, latitude: 52.52 } },
  { id: 'andorra', name: 'Andorra', boundaryId: '020', isMicrostate: true, marker: { longitude: 1.52, latitude: 42.51 } },
] as TravelData['countries'];

const segmentRows = [
  { segmentId: 'fr-1', originCountryId: 'france', value: 10 },
  { segmentId: 'fr-2', originCountryId: 'france', value: 30 },
  { segmentId: 'de-1', originCountryId: 'germany', value: 10 },
] as TransportationBarRow[];

describe('Transportation heatmap (FR-EXP-07 and FR-EXP-08)', () => {
  it('renders reviewed Countries and an extra marker for each microstate', () => {
    const { container } = render(
      <TransportationHeatmap countries={countries} metric="total-cost" scaleMaximum={20} segmentRows={segmentRows} />,
    );

    expect(screen.getByRole('group', { name: 'Transportation expense heatmap' })).toBeVisible();
    expect(container.querySelector('[data-heatmap-country="france"]')).toHaveClass('transportation-heatmap-country--data');
    expect(screen.getByTestId('heatmap-microstate-andorra')).toBeInTheDocument();
  });

  it('shows Country metadata with count, average, deviation, and rank', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TransportationHeatmap countries={countries} metric="total-cost" scaleMaximum={20} segmentRows={segmentRows} />,
    );

    await user.hover(container.querySelector('[data-heatmap-country="france"]')!);
    const details = screen.getByRole('region', { name: 'France heatmap details' });
    expect(details).toHaveTextContent('Segments2');
    expect(details).toHaveTextContent('€ 20.00 ± € 10.00');
    expect(details).toHaveTextContent('#1');
    expect(details.compareDocumentPosition(screen.getByRole('group', { name: 'Transportation expense heatmap' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('locks a Country on click and restores it after a temporary hover preview', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TransportationHeatmap countries={countries} metric="total-cost" scaleMaximum={20} segmentRows={segmentRows} />,
    );
    const france = screen.getByRole('button', { name: /France: € 20.00/ });
    const germany = screen.getByRole('button', { name: /Germany: € 10.00/ });

    await user.click(france);
    await user.unhover(france);
    expect(france).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'France heatmap details' })).toBeVisible();
    expect(container.querySelector('[data-heatmap-border-overlay="france"]')).toBeInTheDocument();

    await user.hover(germany);
    expect(screen.getByRole('region', { name: 'Germany heatmap details' })).toBeVisible();
    expect(france).toHaveAttribute('aria-pressed', 'true');

    await user.unhover(germany);
    expect(screen.getByRole('region', { name: 'France heatmap details' })).toBeVisible();
  });

  it('keeps a fixed viewport and leaves the wheel available for page scrolling', () => {
    render(<TransportationHeatmap countries={countries} metric="total-cost" scaleMaximum={20} segmentRows={segmentRows} />);
    const map = screen.getByRole('group', { name: 'Transportation expense heatmap' });

    expect(map).toHaveAttribute('viewBox', '0 0 1200 700');
    expect(fireEvent.wheel(map, { deltaY: -100, cancelable: true })).toBe(true);
    expect(fireEvent.wheel(map, { deltaY: 100, cancelable: true })).toBe(true);
    expect(screen.queryByRole('button', { name: 'Reset zoom' })).not.toBeInTheDocument();
    expect(map).toHaveAttribute('viewBox', '0 0 1200 700');
  });
});
