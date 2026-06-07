const GIBS_WEB_MERCATOR_ROOT = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
export const ESRI_LANDSAT_LEVEL2_IMAGE_SERVICE_URL =
  'https://landsat.imagery1.arcgis.com/arcgis/rest/services/LandsatC2L2/ImageServer';
export const ESRI_LANDSAT_EXPLORER_URL = 'https://livingatlas.arcgis.com/landsatexplorer/';
export const DEFAULT_ESRI_LANDSAT_RENDERING_RULE = 'Landsat8_TIRS1_Temperature_Celcius';
export const DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS = 45;

export const DEFAULT_LST_SOURCE_ID = 'modisTerraDay';

export const LST_LAYER_SOURCES = {
  modisTerraDay: {
    id: 'modisTerraDay',
    label: 'Terra day',
    fullLabel: 'MODIS Terra LST day',
    serviceType: 'gibsWmts',
    layerId: 'MODIS_Terra_Land_Surface_Temp_Day',
    satellite: 'Terra / MODIS',
    timeLabel: 'Day',
    resolution: '1 km',
    format: 'png',
    maxNativeZoom: 7,
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    attribution: 'NASA GIBS / EOSDIS MODIS Land Surface Temperature',
  },
  modisAquaDay: {
    id: 'modisAquaDay',
    label: 'Aqua day',
    fullLabel: 'MODIS Aqua LST day',
    serviceType: 'gibsWmts',
    layerId: 'MODIS_Aqua_Land_Surface_Temp_Day',
    satellite: 'Aqua / MODIS',
    timeLabel: 'Day',
    resolution: '1 km',
    format: 'png',
    maxNativeZoom: 7,
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    attribution: 'NASA GIBS / EOSDIS MODIS Land Surface Temperature',
  },
  modisTerraNight: {
    id: 'modisTerraNight',
    label: 'Terra night',
    fullLabel: 'MODIS Terra LST night',
    serviceType: 'gibsWmts',
    layerId: 'MODIS_Terra_Land_Surface_Temp_Night',
    satellite: 'Terra / MODIS',
    timeLabel: 'Night',
    resolution: '1 km',
    format: 'png',
    maxNativeZoom: 7,
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    attribution: 'NASA GIBS / EOSDIS MODIS Land Surface Temperature',
  },
  modisAquaNight: {
    id: 'modisAquaNight',
    label: 'Aqua night',
    fullLabel: 'MODIS Aqua LST night',
    serviceType: 'gibsWmts',
    layerId: 'MODIS_Aqua_Land_Surface_Temp_Night',
    satellite: 'Aqua / MODIS',
    timeLabel: 'Night',
    resolution: '1 km',
    format: 'png',
    maxNativeZoom: 7,
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    attribution: 'NASA GIBS / EOSDIS MODIS Land Surface Temperature',
  },
  viirsSnppDay: {
    id: 'viirsSnppDay',
    label: 'VIIRS SNPP day',
    fullLabel: 'VIIRS Suomi NPP LST day',
    serviceType: 'gibsWmts',
    layerId: 'VIIRS_SNPP_Land_Surface_Temp_Day',
    satellite: 'Suomi NPP / VIIRS',
    timeLabel: 'Day',
    resolution: '~1 km',
    format: 'png',
    maxNativeZoom: 7,
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    attribution: 'NASA GIBS / EOSDIS VIIRS Land Surface Temperature',
  },
  viirsSnppNight: {
    id: 'viirsSnppNight',
    label: 'VIIRS SNPP night',
    fullLabel: 'VIIRS Suomi NPP LST night',
    serviceType: 'gibsWmts',
    layerId: 'VIIRS_SNPP_Land_Surface_Temp_Night',
    satellite: 'Suomi NPP / VIIRS',
    timeLabel: 'Night',
    resolution: '~1 km',
    format: 'png',
    maxNativeZoom: 7,
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    attribution: 'NASA GIBS / EOSDIS VIIRS Land Surface Temperature',
  },
  viirsNoaa20Day: {
    id: 'viirsNoaa20Day',
    label: 'VIIRS NOAA-20 day',
    fullLabel: 'VIIRS NOAA-20 LST day',
    serviceType: 'gibsWmts',
    layerId: 'VIIRS_NOAA20_Land_Surface_Temp_Day',
    satellite: 'NOAA-20 / VIIRS',
    timeLabel: 'Day',
    resolution: '~1 km',
    format: 'png',
    maxNativeZoom: 7,
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    attribution: 'NASA GIBS / EOSDIS VIIRS Land Surface Temperature',
  },
  viirsNoaa20Night: {
    id: 'viirsNoaa20Night',
    label: 'VIIRS NOAA-20 night',
    fullLabel: 'VIIRS NOAA-20 LST night',
    serviceType: 'gibsWmts',
    layerId: 'VIIRS_NOAA20_Land_Surface_Temp_Night',
    satellite: 'NOAA-20 / VIIRS',
    timeLabel: 'Night',
    resolution: '~1 km',
    format: 'png',
    maxNativeZoom: 7,
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    attribution: 'NASA GIBS / EOSDIS VIIRS Land Surface Temperature',
  },
  uhiSummerDayMax2013: {
    id: 'uhiSummerDayMax2013',
    label: 'UHI summer day',
    fullLabel: 'UHI average summer daytime maximum LST 2013',
    serviceType: 'gibsWmts',
    dateMode: 'static',
    layerId: 'UHI_Avg_Summer_Day_Max_Land_Surface_Temp_2013',
    satellite: 'NASA UHI / GIBS',
    timeLabel: 'Summer day max',
    resolution: '~1 km',
    format: 'png',
    maxNativeZoom: 7,
    staticTime: 'default',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    attribution: 'NASA GIBS Urban Heat Island, 2013',
  },
  uhiSummerNightMin2013: {
    id: 'uhiSummerNightMin2013',
    label: 'UHI summer night',
    fullLabel: 'UHI average summer nighttime minimum LST 2013',
    serviceType: 'gibsWmts',
    dateMode: 'static',
    layerId: 'UHI_Avg_Summer_Night_Min_Land_Surface_Temp_2013',
    satellite: 'NASA UHI / GIBS',
    timeLabel: 'Summer night min',
    resolution: '~1 km',
    format: 'png',
    maxNativeZoom: 7,
    staticTime: 'default',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    attribution: 'NASA GIBS Urban Heat Island, 2013',
  },
  esriLandsatSurfaceTemperature: {
    id: 'esriLandsatSurfaceTemperature',
    label: 'Esri Landsat ST',
    fullLabel: 'Esri Landsat Level-2 Surface Temperature',
    serviceType: 'arcgisImageServer',
    hidden: true,
    satellite: 'Landsat 8/9 / Esri',
    timeLabel: 'Day scene',
    resolution: '30 m',
    requiresToken: true,
    defaultServiceUrl: ESRI_LANDSAT_LEVEL2_IMAGE_SERVICE_URL,
    defaultRasterFunction: DEFAULT_ESRI_LANDSAT_RENDERING_RULE,
    attribution: 'Esri, Microsoft, USGS, NASA Landsat Level-2',
  },
};

export const LST_LAYER_SOURCE_OPTIONS = Object.values(LST_LAYER_SOURCES).filter(
  (source) => !source.hidden
);

export const LST_TILE_ATTRIBUTION =
  'NASA GIBS / EOSDIS MODIS Land Surface Temperature';

export const LST_HEAT_LEGEND = [
  { label: 'Cool', color: '#2563eb' },
  { label: 'Warm', color: '#facc15' },
  { label: 'Hot', color: '#dc2626' },
];

export const LST_URBAN_HEAT_WORKFLOW_STEPS = [
  {
    title: 'Choose asset AOI',
    description: 'Use the asset, company boundary, or city extent as the analysis area.',
  },
  {
    title: 'Filter clear Landsat scenes',
    description: 'In ArcGIS Online, use Landsat Level-2 around the selected date and cloud-free season.',
  },
  {
    title: 'Render surface temperature',
    description: 'Apply the Surface Temperature raster function in Celsius for Landsat 8/9 scenes.',
  },
  {
    title: 'Run SIUHI functions',
    description: 'Aggregate cloud-free temperature, compute vegetated mean, then calculate Surface Heat Index.',
  },
  {
    title: 'Publish image layer',
    description: 'Paste the hosted ImageServer URL here to overlay the final urban heat island output.',
  },
];

export function getLSTSource(sourceId) {
  return LST_LAYER_SOURCES[sourceId] || LST_LAYER_SOURCES[DEFAULT_LST_SOURCE_ID];
}

export function buildLSTTileUrl(sourceId, date) {
  const source = getLSTSource(sourceId);
  const safeDate = normalizeLSTDate(date);
  const timePath = source.dateMode === 'static' ? source.staticTime || 'default' : safeDate;

  return [
    GIBS_WEB_MERCATOR_ROOT,
    source.layerId,
    'default',
    timePath,
    source.tileMatrixSet,
    '{z}',
    '{y}',
    `{x}.${source.format}`,
  ].join('/');
}

export function buildArcGISLSTExportImageUrl({
  serviceUrl = ESRI_LANDSAT_LEVEL2_IMAGE_SERVICE_URL,
  bbox,
  width = 256,
  height = 256,
  date,
  token = '',
  rasterFunction = DEFAULT_ESRI_LANDSAT_RENDERING_RULE,
  mosaicWindowDays = DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS,
  refreshKey = 0,
} = {}) {
  const normalizedServiceUrl = normalizeArcGISImageServiceUrl(serviceUrl);
  if (!normalizedServiceUrl || !bbox) {
    return '';
  }

  const params = new URLSearchParams({
    f: 'image',
    bbox,
    bboxSR: '102100',
    imageSR: '102100',
    size: `${Math.max(1, Math.round(width))},${Math.max(1, Math.round(height))}`,
    format: 'png32',
    transparent: 'true',
  });

  const timeRange = getArcGISTimeRange(date, mosaicWindowDays);
  if (timeRange) {
    params.set('time', `${timeRange.start},${timeRange.end}`);
  }

  const renderingRule = getArcGISRenderingRuleValue(rasterFunction);
  if (renderingRule) {
    params.set('renderingRule', renderingRule);
  }

  const safeToken = String(token || '').trim();
  if (safeToken) {
    params.set('token', safeToken);
  }

  if (refreshKey) {
    params.set('_', String(refreshKey));
  }

  return `${normalizedServiceUrl}/exportImage?${params.toString()}`;
}

export function normalizeArcGISImageServiceUrl(serviceUrl) {
  const rawValue = String(serviceUrl || '').trim();
  if (!rawValue) {
    return '';
  }

  return rawValue
    .split('?')[0]
    .replace(/\/exportImage\/?$/i, '')
    .replace(/\/+$/, '');
}

export function getArcGISTimeRange(dateValue, windowDays = DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS) {
  const safeDate = normalizeLSTDate(dateValue);
  const date = parseDateValue(safeDate);
  if (!date) {
    return null;
  }

  const safeWindowDays = Math.round(clampNumber(windowDays, 1, 180, DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS));
  const beforeDays = Math.floor(safeWindowDays / 2);
  const afterDays = Math.max(0, safeWindowDays - beforeDays - 1);
  const startDate = new Date(date);
  const endDate = new Date(date);

  startDate.setDate(startDate.getDate() - beforeDays);
  endDate.setDate(endDate.getDate() + afterDays);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return {
    start: startDate.getTime(),
    end: endDate.getTime(),
  };
}

export function getDefaultLSTDate(offsetDays = 7) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - offsetDays);
  return toDateValue(date);
}

export function getComparisonLSTDate(dateValue) {
  const date = parseDateValue(dateValue) || parseDateValue(getDefaultLSTDate()) || new Date();
  date.setFullYear(date.getFullYear() - 1);
  return toDateValue(date);
}

export function normalizeLSTDate(dateValue, fallback = getDefaultLSTDate()) {
  const parsed = parseDateValue(dateValue);
  if (!parsed) {
    return fallback;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (parsed > today) {
    return toDateValue(today);
  }

  return toDateValue(parsed);
}

export function formatLSTDateLabel(dateValue) {
  const date = parseDateValue(dateValue);
  if (!date) {
    return '-';
  }

  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function parseDateValue(dateValue) {
  if (!dateValue || typeof dateValue !== 'string') {
    return null;
  }

  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getArcGISRenderingRuleValue(rasterFunction) {
  const value = String(rasterFunction || '').trim();
  if (!value) {
    return '';
  }

  if (value.startsWith('{')) {
    return value;
  }

  return JSON.stringify({ rasterFunction: value });
}

function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}
