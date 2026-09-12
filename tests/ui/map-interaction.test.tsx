// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import source from '../../public/data/travel-data.json';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';
import { CountryExplorer } from '../../src/features/map/CountryExplorer.tsx';
import { SegmentDetails } from '../../src/features/map/SegmentDetails.tsx';

const data = TravelDataSchema.parse(source);
beforeEach(() => window.history.replaceState(null, '', '/Europe_TravelMap/'));
afterEach(cleanup);
describe('FR-MAP-07 through FR-MAP-09', () => {
  it.each(['europe', 'country'])('links Skopje transit and emphasizes every waypoint in %s view', async (level) => {
    window.history.replaceState(null, '', level === 'country' ? '#country/north-macedonia' : '#europe');
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    const segment = data.segments.find((s) => s.transitCityIds.includes('city-skopje'))!;
    expect(segment).toBeDefined();
    const marker = screen.getByRole('button', { name: level === 'country' ? 'Skopje' : 'Select North Macedonia' });
    await user.hover(marker);
    const route = container.querySelector(`[data-segment-id="${segment.id}"]`)!;
    expect(route).toHaveClass('segment-route--highlighted');
    await user.unhover(marker);
    await user.hover(route);
    for (const cityId of segment.pathCityIds) {
      const countryId = data.cities.find((city) => city.id === cityId)!.countryId;
      expect(container.querySelector(level === 'country' ? `[data-city-id="${cityId}"]` : `[data-country-id="${countryId}"]`)).toHaveClass('marker--route-emphasis');
    }
    await user.unhover(route);
    await waitFor(() => expect(container.querySelectorAll('.marker--route-emphasis')).toHaveLength(0));
    await user.click(marker);
    await user.unhover(marker);
    expect(container.querySelector(`[data-segment-id="${segment.id}"]`)).toHaveClass('segment-route--highlighted');
  });
  it('renders zero fares and missing optional metadata without inventing values', () => {
    render(<SegmentDetails segment={{ ...data.segments[0]!, baseCostEur: 0, notes: null, company: null }} cities={data.cities} onClose={() => {}} />);
    expect(screen.getByText('EUR 0.00')).toBeInTheDocument();
    expect(screen.getByText('No notes recorded')).toBeInTheDocument();
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    expect(screen.getByText('Segment fare (excluding transfers)')).toBeInTheDocument();
  });

  it('switches individual route details on focus, clears transient hover, and removes hidden metadata', async () => {
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    const visible = data.segments.filter((s) => s.originCountryId !== s.destinationCountryId);
    const first = container.querySelector(`[data-segment-id="${visible[0]!.id}"]`)!;
    await user.hover(first);
    expect(screen.getByRole('region', { name: 'Segment details' })).toHaveTextContent(visible[0]!.id);
    await user.unhover(first);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Segment details' })).not.toBeInTheDocument());
    const second = container.querySelector<SVGGElement>(`[data-segment-id="${visible[1]!.id}"]`)!;
    second.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('region', { name: 'Segment details' })).toHaveTextContent(visible[1]!.id);
    await user.click(screen.getByRole('checkbox', { name: 'Show travel routes' }));
    expect(screen.queryByRole('region', { name: 'Segment details' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('.country-marker--linked')).toHaveLength(0);
  });
  it('links opposite country endpoints on hover and retains highlights when selected', async () => {
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    const germany = screen.getByRole('button', { name: 'Select Germany' });
    const related = data.segments.filter((s) => s.originCountryId !== s.destinationCountryId && [s.originCountryId, s.destinationCountryId].includes('germany'));
    await user.hover(germany);
    for (const segment of related) {
      const opposite = segment.originCountryId === 'germany' ? segment.destinationCountryId : segment.originCountryId;
      expect(container.querySelector(`[data-country-id="${opposite}"]`)).toHaveClass('country-marker--linked');
      expect(container.querySelector(`[data-segment-id="${segment.id}"]`)).toHaveClass('segment-route--highlighted');
    }
    await user.unhover(germany);
    expect(container.querySelectorAll('.segment-route--highlighted')).toHaveLength(0);
    await user.click(germany);
    await user.unhover(germany);
    expect(container.querySelectorAll('.segment-route--highlighted')).toHaveLength(related.length);
    await user.click(screen.getByRole('button', { name: 'Select Vatican City' }));
    await user.unhover(screen.getByRole('button', { name: 'Select Vatican City' }));
    expect(container.querySelectorAll('.segment-route--highlighted')).toHaveLength(0);
  });

  it('shows exact individual route metadata, pins on click, and dismisses without unlocking its country', async () => {
    window.history.replaceState(null, '', '#europe/germany');
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    const segment = data.segments.find((s) => s.originCountryId !== s.destinationCountryId && s.notes)!;
    const route = container.querySelector(`[data-segment-id="${segment.id}"]`)!;
    await user.hover(route);
    const details = screen.getByRole('region', { name: 'Segment details' });
    expect(within(details).getByText(segment.date)).toBeInTheDocument();
    expect(within(details).getByText(segment.transportationSubtype)).toBeInTheDocument();
    expect(within(details).getByText(segment.transportationCategory)).toBeInTheDocument();
    expect(within(details).getByText(segment.notes!)).toBeInTheDocument();
    expect(within(details).getByText(`EUR ${segment.baseCostEur.toFixed(2)}`)).toBeInTheDocument();
    await user.click(route);
    await user.unhover(route);
    expect(screen.getByRole('region', { name: 'Segment details' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Segment details' })).not.toBeInTheDocument());
    expect(window.location.hash).toBe('#europe/germany');
  });

  it('locks a city with keyboard interaction, retains its routes, and clears on filtering', async () => {
    window.history.replaceState(null, '', '#country/germany');
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    const munich = screen.getByRole('button', { name: 'Munich' });
    munich.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('region', { name: 'Selected city' })).toHaveTextContent('Munich');
    expect(munich).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelectorAll('.segment-route--highlighted').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.city-marker--linked').length).toBeGreaterThan(0);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Selected city' })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#country/germany');
    await user.click(munich);
    await user.click(screen.getByRole('checkbox', { name: 'Only show domestic routes' }));
    expect(screen.queryByRole('region', { name: 'Selected city' })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#country/germany');
  });
});
