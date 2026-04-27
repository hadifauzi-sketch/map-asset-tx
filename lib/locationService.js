const DEFAULT_LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

export function isLocationSupported() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function isLocationSecureContext() {
  return typeof window === 'undefined' ? true : Boolean(window.isSecureContext);
}

export function formatLocationError(error) {
  if (!isLocationSecureContext()) {
    return 'Live location needs HTTPS or localhost in the browser before GPS permission can work.';
  }

  switch (error?.code) {
    case 1:
      return 'Location access was denied. Allow GPS permission in your browser and try again.';
    case 2:
      return 'The device could not determine a reliable position. Move to a clearer area and retry.';
    case 3:
      return 'Location lookup timed out. Try refreshing the position again.';
    default:
      return error?.message || 'Unable to read the current location from this browser.';
  }
}

export function normalizeLocationPosition(position) {
  return {
    latitude: Number(position?.coords?.latitude),
    longitude: Number(position?.coords?.longitude),
    accuracy: Number(position?.coords?.accuracy),
    altitude: position?.coords?.altitude ?? null,
    altitudeAccuracy: position?.coords?.altitudeAccuracy ?? null,
    heading: position?.coords?.heading ?? null,
    speed: position?.coords?.speed ?? null,
    timestamp: Number(position?.timestamp) || Date.now(),
  };
}

export async function getCurrentLocation(options = {}) {
  if (!isLocationSupported()) {
    throw new Error('This browser does not support geolocation.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(normalizeLocationPosition(position));
      },
      (error) => {
        reject(new Error(formatLocationError(error)));
      },
      {
        ...DEFAULT_LOCATION_OPTIONS,
        ...options,
      }
    );
  });
}

export function startLocationWatch({ onSuccess, onError, options = {} } = {}) {
  if (!isLocationSupported()) {
    throw new Error('This browser does not support geolocation.');
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      onSuccess?.(normalizeLocationPosition(position));
    },
    (error) => {
      onError?.(formatLocationError(error), error);
    },
    {
      ...DEFAULT_LOCATION_OPTIONS,
      ...options,
    }
  );
}

export function stopLocationWatch(watchId) {
  if (!isLocationSupported() || watchId == null) {
    return;
  }

  navigator.geolocation.clearWatch(watchId);
}
