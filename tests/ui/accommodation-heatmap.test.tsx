// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { TravelData } from '../../src/domain/travel-data.ts';
import { AccommodationHeatmap } from '../../src/features/expense/AccommodationHeatmap.tsx';

afterEach(cleanup);

describe('Accommodation heatmap (FR-EXP-14 and FR-EXP-15)', () => {
  it('renders weighted nights metadata and supports Country locking', async () => {
    const user = userEvent.setup();
    const countries = [{ id: 'france', name: 'France', boundaryId: '250', isMicrostate: false,
      marker: { longitude: 2.35, latitude: 48.86 } }] as TravelData['countries'];
    const { container } = render(<AccommodationHeatmap countries={countries} metric="nightly-price" scaleMaximum={60}
      data={[{ countryId: 'france', nights: 3, average: 40, standardDeviation: 14.14, rank: 1 }]} />);
    const france = screen.getByRole('button', { name: /France: EUR 40.00 \/ night/ });

    await user.click(france);
    await user.unhover(france);
    const details = screen.getByRole('region', { name: 'France heatmap details' });
    expect(details).toHaveTextContent('Nights3');
    expect(details).toHaveTextContent('EUR 40.00 / night ± EUR 14.14 / night');
    expect(details).toHaveTextContent('#1');
    expect(container.querySelector('[data-heatmap-border-overlay="france"]')).toBeInTheDocument();
  });

  it('colors a microstate marker from its filtered Accommodation expense', () => {
    const countries = [{ id: 'andorra', name: 'Andorra', boundaryId: '020', isMicrostate: true,
      marker: { longitude: 1.52, latitude: 42.51 } }] as TravelData['countries'];
    const { rerender } = render(<AccommodationHeatmap countries={countries} metric="nightly-price" scaleMaximum={60}
      data={[{ countryId: 'andorra', nights: 2, average: 10, standardDeviation: 0, rank: 1 }]} />);
    const marker = screen.getByTestId('heatmap-microstate-andorra');
    const lowExpenseColor = marker.style.fill;

    expect(lowExpenseColor).not.toBe('');
    fireEvent.click(marker);
    expect(marker.style.fill).toBe(lowExpenseColor);

    rerender(<AccommodationHeatmap countries={countries} metric="nightly-price" scaleMaximum={60}
      data={[{ countryId: 'andorra', nights: 2, average: 50, standardDeviation: 0, rank: 1 }]} />);

    expect(marker.style.fill).not.toBe(lowExpenseColor);
  });
});
