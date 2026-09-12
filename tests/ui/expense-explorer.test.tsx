// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ExpenseExplorer } from '../../src/features/expense/ExpenseExplorer.tsx';

afterEach(cleanup);

describe('FR-EXP-01 Expense page selection', () => {
  it('defaults to Transportation and switches between mutually exclusive views', async () => {
    const user = userEvent.setup();
    render(<ExpenseExplorer />);

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
    render(<ExpenseExplorer />);

    const transportation = screen.getByRole('tab', { name: 'Transportation' });
    const accommodation = screen.getByRole('tab', { name: 'Accommodation' });
    transportation.focus();
    await user.keyboard('{ArrowRight}');

    expect(accommodation).toHaveFocus();
    expect(accommodation).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Accommodation' })).toBeVisible();
  });
});
