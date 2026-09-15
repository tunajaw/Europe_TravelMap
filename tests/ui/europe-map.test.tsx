// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import travelDataSource from '../../public/data/travel-data.json';
import { EuropeMap } from '../../src/features/map/EuropeMap.tsx';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';

const travelData = TravelDataSchema.parse(travelDataSource);
afterEach(cleanup);

describe('FR-MAP-01 Europe Map', () => {
  it('previews a visited country anywhere on its boundary in Europe view only', () => {
    const onHover = vi.fn();
    const { container, rerender } = render(<EuropeMap countries={travelData.countries} onHover={onHover} />);
    const germany = container.querySelector('[data-boundary-country="germany"]')!;
    fireEvent.mouseEnter(germany);
    expect(onHover).toHaveBeenLastCalledWith('germany');
    fireEvent.mouseLeave(germany);
    expect(onHover).toHaveBeenLastCalledWith(null);
    rerender(<EuropeMap countries={travelData.countries} focusedId="germany" onHover={onHover} />);
    onHover.mockClear();
    fireEvent.mouseEnter(germany);
    expect(onHover).not.toHaveBeenCalled();
  });
  it('renders reviewed Country markers, labels, and visited boundaries', () => {
    const { container } = render(<EuropeMap countries={travelData.countries} />);

    expect(screen.getByRole('img', { name: 'Europe travel map' })).toBeInTheDocument();
    expect(screen.getAllByTestId('country-marker')).toHaveLength(20);
    expect(screen.getByText('Vatican City')).toBeInTheDocument();
    expect(container.querySelector('[data-boundary-country="germany"]')).toHaveClass('country-boundary--visited');
  });
});
