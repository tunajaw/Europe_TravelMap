// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';

vi.mock('../../src/data/travel-data-client.ts', () => ({
  loadTravelData: vi.fn(() => new Promise(() => {})),
}));

beforeEach(() => window.history.replaceState({}, '', '/'));
afterEach(cleanup);

describe('primary subpage navigation (FR-NAV-01)', () => {
  it('shows Travel Map as the default active subpage', () => {
    render(<App />);

    const navigation = screen.getByRole('navigation', { name: 'Primary' });
    expect(screen.getByRole('link', { name: 'Travel Map' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Expense' })).not.toHaveAttribute('aria-current');
    expect(navigation).toBeVisible();
  });

  it('switches subpages without reloading and writes the URL', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Expense' }));
    expect(screen.getByRole('link', { name: 'Expense' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('region', { name: 'Expense exploration' })).toBeVisible();
    expect(window.location.search).toBe('?view=expense');

    await user.click(screen.getByRole('link', { name: 'Travel Map' }));
    expect(screen.getByRole('link', { name: 'Travel Map' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('region', { name: 'Travel exploration' })).toBeVisible();
    expect(window.location.search).toBe('');
  });

  it('restores the subpage on browser history navigation', async () => {
    render(<App />);
    window.history.pushState({}, '', '/?view=expense');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => expect(screen.getByRole('link', { name: 'Expense' }))
      .toHaveAttribute('aria-current', 'page'));
    expect(screen.getByRole('region', { name: 'Expense exploration' })).toBeVisible();
  });
});
