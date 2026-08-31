const limsBaseUrlInput = document.getElementById('limsBaseUrl');
const appOriginInput = document.getElementById('appOrigin');
const grantButton = document.getElementById('grant');
const pullAssetButton = document.getElementById('pull-asset');
const pullResultButton = document.getElementById('pull-result');
const statusEl = document.getElementById('status');
const diagnosticsEl = document.getElementById('diagnostics');
const diagnosticsBody = document.getElementById('diagnosticsBody');

const DEFAULT_CONFIG = {
  limsBaseUrl: 'https://actms.tnbr.com.my',
  appOrigin: 'http://localhost:3000',
};

function setStatus(message, tone = '') {
  statusEl.textContent = message;
  statusEl.className = tone;
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

async function loadConfig() {
  const config = await chrome.storage.sync.get(DEFAULT_CONFIG);
  limsBaseUrlInput.value = config.limsBaseUrl || '';
  appOriginInput.value = config.appOrigin || DEFAULT_CONFIG.appOrigin;
}

async function saveConfig() {
  await chrome.storage.sync.set({
    limsBaseUrl: limsBaseUrlInput.value.trim(),
    appOrigin: appOriginInput.value.trim() || DEFAULT_CONFIG.appOrigin,
  });
}

limsBaseUrlInput.addEventListener('change', saveConfig);
appOriginInput.addEventListener('change', saveConfig);

grantButton.addEventListener('click', async () => {
  await saveConfig();

  const limsOrigin = originOf(limsBaseUrlInput.value.trim());
  const appOrigin = originOf(appOriginInput.value.trim() || DEFAULT_CONFIG.appOrigin);

  if (!limsOrigin) {
    setStatus('Enter a valid LIMS base URL first.', 'error');
    return;
  }

  const origins = [`${limsOrigin}/*`];
  if (appOrigin) {
    origins.push(`${appOrigin}/*`);
  }

  const granted = await chrome.permissions.request({ origins });
  setStatus(
    granted ? 'Access granted.' : 'Access denied — the extension cannot reach the LIMS without it.',
    granted ? 'ok' : 'error'
  );
});

async function pull(intent) {
  await saveConfig();
  pullAssetButton.disabled = true;
  pullResultButton.disabled = true;
  diagnosticsEl.hidden = true;
  setStatus(intent === 'result' ? 'Filing result…' : 'Reading asset details…');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'PULL_ACTIVE_RECORD', intent });

    if (!response?.ok) {
      setStatus(response?.error || 'Something went wrong.', 'error');
      return;
    }

    const { transformerLabel, testCount, diagnostics } = response.result;
    setStatus(
      intent === 'result'
        ? `Sent ${testCount} result${testCount === 1 ? '' : 's'} for ${transformerLabel}. Check the app for the outcome.`
        : `Sent asset details for ${transformerLabel} to the Asset Map for review.`,
      'ok'
    );

    const unmapped = [
      ...(diagnostics?.unmappedTransformerFields || []),
      ...(diagnostics?.unmappedResultLabels || []),
    ];

    if (unmapped.length) {
      diagnosticsBody.textContent = unmapped.join(', ');
      diagnosticsEl.hidden = false;
    }
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    pullAssetButton.disabled = false;
    pullResultButton.disabled = false;
  }
}

pullAssetButton.addEventListener('click', () => pull('asset'));
pullResultButton.addEventListener('click', () => pull('result'));

loadConfig();
