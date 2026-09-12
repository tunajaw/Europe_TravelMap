import { useState, type KeyboardEvent } from 'react';
import './expense-explorer.css';

type ExpenseView = 'transportation' | 'accommodation';

const VIEWS: ReadonlyArray<{ id: ExpenseView; label: string }> = [
  { id: 'transportation', label: 'Transportation' },
  { id: 'accommodation', label: 'Accommodation' },
];

export function ExpenseExplorer() {
  const [view, setView] = useState<ExpenseView>('transportation');
  const activeLabel = VIEWS.find(({ id }) => id === view)?.label ?? 'Transportation';

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % VIEWS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + VIEWS.length) % VIEWS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = VIEWS.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextView = VIEWS[nextIndex];
    if (!nextView) return;
    setView(nextView.id);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#${nextView.id}-expense-tab`)
      ?.focus();
  }

  return (
    <section className="expense-workspace" aria-labelledby="expense-heading">
      <p className="eyebrow">Travel costs</p>
      <h1 id="expense-heading">Expense overview</h1>

      <div className="expense-view-tabs" role="tablist" aria-label="Expense view">
        {VIEWS.map(({ id, label }, index) => (
          <button
            aria-controls={`${id}-expense-panel`}
            aria-selected={view === id}
            className="expense-view-tab"
            id={`${id}-expense-tab`}
            key={id}
            onClick={() => setView(id)}
            onKeyDown={(event) => handleTabKey(event, index)}
            role="tab"
            tabIndex={view === id ? 0 : -1}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <section
        aria-labelledby={`${view}-expense-tab`}
        className="expense-view-panel"
        id={`${view}-expense-panel`}
        role="tabpanel"
      >
        <h2>{activeLabel}</h2>
      </section>
    </section>
  );
}
