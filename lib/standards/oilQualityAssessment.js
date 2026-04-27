import { normaliseOilType } from '../oilTypeUtils';
import { getIec60422Assessment } from './iec60422Profiles';
import { getIec61203Assessment } from './iec61203SyntheticEsterProfiles';
import { getIec62975Assessment } from './iec62975NaturalEsterProfiles';
import { getModifiedEsterAssessment } from './modifiedEsterProfiles';
import { getSupplementaryOilAssessment } from './supplementaryOilReferences';

const NATURAL_ESTER_ALIASES = new Set([
  'natural ester',
  'soybean',
  'rapeseed',
  'sunflower',
]);

const SYNTHETIC_ESTER_ALIASES = new Set([
  'synthetic ester',
  'synthetic',
]);

const MODIFIED_ESTER_ALIASES = new Set([
  'modified ester',
  'modify ester',
  'blended ester',
  'modified blended ester',
  'modified / blended ester',
  'modified/blended ester',
]);

export function getOilTypeFromContext(sample, transformerOrVoltage) {
  const candidate =
    sample?.oilType ??
    sample?.oil_type ??
    transformerOrVoltage?.oilType ??
    transformerOrVoltage?.oil_type ??
    '';

  return normaliseOilType(candidate) || String(candidate || '').trim();
}

export function isNaturalEsterOilType(value) {
  const normalized = String(normaliseOilType(value) || value || '').trim().toLowerCase();
  return NATURAL_ESTER_ALIASES.has(normalized);
}

export function isSyntheticEsterOilType(value) {
  const normalized = String(normaliseOilType(value) || value || '').trim().toLowerCase();
  return SYNTHETIC_ESTER_ALIASES.has(normalized);
}

export function isModifiedEsterOilType(value) {
  const normalized = String(normaliseOilType(value) || value || '').trim().toLowerCase();
  return MODIFIED_ESTER_ALIASES.has(normalized);
}

export function hasDedicatedEsterOilQualityProfile(value) {
  return isNaturalEsterOilType(value) || isSyntheticEsterOilType(value) || isModifiedEsterOilType(value);
}

export function getOilQualityAssessment(sample, transformerOrVoltage) {
  const oilType = getOilTypeFromContext(sample, transformerOrVoltage);

  if (isNaturalEsterOilType(oilType)) {
    return getIec62975Assessment(sample, transformerOrVoltage);
  }

  if (isSyntheticEsterOilType(oilType)) {
    return getIec61203Assessment(sample, transformerOrVoltage);
  }

  if (isModifiedEsterOilType(oilType)) {
    return getModifiedEsterAssessment(sample, transformerOrVoltage);
  }

  return getIec60422Assessment(sample, transformerOrVoltage);
}

export function getOilQualitySupplementaryAssessment(sample) {
  if (hasDedicatedEsterOilQualityProfile(getOilTypeFromContext(sample))) {
    return null;
  }

  return getSupplementaryOilAssessment(sample);
}
