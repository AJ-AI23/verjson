export interface TranslationEntry {
  key: string;
  value: string;
  path: string[];
}

export function extractStringValues(obj: any, prefix = 'root', path: string[] = []): TranslationEntry[] {
  const entries: TranslationEntry[] = [];
  
  if (obj === null || obj === undefined) {
    return entries;
  }

  if (typeof obj === 'string') {
    entries.push({
      key: prefix,
      value: obj,
      path: [...path]
    });
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const newPrefix = `${prefix}.${index}`;
      const newPath = [...path, index.toString()];
      entries.push(...extractStringValues(item, newPrefix, newPath));
    });
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      const newPrefix = `${prefix}.${key}`;
      const newPath = [...path, key];
      entries.push(...extractStringValues(obj[key], newPrefix, newPath));
    });
  }

  return entries;
}

export function createTranslationIndex(entries: TranslationEntry[]): Record<string, string> {
  const index: Record<string, string> = {};
  entries.forEach(entry => {
    index[entry.key] = entry.value;
  });
  return index;
}

export function downloadJsonFile(data: any, filename: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}