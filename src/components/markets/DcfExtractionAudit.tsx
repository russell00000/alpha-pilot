interface Value { value: number; tag: string; fiscal_year: number | null; period: { end: string }; filed: string | null; accession_number: string | null }
interface TagAudit { tag: string; raw_end_dates: string[]; status: string; selected: Value | null; annual_candidates: Value[] }
export interface ExtractionAudit {
  annual_period: { end: string; fiscal_year: number; filed: string; accession_number: string } | null;
  selection_rule: string;
  total_debt: { selected: Value | null; tags: TagAudit[] };
  ppe: { selected: Value | null; tags: TagAudit[] };
  current_financing: { selected: Value | null; tags: TagAudit[] };
  noncurrent_financing: { selected: Value | null; tags: TagAudit[] };
}
const dollars = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
export default function DcfExtractionAudit({ audit }: { audit: ExtractionAudit }) {
  const sections = [["Total debt", audit.total_debt], ["PP&E", audit.ppe], ["Current financing", audit.current_financing], ["Noncurrent financing", audit.noncurrent_financing]] as const;
  return <div aria-label="SEC extraction audit" className="mt-5 border-t border-border pt-4">
    <h3 className="text-sm font-medium text-foreground">Audited opening balances</h3>
    {audit.annual_period && <p className="mt-2 break-words text-xs text-muted-foreground">FY{audit.annual_period.fiscal_year} · period end {audit.annual_period.end} · filed {audit.annual_period.filed} · {audit.annual_period.accession_number}</p>}
    <p className="mt-2 text-xs text-muted-foreground">{audit.selection_rule}</p>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr>{["Balance", "Selected value", "Reported tag / period"].map(h => <th key={h} className="border-b border-border px-3 py-2 font-medium text-muted-foreground">{h}</th>)}</tr></thead>
      <tbody>{sections.map(([name, field]) => <tr key={name}>
        <td className="border-b border-border px-3 py-2">{name}</td>
        <td className="whitespace-nowrap border-b border-border px-3 py-2 font-mono">{field.selected ? dollars(field.selected.value) : "Unavailable — no guessed value"}</td>
        <td className="min-w-48 break-words border-b border-border px-3 py-2 text-muted-foreground">{field.selected ? `${field.selected.tag} · ${field.selected.period.end} · filed ${field.selected.filed}` : "No aligned annual observation"}</td>
      </tr>)}</tbody>
    </table></div>
    {sections.map(([name, field]) => <details key={name} className="mt-3 border-b border-border pb-3">
      <summary className="cursor-pointer text-xs font-medium text-foreground">{name} — attempted tags &amp; raw dates</summary>
      <div className="mt-3 space-y-4">{field.tags.map(tag => <div key={tag.tag} className="min-w-0 text-xs">
        <p className="break-all font-mono text-foreground">{tag.tag}</p>
        <p className="mt-1 text-muted-foreground">{tag.status}</p>
        <p className="mt-1 break-words font-mono text-muted-foreground">Raw end dates (SEC array order): {JSON.stringify(tag.raw_end_dates)}</p>
        <p className="mt-1 break-words text-muted-foreground">Annual candidates: {tag.annual_candidates.length ? tag.annual_candidates.map(v => `${v.period.end}: ${dollars(v.value)} (${v.filed}; ${v.accession_number})`).join(" · ") : "None"}</p>
      </div>)}</div>
    </details>)}
  </div>;
}