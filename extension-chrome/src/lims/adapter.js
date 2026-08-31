// ─────────────────────────────────────────────────────────────────────────────
// ACTMS (actms.tnbr.com.my) adapter — the only LIMS-specific file.
//
// ACTMS is a classic ASP app that server-renders the Sample Result List as HTML
// tables, so there is no JSON API to call: the extension reads the page that is
// already open, in the tab where you are already signed in.
//
// Page: /ACTMS/Modules/Job/SampleResultList.asp
//         ?txtJobID=627431&txtSampleID=763943&txtSampleNo=AC-TXOIL-26-08458
// ─────────────────────────────────────────────────────────────────────────────

import { mapByAlias, resolveOilTestKey, resolveTransformerKey } from './fieldMap.js';
import { toText } from '../shared/canonical.js';

/**
 * Identify which ACTMS sample the open tab is showing.
 * Returns null when this is not a Sample Result List page.
 */
export function extractRecordRef(pageInfo) {
  let url;
  try {
    url = new URL(pageInfo.url);
  } catch {
    return null;
  }

  if (!/SampleResultList\.asp$/i.test(url.pathname)) {
    return null;
  }

  const sampleId = url.searchParams.get('txtSampleID');
  const sampleNo = url.searchParams.get('txtSampleNo');
  const jobId = url.searchParams.get('txtJobID');

  if (!sampleId && !sampleNo) {
    return null;
  }

  return { recordId: sampleNo || sampleId, sampleId, sampleNo, jobId };
}

/**
 * Runs INSIDE the ACTMS page via chrome.scripting.executeScript.
 *
 * It must be completely self-contained — injected functions are serialised, so
 * it cannot reference imports or anything from module scope. It therefore does
 * no interpretation at all: it lifts the raw label/value pairs and result rows,
 * and toCanonical() below does the mapping where the alias tables are available.
 */
export function scrapeActmsPage() {
  const clean = (node) =>
    (node?.textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

  // ── Header: "Serial No.  :  KM-49743" laid out as adjacent table cells ──
  const header = {};

  document.querySelectorAll('td, th').forEach((cell) => {
    const label = clean(cell).replace(/\s*:\s*$/, '');

    // Labels are short; anything longer is prose or a value cell.
    if (!label || label.length > 40 || label === ':') {
      return;
    }

    let node = cell.nextElementSibling;
    let hops = 0;

    while (node && hops < 3) {
      const text = clean(node).replace(/^:\s*/, '');
      if (text) {
        if (!(label in header)) {
          header[label] = text;
        }
        return;
      }
      node = node.nextElementSibling;
      hops += 1;
    }
  });

  // ── Result tables: every block with a "Test | Result | Flag | Reference" head ──
  const sections = [];

  document.querySelectorAll('table').forEach((table) => {
    const rows = Array.from(table.rows);
    const headerIndex = rows.findIndex((row) => {
      const cells = Array.from(row.cells).map((cell) => clean(cell).toLowerCase());
      return cells.includes('test') && cells.includes('result');
    });

    if (headerIndex === -1) {
      return;
    }

    const headerCells = Array.from(rows[headerIndex].cells).map((cell) => clean(cell).toLowerCase());
    const testColumn = headerCells.indexOf('test');
    const resultColumn = headerCells.indexOf('result');
    const items = [];

    rows.slice(headerIndex + 1).forEach((row) => {
      const cells = Array.from(row.cells);
      const test = clean(cells[testColumn]);
      const result = clean(cells[resultColumn]);

      if (test && result) {
        items.push({ test, result });
      }
    });

    if (items.length) {
      sections.push({ rows: items });
    }
  });

  return { header, sections, url: window.location.href };
}

/**
 * Map the scraped page onto the app's canonical shape.
 * Values stay as raw strings — ../shared/canonical.js coerces them.
 */
export function toCanonical(raw, ref = {}) {
  const header = raw?.header || {};
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];

  const { mapped: transformer, unmapped: unmappedHeader } = mapByAlias(
    header,
    resolveTransformerKey
  );

  // Every result section flattened into one analyte bag; first reading wins.
  const analytes = {};
  sections.forEach((section) => {
    section.rows.forEach(({ test, result }) => {
      if (!(test in analytes)) {
        analytes[test] = result;
      }
    });
  });

  const { mapped: oilTest, unmapped: unmappedRows } = mapByAlias(analytes, resolveOilTestKey);

  // Matches lib/dga-import/pdfImport.js, which uses `samplingDate || testDate`.
  // Getting this wrong would file the same report under a second date and
  // duplicate the row rather than updating it.
  const testDate = toText(header['Sampling Date']) || toText(header['Test Date']);

  const provenance = [
    ref.sampleNo ? `ACTMS sample ${ref.sampleNo}` : null,
    toText(header['Job No.']) ? `Job ${toText(header['Job No.'])}` : null,
    toText(header['Certificate No.']) ? `Cert ${toText(header['Certificate No.'])}` : null,
    toText(header['Sampling Point']) ? `Point: ${toText(header['Sampling Point'])}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    transformer,
    oilTests: [
      {
        ...oilTest,
        testDate,
        // ACTMS does not label the test type on this page; every TXOIL sample
        // here is an in-service sample, and the value is editable on review.
        testType: oilTest.testType || 'Routine',
        notes: [oilTest.notes, provenance].filter(Boolean).join(' — '),
      },
    ],
    // Passed through so the app can infer the state with its own
    // inferMalaysianStateFromText(); the extension has no Malaysia knowledge.
    address: toText(header.Address),
    diagnostics: {
      unmappedTransformerFields: Object.keys(unmappedHeader),
      unmappedResultLabels: Object.keys(unmappedRows),
    },
  };
}
