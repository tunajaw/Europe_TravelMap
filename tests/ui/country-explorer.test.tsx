// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import source from '../../public/data/travel-data.json';
import { TravelDataSchema } from '../../src/domain/travel-data.ts';
import { CountryExplorer } from '../../src/features/map/CountryExplorer.tsx';
import { EUROPE_VIEWPORT } from '../../src/features/map/country-viewport.ts';

const data = TravelDataSchema.parse(source);
beforeEach(() => window.history.replaceState(null, '', '/Europe_TravelMap/'));
afterEach(cleanup);

describe('FR-MAP-02 Country selection', () => {
  it('keeps the photo card open when a boundary arrow disappears after clicking it', async () => {
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    await user.click(screen.getByRole('button', { name: 'Select Italy' }));
    await user.click(screen.getByRole('button', { name: 'Photo 2' }));
    // A transient control models the disappearing event target without
    // externally removing a node owned by React.
    const transient = document.createElement('button');
    transient.textContent = 'Transient photo control';
    screen.getByRole('region', { name: 'Italy preview' }).append(transient);
    transient.addEventListener('click', () => transient.remove(), { once: true });
    await user.click(transient);
    expect(screen.getByRole('region', { name: 'Italy preview' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('region', { name: 'Italy preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Photo 3' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Photo 2' }));
    await user.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(screen.getByRole('region', { name: 'Italy preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Photo 1' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('draws selected borders above every base country and below markers', async () => {
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    await user.click(screen.getByRole('button', { name: 'Select Germany' }));
    const base = container.querySelector('[aria-label="Country boundaries"]')!;
    const overlay = container.querySelector('[aria-label="Highlighted country borders"]')!;
    expect(base.compareDocumentPosition(overlay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overlay.querySelector('path')).toHaveAttribute('d', container.querySelector('[data-boundary-country="germany"]')!.getAttribute('d'));
  });

  it('shows only valid photo arrows and corrects the reviewed inverted images', async () => {
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    await user.click(screen.getByRole('button', { name: 'Select Germany' }));
    const card = screen.getByRole('region', { name: 'Germany preview' });
    expect(within(card).getByRole('img')).toHaveStyle({ transform: 'rotate(180deg)' });
    expect(within(card).queryByRole('button', { name: 'Previous photo' })).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Next photo' }));
    expect(within(card).getByRole('img')).toHaveAttribute('src', expect.stringContaining('berlin-brandenburg-gate.webp'));
    expect(within(card).getByRole('img')).not.toHaveStyle({ transform: 'rotate(180deg)' });
    await user.click(within(card).getByRole('button', { name: 'Next photo' }));
    expect(within(card).queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Previous photo' }));
    expect(within(card).getByRole('button', { name: 'Photo 2' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Select Lithuania' }));
    const lithuania = screen.getByRole('region', { name: 'Lithuania preview' });
    expect(within(lithuania).getByRole('img')).toHaveStyle({ transform: 'rotate(180deg)' });
    await user.click(within(lithuania).getByRole('button', { name: 'Next photo' }));
    expect(within(lithuania).getByRole('img')).toHaveStyle({ transform: 'rotate(180deg)' });
  });

  it('highlights on hover and restores on leave without opening a card', async () => {
    const user = userEvent.setup();
    const { container } = render(<CountryExplorer data={data} />);
    const marker = screen.getByRole('button', { name: 'Select Italy' });
    await user.hover(marker);
    expect(container.querySelector('[data-boundary-country="italy"]')).toHaveClass('country-boundary--active');
    expect(screen.queryByRole('region', { name: 'Italy preview' })).not.toBeInTheDocument();
    await user.unhover(marker);
    expect(container.querySelector('[data-boundary-country="italy"]')).not.toHaveClass('country-boundary--active');
  });

  it('locks, switches countries, resets photos and dismisses outside the card', async () => {
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    await user.click(screen.getByRole('button', { name: 'Select Italy' }));
    expect(screen.getByRole('button', { name: 'Select Italy' })).toHaveAttribute('aria-pressed', 'true');
    const card = screen.getByRole('region', { name: 'Italy preview' });
    expect(within(card).getByRole('img')).toHaveAttribute('src', expect.stringContaining('rome-colosseum.webp'));
    await user.click(within(card).getByRole('button', { name: 'Photo 2' }));
    expect(within(card).getByRole('img')).toHaveAttribute('src', expect.stringContaining('pompeii-ruins.webp'));
    await user.click(screen.getByRole('button', { name: 'Select France' }));
    expect(screen.queryByRole('region', { name: 'Italy preview' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'France preview' })).getByRole('button', { name: 'Photo 1' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('group', { name: 'Europe travel map' }));
    expect(screen.queryByRole('region', { name: 'France preview' })).not.toBeInTheDocument();
  });

  it('enters a Country Map, persists its URL and returns on Escape', async () => {
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    const marker = screen.getByRole('button', { name: 'Select Italy' });
    marker.focus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Enter Italy' }));
    const map = screen.getByRole('group', { name: 'Italy country map' });
    expect(map).not.toHaveAttribute('viewBox', EUROPE_VIEWPORT.join(' '));
    expect(window.location.hash).toBe('#country/italy');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('group', { name: 'Europe travel map' })).toHaveAttribute('viewBox', EUROPE_VIEWPORT.join(' '));
    expect(screen.queryByRole('region', { name: 'Italy preview' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Italy' })).toHaveFocus();
  });

  it('supports Vatican City without segments, including direct links and hash navigation', async () => {
    window.history.replaceState(null, '', '#country/vatican-city');
    const user = userEvent.setup();
    render(<CountryExplorer data={data} />);
    expect(screen.getByRole('group', { name: 'Vatican City country map' })).toBeInTheDocument();
    expect(screen.getByText('No transportation data')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Vatican City preview' })).getByRole('img')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Europe' }));
    expect(screen.getByRole('group', { name: 'Europe travel map' })).toBeInTheDocument();
    window.history.replaceState(null, '', '#country/france');
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(screen.getByRole('group', { name: 'France country map' })).toBeInTheDocument();
    window.history.replaceState(null, '', '#country/unknown');
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(screen.getByRole('group', { name: 'Europe travel map' })).toBeInTheDocument();
  });
});
