// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { CompanyIcon } from '../../src/features/map/CompanyIcon.tsx';
import sources from '../../public/images/companies/sources.json';
afterEach(cleanup);
it('shows a local InterCity Bus icon but excludes only City Bus', () => {
  const { rerender } = render(<CompanyIcon company="Flixbus" category="InterCity Bus" />);
  expect(screen.getByRole('img')).toHaveAttribute('src', `${import.meta.env.BASE_URL}images/companies/flixbus.png`);
  rerender(<CompanyIcon company="Flixbus" category="City Bus" />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('normalizes company spelling case and safely handles missing or failed images', () => {
  const { rerender } = render(<CompanyIcon company=" EasyJet " category="Plane" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  rerender(<CompanyIcon company="Unknown" category="Plane" />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  rerender(<CompanyIcon company={null} category="Train" />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('ships all referenced company icons locally with source attribution', () => {
  for (const source of Object.values(sources)) {
    expect(existsSync(`public/${source.path}`)).toBe(true);
    expect(source.source).toMatch(/^https:\/\//);
  }
});
