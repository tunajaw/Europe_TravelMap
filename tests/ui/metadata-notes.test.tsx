// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MetadataNotes } from '../../src/features/expense/MetadataNotes.tsx';

afterEach(cleanup);

describe('Metadata Notes formatting', () => {
  it('shows a dash when Notes are not recorded', () => {
    render(<MetadataNotes notes={null} />);
    expect(screen.getByText('-')).toBeVisible();
  });

  it('renders slash-separated Notes as unordered-list items without literal stars', () => {
    render(<MetadataNotes notes="First note / Second note" />);
    expect(screen.getByRole('list')).toHaveClass('metadata-notes');
    expect(screen.getByText('First note')).toBeVisible();
    expect(screen.getByText('Second note')).toBeVisible();
    expect(screen.queryByText('* First note')).not.toBeInTheDocument();
  });
});
