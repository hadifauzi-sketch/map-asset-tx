import { ArrowUpRight, Building2, ChevronRight, LocateFixed, MapPin, Server, X } from 'lucide-react';
import { dataCentreSource, dataCentreColor, formatDataCentreMw } from '../lib/dataCentres';
import './dataCentres.css';

function StatusBadge({ facility }) {
  return <span className="dc-info-status" style={{ '--status-color': dataCentreColor(facility) }}>
    <i aria-hidden="true" />{facility.status || 'Undisclosed'}
  </span>;
}

export function DataCentreHoverCard({ facility }) {
  return <div className="dc-preview">
    <header><span className="dc-preview-icon"><Server aria-hidden="true" /></span>
      <div><strong>{facility.name}</strong><span>{facility.source === 'seafic' ? `${facility.phases.length} phase records · SEAFIC` : facility.company}</span></div></header>
    <p className="dc-preview-place"><MapPin aria-hidden="true" />{[facility.city || facility.state, facility.country].filter(Boolean).join(' · ') || 'Location not recorded'}</p>
    <div className="dc-preview-facts"><div><span>{facility.source === 'seafic' ? 'Net capacity' : 'Reported capacity'}</span><strong>{formatDataCentreMw(facility.capacityMw)}</strong></div>
      <StatusBadge facility={facility} /></div>
    <footer>Click for facility details <ChevronRight aria-hidden="true" /></footer>
  </div>;
}

export default function DataCentreInfoCard({ facility, onClose }) {
  const source = dataCentreSource(facility);
  const isMalaysiaTracker = source.id === 'seafic';
  const geography = [['Country', facility.country], ['City', facility.city], ['State / region', facility.state], ['Postcode', facility.postcode]].filter(([, value]) => value);
  return <article className="dc-info" aria-label={`${facility.name} facility details`}>
    <header className="dc-info-header"><span className="dc-info-icon"><Server aria-hidden="true" /></span>
      <div className="dc-info-title"><span className="dc-info-eyebrow">{isMalaysiaTracker ? 'MALAYSIA CAMPUS PROFILE' : 'FACILITY PROFILE'}</span><h3>{facility.name}</h3>
        <p><Building2 aria-hidden="true" />{isMalaysiaTracker ? `${facility.phases.length} published phase records · SEAFIC` : facility.company || 'Operator not recorded'}</p></div>
      {onClose ? <button type="button" className="dc-info-close" onClick={onClose} aria-label="Close facility details"><X /></button> : null}
    </header>
    <div className="dc-info-summary"><div><span>{isMalaysiaTracker ? 'Net published capacity' : 'Reported capacity'}</span><strong className={facility.capacityMw == null ? 'is-undisclosed' : ''}>{formatDataCentreMw(facility.capacityMw)}</strong></div>
      <div><span>Reported status</span><StatusBadge facility={facility} /></div></div>
    <section className="dc-info-location"><h4><MapPin aria-hidden="true" />Location</h4><p className="dc-info-address">{facility.address || (isMalaysiaTracker ? `${facility.precision} · ${facility.state}` : 'Street address not provided')}</p>
      <dl className="dc-info-geography">{geography.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {facility.mapped ? <div className="dc-info-coordinates"><LocateFixed aria-hidden="true" /><div><span>Source coordinates</span>
        <strong>{facility.latitude.toFixed(5)}, {facility.longitude.toFixed(5)}</strong></div><span className="dc-info-precision">{facility.approximate ? 'Approximate' : 'Plot confirmed'}</span></div>
        : <div className="dc-info-unlocated"><LocateFixed aria-hidden="true" /><span>No coordinates supplied</span></div>}
      <p className="dc-info-note">{facility.mapped ? (isMalaysiaTracker
        ? `${facility.approximate ? 'Approximate park or street location' : 'Plot-confirmed location'} in the published tracker. Coordinates checked ${facility.locationChecked || 'date not supplied'}.`
        : 'Coordinates may represent a city or region. Exact building-level precision is not confirmed.')
        : 'This facility remains in the directory until source coordinates are available.'}</p>
      {facility.sourceCountry && facility.sourceCountry !== facility.country ? <p className="dc-info-note">Country as supplied: {facility.sourceCountry}</p> : null}
    </section>
    {isMalaysiaTracker ? <section className="dc-phase-section"><h4>Phase breakdown <span>{facility.phases.length} records</span></h4>
      <div className="dc-phase-scroll" tabIndex={0} role="region" aria-label="Published phase records"><table className="dc-phase-table"><thead><tr>
        <th scope="col">Record</th><th scope="col">Reported MW</th><th scope="col">Counted MW</th><th scope="col">Status / category</th><th scope="col">Basis / scope</th>
      </tr></thead><tbody>{facility.phases.map((phase) => <tr key={phase.record_id}><th scope="row">{phase.record_id}<small>{phase.phase || phase.mw_scope}</small></th>
        <td>{phase.mw == null ? 'Undisclosed' : phase.mw.toLocaleString('en-MY')}</td><td>{phase.mw_net.toLocaleString('en-MY')}</td>
        <td>{phase.status}<small>{phase.category}</small></td><td>{phase.mw_basis || 'Not recorded'}<small>{phase.mw_scope}</small></td>
      </tr>)}</tbody></table></div><p className="dc-info-note">Built or contracted MW, not electricity use. Campus build-out rows count only capacity beyond the listed phases.</p>
    </section> : null}
    <footer className="dc-info-footer"><span>{isMalaysiaTracker ? 'Malaysia tracker · CC BY 4.0' : 'Source record'}</span><a href={source.url} target="_blank" rel="noopener noreferrer">© {source.label} <ArrowUpRight aria-hidden="true" /></a></footer>
  </article>;
}
