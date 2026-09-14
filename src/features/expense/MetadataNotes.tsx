export function MetadataNotes({ notes }: { notes: string | null | undefined }) {
  const lines = notes?.split('/').map((line) => line.trim()).filter(Boolean) ?? [];

  if (!lines.length) return <span className="metadata-notes-empty">-</span>;

  return <ul className="metadata-notes">
    {lines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
  </ul>;
}
