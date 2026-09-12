import { useState } from 'react';
import sources from '../../../public/images/companies/sources.json';

// Keep original company text unchanged; normalize only this presentation lookup.
export function CompanyIcon({ company, category }: { company: string | null; category: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (category === 'City Bus' || !company) return null;
  const source = (sources as Record<string, { path: string }>)[company.trim().toLowerCase()];
  if (!source || failedSource === source.path) return null;
  return <img className="company-icon" src={`${import.meta.env.BASE_URL}${source.path}`} alt={`${company} icon`}
    width="24" height="24" onError={() => setFailedSource(source.path)} />;
}
