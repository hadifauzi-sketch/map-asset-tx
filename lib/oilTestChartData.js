// Shared oil-test -> chart-row mapper.
//
// Extracted from components/DataTrending.jsx so the Trending tab and the
// Maintenance tab plot the same numbers from the same code. Two mappers would
// eventually disagree, and a maintenance chart that contradicts the trending
// chart is worse than no maintenance chart.

/**
 * @param {Array} oilTests camelCase records from oilTestService
 * @returns {Array} rows in ascending date order, each carrying both the
 *   localised `date` used as the chart's category and the sortable `isoDate`
 *   used to anchor maintenance events.
 */
export function mapOilTestsToChartData(oilTests) {
  if (!oilTests || oilTests.length === 0) return [];

  // Sort by date ascending (oldest first for trending)
  const sorted = [...oilTests].sort((a, b) => new Date(a.testDate) - new Date(b.testDate));

  return sorted.map((test) => {
    const d = new Date(test.testDate);
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return {
      date,
      isoDate: Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10),
      H2: parseFloat(test.h2) || 0,
      CH4: parseFloat(test.ch4) || 0,
      C2H2: parseFloat(test.c2h2) || 0,
      C2H4: parseFloat(test.c2h4) || 0,
      C2H6: parseFloat(test.c2h6) || 0,
      CO: parseFloat(test.co) || 0,
      CO2: parseFloat(test.co2) || 0,
      O2: parseFloat(test.o2) || 0,
      N2: parseFloat(test.n2) || 0,
      TDCG: parseFloat(test.tdcg) || 0,
      BDV: parseFloat(test.breakdown) || 0,
      Moisture: parseFloat(test.waterContent) || 0,
      Acidity: parseFloat(test.acidity) || 0,
      IFT: parseFloat(test.interfacialTension) || 0,
      TanDelta: parseFloat(test.powerFactor) || 0,
      Inhibitor:
        test.inhibitor !== null && test.inhibitor !== undefined && test.inhibitor !== ''
          ? parseFloat(test.inhibitor)
          : null,
      Color: test.color || '',
      ColorValue: test.color ? parseFloat(String(test.color).replace(/[^\d.-]/g, '')) || 0 : 0,
      DBDS: parseFloat(test.dbds) || 0,
      CopperCorr:
        test.copperCorrosive &&
        String(test.copperCorrosive).toLowerCase() !== 'no' &&
        String(test.copperCorrosive) !== '0'
          ? 1
          : 0,
      Passivator: parseFloat(test.passivator) || 0,
      Furan: parseFloat(test.fal2) || 0,
      Methanol: parseFloat(test.methanol) || 0,
      Ethanol: parseFloat(test.ethanol) || 0,
      DPFuran: test.estimatedDpFuran ? parseFloat(test.estimatedDpFuran) : null,
      DPMethanol: test.estimatedDpMethanol ? parseFloat(test.estimatedDpMethanol) : null,
    };
  });
}
