import { compareMalaysianStates, getTransformerState } from './malaysiaStates';
import { ASSET_OWNER_TYPES, normalizeAssetOwnerType } from './assetOwner';

/**
 * Grouping logic behind the Asset Access tree (State → Site → Transformer).
 *
 * Kept free of React so the branch maths can be exercised directly in tests.
 */

export const UNASSIGNED_SITE = 'Unassigned site';

/** Groups transformers into state → site → asset nodes, each carrying its own id list. */
export function buildAssetTree(transformers) {
  const states = new Map();

  (transformers ?? []).forEach((tx) => {
    const stateLabel = getTransformerState({
      state: tx.state,
      siteName: tx.site_name,
      txName: tx.tx_name,
      mnemonic: tx.mnemonic,
    });
    const siteLabel = (tx.site_name || '').trim() || UNASSIGNED_SITE;

    let stateNode = states.get(stateLabel);
    if (!stateNode) {
      stateNode = { key: `state:${stateLabel}`, label: stateLabel, type: 'state', ids: [], sites: new Map() };
      states.set(stateLabel, stateNode);
    }

    let siteNode = stateNode.sites.get(siteLabel);
    if (!siteNode) {
      siteNode = {
        key: `${stateNode.key}/site:${siteLabel}`,
        label: siteLabel,
        type: 'site',
        ids: [],
        assets: [],
      };
      stateNode.sites.set(siteLabel, siteNode);
    }

    stateNode.ids.push(tx.id);
    siteNode.ids.push(tx.id);
    siteNode.assets.push(tx);
  });

  const byLabel = (a, b) => a.label.localeCompare(b.label, undefined, { numeric: true });

  return Array.from(states.values())
    .sort((a, b) => compareMalaysianStates(a.label, b.label))
    .map(({ sites, ...stateNode }) => ({
      ...stateNode,
      children: Array.from(sites.values())
        .sort((a, b) => {
          // "Unassigned site" is a catch-all, so it sinks to the bottom of its state.
          if (a.label === UNASSIGNED_SITE) return 1;
          if (b.label === UNASSIGNED_SITE) return -1;
          return byLabel(a, b);
        })
        .map((siteNode) => ({
          ...siteNode,
          assets: [...siteNode.assets].sort((a, b) =>
            (a.tx_name || '').localeCompare(b.tx_name || '', undefined, { numeric: true })
          ),
        })),
    }));
}

/**
 * Owner type of a whole branch: 'TNB' or 'Non-TNB' when every asset under it
 * agrees, 'mixed' when they do not.
 *
 * Unlike access, owner type is a property of the asset itself rather than of a
 * user's grant, so it is read from a live id → owner map that the panel keeps
 * (server rows plus any write still in flight).
 */
export function branchOwnerState(ids, ownerById) {
  let tnb = 0;
  let nonTnb = 0;
  ids.forEach((id) => {
    if (normalizeAssetOwnerType(ownerById.get(id)) === ASSET_OWNER_TYPES.NON_TNB) nonTnb += 1;
    else tnb += 1;
  });

  let status = 'mixed';
  if (nonTnb === 0) status = ASSET_OWNER_TYPES.TNB;
  else if (tnb === 0) status = ASSET_OWNER_TYPES.NON_TNB;

  return { status, tnb, nonTnb };
}

/** 'on' when every id is granted, 'off' when none are, 'partial' in between. */
export function branchState(ids, grantedIds) {
  let granted = 0;
  ids.forEach((id) => {
    if (grantedIds.has(id)) granted += 1;
  });
  if (granted === 0) return { status: 'off', granted };
  if (granted === ids.length) return { status: 'on', granted };
  return { status: 'partial', granted };
}
