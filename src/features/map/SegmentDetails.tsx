import type { TravelData } from '../../domain/travel-data.ts';
import { CompanyIcon } from './CompanyIcon.tsx';

export function SegmentDetails({ segment, cities, onClose }: {
  segment: TravelData['segments'][number]; cities: TravelData['cities']; onClose: () => void;
}) {
  const name = (id: string) => cities.find((city) => city.id === id)?.name ?? id;
  return <section className="segment-details" aria-label="Segment details">
    <header><div><p className="eyebrow">Segment / {segment.id}</p>
      <h3>{name(segment.originCityId)} → {name(segment.destinationCityId)}</h3></div>
      <button type="button" onClick={onClose} aria-label="Close segment details">Close</button></header>
    <dl>
      <div><dt>Date</dt><dd>{segment.date}</dd></div>
      <div><dt>Segment fare (excluding transfers)</dt><dd>EUR {segment.baseCostEur.toFixed(2)}</dd></div>
      <div><dt>Original transport type</dt><dd>{segment.transportationSubtype}</dd></div>
      <div><dt>Analysis category</dt><dd>{segment.transportationCategory}</dd></div>
      <div><dt>Company</dt><dd className="segment-company">{segment.company ?? 'Not recorded'}<CompanyIcon company={segment.company} category={segment.transportationCategory} /></dd></div>
      {segment.transitCityIds.length > 0 && <div><dt>Via (travel order)</dt><dd>{segment.transitCityIds.map(name).join(' → ')}</dd></div>}
      <div className="segment-notes"><dt>Notes</dt><dd>{segment.notes ?? 'No notes recorded'}</dd></div>
    </dl>
  </section>;
}
