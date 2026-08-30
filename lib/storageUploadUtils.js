const DEFAULT_RETRY_DELAYS_MS = [600, 1600];
const RETRYABLE_STORAGE_STATUS_CODES = new Set([500, 502, 503, 504, 520, 522, 524]);

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function getStorageErrorStatus(error) {
  const candidates = [error?.status, error?.statusCode, error?.httpStatusCode];

  for (const candidate of candidates) {
    const status = Number.parseInt(String(candidate ?? ''), 10);

    if (Number.isFinite(status)) {
      return status;
    }
  }

  return null;
}

function isRetryableStorageError(error) {
  const status = getStorageErrorStatus(error);

  if (status != null) {
    return RETRYABLE_STORAGE_STATUS_CODES.has(status);
  }

  const errorName = String(error?.name ?? '').toLowerCase();
  const errorMessage = String(error?.message ?? '').toLowerCase();

  return (
    errorName.includes('storageunknownerror') ||
    errorName === 'typeerror' ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('networkerror')
  );
}

function isAlreadyStoredError(error) {
  const status = getStorageErrorStatus(error);
  const errorText = `${error?.message ?? ''} ${error?.statusCode ?? ''}`.toLowerCase();

  return (
    (status === 400 || status === 409) &&
    (errorText.includes('already exists') ||
      errorText.includes('resourcealreadyexists') ||
      errorText.includes('keyalreadyexists') ||
      errorText.includes('duplicate'))
  );
}

async function storageObjectExists(storageBucket, storagePath) {
  if (typeof storageBucket?.exists !== 'function') {
    return false;
  }

  try {
    const { data, error } = await storageBucket.exists(storagePath);
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function uploadStorageObjectWithRetry(
  storageBucket,
  storagePath,
  file,
  uploadOptions,
  retryOptions = {}
) {
  const retryDelays = Array.isArray(retryOptions.retryDelays)
    ? retryOptions.retryDelays
    : DEFAULT_RETRY_DELAYS_MS;
  const waitForRetry = retryOptions.wait ?? wait;
  let lastError = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    let uploadData = null;
    let uploadError = null;

    try {
      const result = await storageBucket.upload(storagePath, file, uploadOptions);
      uploadData = result?.data ?? null;
      uploadError = result?.error ?? null;
    } catch (error) {
      uploadError = error;
    }

    if (!uploadError) {
      return uploadData;
    }

    lastError = uploadError;
    const retryable = isRetryableStorageError(uploadError);

    // A 5xx response can arrive after Storage accepted the body. Confirm the
    // exact path before replaying it so a retry cannot create a duplicate.
    if ((retryable || isAlreadyStoredError(uploadError)) && await storageObjectExists(storageBucket, storagePath)) {
      return { path: storagePath };
    }

    // If Storage accepted an earlier attempt but its response was lost, the
    // same-path replay can report "already exists". The path is generated once
    // per upload, so that response completes this retry without making a copy.
    if (attempt > 0 && isAlreadyStoredError(uploadError)) {
      return { path: storagePath };
    }

    if (!retryable || attempt === retryDelays.length) {
      throw uploadError;
    }

    await waitForRetry(retryDelays[attempt], attempt, uploadError);
  }

  throw lastError;
}

export function getDocumentUploadErrorMessage(error, options = {}) {
  const status = getStorageErrorStatus(error);
  const retryMessage = options.reviewOpen
    ? 'Your reviewed results are still open; wait a moment and submit again.'
    : 'Wait a moment and try the upload again.';

  if (status === 520) {
    return `Supabase Storage temporarily failed after automatic retries. ${retryMessage}`;
  }

  if (status === 413) {
    return 'The document is larger than the Supabase Storage upload limit for this bucket.';
  }

  if (status === 401 || status === 403) {
    return 'Supabase Storage rejected the upload. Check the transformer-documents bucket access policy.';
  }

  if (status === 404 || String(error?.statusCode ?? '').toLowerCase() === 'nosuchbucket') {
    return 'The transformer-documents storage bucket is unavailable or cannot be accessed.';
  }

  return `Failed to store the report in Supabase. ${retryMessage}`;
}
