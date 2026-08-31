import {
  buildBridgePayload,
  BRIDGE_MESSAGE,
  BRIDGE_VERSION,
  INTENT_ASSET,
  INTENT_RESULT,
} from './shared/canonical.js';
import { extractRecordRef, scrapeActmsPage, toCanonical } from './lims/adapter.js';

const DEFAULT_CONFIG = {
  limsBaseUrl: 'https://actms.tnbr.com.my',
  appOrigin: 'http://localhost:3000',
};

const MENU_ITEMS = [
  {
    id: 'send-actms-asset',
    intent: INTENT_ASSET,
    title: 'Add or update the asset from this record',
  },
  {
    id: 'send-actms-result',
    intent: INTENT_RESULT,
    title: 'Add this test result to the asset',
  },
];

const MENU_INTENTS = new Map(MENU_ITEMS.map((item) => [item.id, item.intent]));

async function getConfig() {
  const stored = await chrome.storage.sync.get(DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG, ...stored };
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// ── Right-click menu ─────────────────────────────────────────────────────────
// ACTMS opens sample results in a popup window, which has no toolbar and so no
// extension icon to click. The context menu is the only reachable entry point
// there, so it — not the popup — is the primary way to use this extension.

async function refreshContextMenu() {
  const config = await getConfig();
  const limsOrigin = originOf(config.limsBaseUrl);

  await chrome.contextMenus.removeAll();

  MENU_ITEMS.forEach((item) => {
    chrome.contextMenus.create({
      id: item.id,
      title: item.title,
      // 'frame' matters: ACTMS lays pages out with framesets in places.
      contexts: ['page', 'frame', 'selection', 'link'],
      ...(limsOrigin ? { documentUrlPatterns: [`${limsOrigin}/*`] } : {}),
    });
  });
}

chrome.runtime.onInstalled.addListener(refreshContextMenu);
chrome.runtime.onStartup.addListener(refreshContextMenu);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.limsBaseUrl) {
    refreshContextMenu();
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const intent = MENU_INTENTS.get(info.menuItemId);

  if (!intent || !tab?.id) {
    return;
  }

  try {
    const result = await pullRecordFromTab(tab, intent);
    await showToast(tab.id, describeResult(result, intent), 'ok');
  } catch (error) {
    await showToast(tab.id, error.message, 'error');
  }
});

function describeResult(result, intent) {
  return intent === INTENT_RESULT
    ? `Sent ${result.testCount} result(s) for ${result.transformerLabel} — ${result.valueCount} values. The app will file them against the matching asset.`
    : `Sent asset details for ${result.transformerLabel}. Review and save in the app.`;
}

/**
 * Feedback has to appear on the ACTMS page itself: a popup window has no
 * toolbar, so there is no extension popup to report into.
 */
async function showToast(tabId, message, tone) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (text, kind) => {
        const id = '__limsBridgeToast';
        document.getElementById(id)?.remove();

        const toast = document.createElement('div');
        toast.id = id;
        toast.textContent = text;
        Object.assign(toast.style, {
          position: 'fixed',
          zIndex: '2147483647',
          top: '16px',
          right: '16px',
          maxWidth: '380px',
          padding: '12px 14px',
          borderRadius: '8px',
          background: kind === 'error' ? '#b91c1c' : '#0d9488',
          color: '#fff',
          font: '13px/1.45 system-ui, Segoe UI, sans-serif',
          boxShadow: '0 6px 24px rgba(0,0,0,.28)',
          cursor: 'pointer',
        });
        toast.addEventListener('click', () => toast.remove());
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), kind === 'error' ? 12000 : 6000);
      },
      args: [message, tone],
    });
  } catch {
    // A toast is a convenience; never let it mask the real result.
  }
}

// ── Capture ──────────────────────────────────────────────────────────────────

/**
 * Read the ACTMS page. Scrapes every frame and keeps whichever returned the
 * most result rows, so a frameset layout works without special-casing.
 */
async function scrapeTab(tabId) {
  const injections = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: scrapeActmsPage,
  });

  return injections
    .map((injection) => injection?.result)
    .filter((result) => result?.sections?.length)
    .sort((left, right) => right.sections.length - left.sections.length)[0] ?? null;
}

async function deliverToApp(tabId, payload) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (message, envelopeKey, version) => {
      window.postMessage({ [envelopeKey]: true, version, payload: message }, window.location.origin);
    },
    args: [payload, BRIDGE_MESSAGE, BRIDGE_VERSION],
  });
}

async function pullRecordFromTab(tab, intent = INTENT_ASSET) {
  const config = await getConfig();

  if (!tab?.id || !tab.url) {
    throw new Error('No page to read.');
  }

  const tabOrigin = originOf(tab.url);
  if (!tabOrigin || !(await chrome.permissions.contains({ origins: [`${tabOrigin}/*`] }))) {
    throw new Error(
      `This extension has no access to ${tabOrigin || 'this site'} yet. Open the extension popup and click "Grant LIMS access".`
    );
  }

  const ref = extractRecordRef({ url: tab.url, title: tab.title });
  if (!ref?.recordId) {
    throw new Error('This is not an ACTMS Sample Result List page. Open a sample result and retry.');
  }

  const scraped = await scrapeTab(tab.id);
  if (!scraped) {
    throw new Error('No result tables found on this page. Wait for the results to load, then retry.');
  }

  const { transformer, oilTests, address, diagnostics } = toCanonical(scraped, ref);

  const payload = buildBridgePayload({
    transformer,
    oilTests,
    address,
    intent,
    recordId: ref.recordId,
    sourceUrl: tab.url,
  });

  const [appTab] = await chrome.tabs.query({ url: `${config.appOrigin}/*` });
  if (!appTab?.id) {
    throw new Error(`No TX Asset Map tab open at ${config.appOrigin}. Open the app and retry.`);
  }

  await deliverToApp(appTab.id, payload);
  // Bring the app forward; its window may be behind the ACTMS popup.
  await chrome.tabs.update(appTab.id, { active: true });
  await chrome.windows.update(appTab.windowId, { focused: true });

  return {
    recordId: ref.recordId,
    transformerLabel: payload.transformer.serialNumber || payload.transformer.txName,
    testCount: payload.oilTestPayloads.length,
    valueCount: Object.keys(payload.oilTestPayloads[0] || {}).length,
    diagnostics,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'PULL_ACTIVE_RECORD') {
    return false;
  }

  chrome.tabs
    .query({ active: true, currentWindow: true })
    .then(([tab]) => pullRecordFromTab(tab, message.intent))
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  // Keep the message channel open for the async response.
  return true;
});
