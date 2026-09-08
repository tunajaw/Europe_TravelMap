import { useEffect, useState } from 'react';
import type { TravelData } from './domain/travel-data.ts';
import { loadTravelData } from './data/travel-data-client.ts';
import { CountryExplorer } from './features/map/CountryExplorer.tsx';
import './styles/app.css';
import { DesignComparison } from './features/design/DesignComparison.tsx';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: TravelData }
  | { status: 'error'; message: string };

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    loadTravelData(import.meta.env.BASE_URL)
      .then((data) => active && setState({ status: 'ready', data }))
      .catch((error: unknown) => active && setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown data error',
      }));
    return () => { active = false; };
  }, []);

  if (new URLSearchParams(window.location.search).get('view') === 'mockups') {
    return state.status === 'ready'
      ? <DesignComparison data={state.data} />
      : <p className="status-message">{state.status === 'error' ? state.message : 'Loading design previews…'}</p>;
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark" aria-hidden="true">ET</span>
          <span>Europe Travel Map</span>
        </a>
        <p className="travel-period">30 Sep 2025 — 30 Apr 2026</p>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Exchange travel journal</p>
          <h1>Your places,<br />in perspective.</h1>
          <p className="intro">
            A visual record of the cities, crossings, and small discoveries that shaped one European exchange.
          </p>
        </div>
        {state.status === 'ready' && (
          <dl className="journey-stats" aria-label="Journey summary">
            <div><dt>Countries</dt><dd>{state.data.countries.length}</dd></div>
            <div><dt>Segments</dt><dd>{state.data.segments.length}</dd></div>
            <div><dt>Days</dt><dd>213</dd></div>
          </dl>
        )}
      </section>

      <section aria-label="Travel exploration">
        {state.status === 'loading' && <p className="status-message">Loading the journey…</p>}
        {state.status === 'error' && <p className="status-message status-message--error">{state.message}</p>}
        {state.status === 'ready' && <CountryExplorer data={state.data} />}
      </section>
    </main>
  );
}
