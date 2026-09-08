// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import travelDataSource from '../../public/data/travel-data.json';
import { EuropeMap } from '../../src/features/map/EuropeMap.tsx';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';

const travelData = TravelDataSchema.parse(travelDataSource);

describe('FR-MAP-01 Europe Map', () => {
  it('renders reviewed Country markers, labels, and visited boundaries', () => {
    const { container } = render(<EuropeMap countries={travelData.countries} />);

    expect(screen.getByRole('img', { name: 'Europe travel map' })).toBeInTheDocument();
    expect(screen.getAllByTestId('country-marker')).toHaveLength(20);
    expect(screen.getByText('Vatican City')).toBeInTheDocument();
    expect(container.querySelector('[data-boundary-country="germany"]')).toHaveClass('country-boundary--visited');
  });
});
