function normalizeLookupText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeIdentifier(value) {
  return normalizeLookupText(value).replace(/[^a-z0-9]/g, '');
}

function buildSuggestionSummary(transformer, reason, score) {
  return {
    transformerId: transformer.id,
    mnemonic: String(transformer.mnemonic ?? '').trim(),
    siteName: String(transformer.siteName ?? '').trim(),
    txName: String(transformer.txName ?? '').trim(),
    serialNumber: String(transformer.serialNumber ?? '').trim(),
    reason,
    score,
  };
}

function storeSuggestion(suggestionMap, transformer, reason, score) {
  const mnemonic = String(transformer?.mnemonic ?? '').trim();

  if (!mnemonic) {
    return;
  }

  const suggestion = buildSuggestionSummary(transformer, reason, score);
  const key = `${normalizeLookupText(suggestion.mnemonic)}::${normalizeLookupText(suggestion.siteName)}`;
  const existingSuggestion = suggestionMap.get(key);

  if (!existingSuggestion || score > existingSuggestion.score) {
    suggestionMap.set(key, suggestion);
  }
}

export function buildTransformerMnemonicAssist({
  transformers = [],
  currentTransformerId,
  serialNumber,
  siteName,
  txName,
}) {
  const normalizedSerial = normalizeIdentifier(serialNumber);
  const normalizedSite = normalizeLookupText(siteName);
  const normalizedTxName = normalizeLookupText(txName);
  const currentId = currentTransformerId == null ? '' : String(currentTransformerId);
  const suggestionMap = new Map();
  const exactSerialConflicts = [];

  transformers.forEach((transformer) => {
    if (!transformer) {
      return;
    }

    const transformerId = transformer.id == null ? '' : String(transformer.id);

    if (transformerId && currentId && transformerId === currentId) {
      return;
    }

    const candidateSerial = normalizeIdentifier(transformer.serialNumber);
    const candidateSite = normalizeLookupText(transformer.siteName);
    const candidateTxName = normalizeLookupText(transformer.txName);
    const exactSerialMatch = Boolean(normalizedSerial && candidateSerial && normalizedSerial === candidateSerial);
    const partialSerialMatch =
      !exactSerialMatch &&
      Boolean(
        normalizedSerial.length >= 4 &&
          candidateSerial &&
          (candidateSerial.includes(normalizedSerial) || normalizedSerial.includes(candidateSerial))
      );
    const sameSite = Boolean(normalizedSite && candidateSite && normalizedSite === candidateSite);
    const sameTxName = Boolean(normalizedTxName && candidateTxName && normalizedTxName === candidateTxName);

    if (exactSerialMatch) {
      exactSerialConflicts.push({
        transformerId,
        siteName: String(transformer.siteName ?? '').trim(),
        txName: String(transformer.txName ?? '').trim(),
        mnemonic: String(transformer.mnemonic ?? '').trim(),
        serialNumber: String(transformer.serialNumber ?? '').trim(),
      });
      storeSuggestion(suggestionMap, transformer, 'Same serial number', 120);
      return;
    }

    if (sameSite && sameTxName) {
      storeSuggestion(suggestionMap, transformer, 'Same site and transformer name', 100);
      return;
    }

    if (partialSerialMatch) {
      storeSuggestion(suggestionMap, transformer, 'Similar serial number', 90);
      return;
    }

    if (sameSite) {
      storeSuggestion(suggestionMap, transformer, 'Same site', 70);
    }
  });

  const suggestions = Array.from(suggestionMap.values())
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.siteName !== right.siteName) {
        return left.siteName.localeCompare(right.siteName);
      }

      return left.mnemonic.localeCompare(right.mnemonic);
    })
    .slice(0, 6);

  return {
    suggestions,
    exactSerialConflicts,
  };
}
