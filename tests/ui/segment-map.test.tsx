// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import source from '../../public/data/travel-data.json';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';
import { CountryExplorer } from '../../src/features/map/CountryExplorer.tsx';

const data = TravelDataSchema.parse(source);
const europeSegments = data.segments.filter((segment) => segment.originCountryId !== segment.destinationCountryId);
beforeEach(() => window.history.replaceState(null, '', '/Europe_TravelMap/'));
afterEach(cleanup);

describe('FR-MAP-05/06 Segment map', () => {
  it('filters domestic routes in Country Map without changing statistics and restores cross-border routes', async () => {
    window.history.replaceState(null, '', '#country/germany');
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    const toggle = screen.getByRole('checkbox', { name: 'Only show domestic routes' });
    expect(toggle).not.toBeChecked();
    const total = container.querySelector('.dashboard-total')!.textContent;
    const allCount = screen.getAllByTestId('segment-path').length;
    await user.click(toggle);
    const expected = data.segments.filter((segment) => segment.originCountryId === 'germany' && segment.destinationCountryId === 'germany');
    expect([...container.querySelectorAll('[data-segment-id]')].map((node) => node.getAttribute('data-segment-id'))).toEqual(expected.map((segment) => segment.id));
    expect(container.querySelector('.dashboard-total')!.textContent).toBe(total);
    expect(screen.getAllByTestId('city-marker')).toHaveLength(data.cities.filter((city) => city.countryId === 'germany').length);
    await user.click(toggle);
    expect(screen.getAllByTestId('segment-path')).toHaveLength(allCount);
    await user.click(screen.getByRole('button', { name: 'Back to Europe' }));
    expect(screen.queryByRole('checkbox', { name: 'Only show domestic routes' })).not.toBeInTheDocument();
    expect(screen.getAllByTestId('segment-path')).toHaveLength(europeSegments.length);
  });
  it('shows all routes by default and preserves the visibility toggle across navigation', async () => {
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    const toggle = screen.getByRole('checkbox', { name: 'Show travel routes' });
    expect(toggle).toBeChecked();
    expect(screen.getAllByTestId('segment-path')).toHaveLength(europeSegments.length);
    await user.click(toggle);
    expect(screen.queryAllByTestId('segment-path')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Select Germany' }));
    await user.click(screen.getByRole('button', { name: 'Enter Germany' }));
    expect(toggle).not.toBeChecked();
    expect(screen.queryAllByTestId('segment-path')).toHaveLength(0);
    await user.click(toggle);
    expect(screen.getByRole('group', { name: 'Germany country map' })).toBeInTheDocument();
    expect(screen.getAllByTestId('segment-path').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Back to Europe' }));
    expect(screen.getAllByTestId('segment-path')).toHaveLength(europeSegments.length);
  });

  it('fans out a route bundle on hover, pins it on click, and clears it on Escape', async () => {
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    const segments = screen.getAllByTestId('segment-path');
    const repeated = segments.find((element) => segments.filter((other) => other.getAttribute('data-route-group') === element.getAttribute('data-route-group')).length > 1)!;
    const collapsed = repeated.getAttribute('d');
    await user.hover(repeated);
    expect(container.querySelectorAll('.segment-route--expanded').length).toBeGreaterThan(1);
    await user.click(repeated);
    await user.unhover(repeated);
    expect(container.querySelectorAll('.segment-route--expanded').length).toBeGreaterThan(1);
    await user.keyboard('{Escape}');
    expect(container.querySelectorAll('.segment-route--expanded')).toHaveLength(0);
    expect(repeated).toHaveAttribute('d', collapsed);
  });
});
