import { useState } from 'react';
import type { TravelData } from '../../domain/travel-data.ts';
import { EuropeMap } from '../map/EuropeMap.tsx';
import { CountryPhoto } from '../map/CountryPhoto.tsx';
import { TRANSPORT_MODES } from '../map/transport-colors.ts';
import './design-comparison.css';

const concepts = [
  { id: 'cartographic', letter: 'A', name: 'Modern Cartographic', note: '冷白底 · 藍色重點 · 地圖優先', detail: '緊湊工具列、浮動卡片、右側 Dashboard；適合把地圖當作主要操作介面。' },
  { id: 'gallery', letter: 'B', name: 'Minimal Data Gallery', note: '中性灰白 · 黑色重點 · 照片優先', detail: '大字標題、寬幅照片、下方 Dashboard；更接近旅行作品集。' },
  { id: 'rose', letter: 'C', name: 'Soft White / Bold Pink', note: '粉白底 · 桃紅重點 · 參考圖方向', detail: '粗黑標題、圓角卡片、清楚的桃紅按鈕；照片與地圖各有呼吸空間。' },
] as const;

export function DesignComparison({ data }: { data: TravelData }) {
  const [focus, setFocus] = useState('all');
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = data.photos.filter((photo) => photo.countryId === 'italy')
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const photo = photos[photoIndex];
  const counts = TRANSPORT_MODES.map(([name, color]) => ({ name, color,
    count: data.segments.filter((segment) => segment.transportationCategory === name).length }));
  const maximum = Math.max(1, ...counts.map(({ count }) => count));

  return <main className="design-review">
    <header className="review-heading">
      <div><p>EUROPE TRAVEL MAP / DESIGN STUDY 01</p><h1>Same journey. Three directions.</h1>
        <p>相同地圖、Italy 照片與交通資料。先比較視覺方向，再挑選想保留的元素。</p></div>
      <a href={import.meta.env.BASE_URL}>返回目前版本 ↗</a>
    </header>
    <nav className="review-controls" aria-label="Mockup comparison">
      <button aria-pressed={focus === 'all'} onClick={() => setFocus('all')}>三版比較</button>
      {concepts.map((concept) => <button key={concept.id} aria-pressed={focus === concept.id}
        onClick={() => setFocus(concept.id)}>{concept.letter} · 單版放大</button>)}
    </nav>
    <div className={`review-grid ${focus !== 'all' ? 'review-grid--focus' : ''}`}>
      {concepts.filter((concept) => focus === 'all' || focus === concept.id).map((concept) =>
        <section className="review-concept" key={concept.id}>
          <header className="concept-caption"><span>{concept.letter}</span><div><h2>{concept.name}</h2><p>{concept.note}</p></div></header>
          <article className={`design-sample design-sample--${concept.id}`} aria-label={concept.name}>
            <header className="sample-nav"><strong><span className="sample-logo">↗</span> Europe, collected.</strong><span>TRAVEL JOURNAL / 2025–26</span></header>
            <div className="sample-intro"><p className="sample-kicker">SEVEN MONTHS OF DISCOVERY</p>
              <h2>Your places,<br />in perspective.</h2><p>A European exchange, one journey at a time.</p>
              <div className="sample-stats"><span><b>{data.countries.length}</b> countries</span><span><b>{data.trips.length}</b> trips</span><span><b>{data.segments.length}</b> segments</span></div>
            </div>
            <div className="sample-workspace">
              <section className="sample-map" aria-label="Europe overview">
                <div className="sample-map-heading"><strong>Europe overview</strong><span>● Visited countries</span></div>
                <EuropeMap countries={data.countries} />
                <aside className="sample-floating" aria-label="Italy country preview">
                  {photo && <CountryPhoto photo={photo} />}
                  <div className="sample-country-copy"><div><small>COUNTRY / 09</small><h3>Italy</h3></div>
                    <span className="sample-enter">Explore Italy ↗</span></div>
                  <div className="sample-photo-controls" aria-label="Italy photo selection">{photos.map((item, index) =>
                    <button key={item.id} aria-label={`Italy photo ${index + 1}`} aria-pressed={photoIndex === index}
                      onClick={() => setPhotoIndex(index)}>{String(index + 1).padStart(2, '0')}</button>)}</div>
                </aside>
              </section>
              <aside className="sample-dashboard" aria-label="Journey dashboard">
                <p className="sample-kicker">THE JOURNEY IN NUMBERS</p><h3>Dashboard</h3>
                <div className="sample-metric"><b>{data.segments.length}</b><span>transport segments</span></div>
                <h4>Transportation / segment count</h4>
                <div className="sample-bars">{counts.map(({ name, color, count }) =>
                  <div className="sample-bar-row" key={name}><div><span>{name}</span><strong>{count}</strong></div>
                    <div className="sample-bar-track"><span style={{ width: `${count / maximum * 100}%`, background: color }} /></div></div>)}</div>
                <div className="sample-dashboard-foot"><span>{data.accommodations.length} stays</span><span>{data.photos.length} photographs</span></div>
              </aside>
            </div>
            <footer className="sample-footer">30 SEP 2025 — 30 APR 2026 <span>PERSONAL TRAVEL ARCHIVE</span></footer>
          </article>
          <p className="concept-detail">{concept.detail}</p>
        </section>)}
    </div>
    <p className="review-disclaimer">視覺 mockup：照片切換與單版放大可操作；Explore Italy 是外觀示意。Dashboard 使用實際筆數，並非 Expense 功能實作。三版照片同步切換。</p>
  </main>;
}
