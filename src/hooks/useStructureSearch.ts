import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

export interface SearchMatch {
  path: string[];
  matchType: 'name' | 'value' | 'type';
  matchedText: string;
}

interface UseStructureSearchOptions {
  schema: any;
  containerRef: React.RefObject<HTMLElement>;
  onExpandPath?: (path: string[]) => void;
}

export function useStructureSearch({ schema, containerRef }: UseStructureSearchOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Inline debounce effect
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Memoize schema string for comparison to avoid re-running search on same schema
  const schemaRef = useRef<any>(null);
  const cachedMatchesRef = useRef<{ query: string; matches: SearchMatch[] }>({ query: '', matches: [] });

  // Find all matches in the schema - optimized with early termination and limits
  const findMatches = useCallback((query: string, obj: any): SearchMatch[] => {
    if (!query.trim() || !obj) return [];
    
    const results: SearchMatch[] = [];
    const lowerQuery = query.toLowerCase();
    const maxResults = 100; // Limit results for performance

    const searchInValue = (value: any, path: string[], key: string, depth: number) => {
      // Limit recursion depth and results count
      if (depth > 15 || results.length >= maxResults) return;

      // Check property name
      if (key.toLowerCase().includes(lowerQuery)) {
        results.push({ path: [...path, key], matchType: 'name', matchedText: key });
        if (results.length >= maxResults) return;
      }

      // Check primitive values
      if (typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) {
        results.push({ path: [...path, key], matchType: 'value', matchedText: value.slice(0, 50) });
      } else if (typeof value === 'number' && String(value).includes(query)) {
        results.push({ path: [...path, key], matchType: 'value', matchedText: String(value) });
      } else if (typeof value === 'boolean' && String(value).toLowerCase().includes(lowerQuery)) {
        results.push({ path: [...path, key], matchType: 'value', matchedText: String(value) });
      }

      if (results.length >= maxResults) return;

      // Check type field
      if (value && typeof value === 'object') {
        const typeValue = value.type || value.types;
        if (typeof typeValue === 'string' && typeValue.toLowerCase().includes(lowerQuery)) {
          results.push({ path: [...path, key], matchType: 'type', matchedText: typeValue });
        }
        
        // Check $ref
        if (value.$ref && typeof value.$ref === 'string') {
          const refName = value.$ref.split('/').pop() || '';
          if (refName.toLowerCase().includes(lowerQuery)) {
            results.push({ path: [...path, key], matchType: 'type', matchedText: refName });
          }
        }
      }

      if (results.length >= maxResults) return;

      // Recurse into nested objects and arrays
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length && results.length < maxResults; i++) {
            searchInValue(value[i], [...path, key], String(i), depth + 1);
          }
        } else {
          const entries = Object.entries(value);
          for (let i = 0; i < entries.length && results.length < maxResults; i++) {
            const [childKey, childValue] = entries[i];
            searchInValue(childValue, [...path, key], childKey, depth + 1);
          }
        }
      }
    };

    // Start searching from root
    if (typeof obj === 'object' && obj !== null) {
      const entries = Object.entries(obj);
      for (let i = 0; i < entries.length && results.length < maxResults; i++) {
        const [key, value] = entries[i];
        searchInValue(value, [], key, 0);
      }
    }

    return results;
  }, []);

  // Update matches when debounced query or schema changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      // Check cache first
      if (cachedMatchesRef.current.query === debouncedQuery && schemaRef.current === schema) {
        return;
      }
      
      const found = findMatches(debouncedQuery, schema);
      setMatches(found);
      setCurrentMatchIndex(0);
      
      // Update cache
      cachedMatchesRef.current = { query: debouncedQuery, matches: found };
      schemaRef.current = schema;
    } else {
      setMatches([]);
      setCurrentMatchIndex(0);
      cachedMatchesRef.current = { query: '', matches: [] };
    }
  }, [debouncedQuery, schema, findMatches]);

  // Get paths that need to be expanded for CURRENT match only (performance optimization)
  const expandedPaths = useMemo(() => {
    if (matches.length === 0 || currentMatchIndex >= matches.length) {
      return new Set<string>();
    }

    const paths = new Set<string>();
    const currentMatch = matches[currentMatchIndex];

    // Include all ancestor paths from root to the full path
    // This ensures all parent containers are expanded
    for (let i = 1; i <= currentMatch.path.length; i++) {
      paths.add(currentMatch.path.slice(0, i).join('.'));
    }

    // Also add 'root' path in case structure uses it
    if (currentMatch.path.length > 0) {
      paths.add('root');
      paths.add(`root.${currentMatch.path[0]}`);
    }

    // For component paths (e.g., components.schemas.ComponentName.properties.field),
    // ensure the component container path is included
    if (
      currentMatch.path.length >= 3 &&
      currentMatch.path[0] === 'components' &&
      currentMatch.path[1] === 'schemas'
    ) {
      // Add the component container path: components.schemas.ComponentName
      paths.add(currentMatch.path.slice(0, 3).join('.'));
    }

    return paths;
  }, [matches, currentMatchIndex]);

  // Scroll to the matched element
  const scrollToMatch = useCallback((matchPath: string[]) => {
    if (!containerRef.current) return;
    
    // Need delay to let DOM update after expansion
    requestAnimationFrame(() => {
      setTimeout(() => {
        const pathId = matchPath.join('.');
        const element = containerRef.current?.querySelector(`[data-search-path="${pathId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('search-highlight');
          setTimeout(() => element.classList.remove('search-highlight'), 2000);
        }
      }, 50);
    });
  }, [containerRef]);

  // Navigate to next/previous match
  const goToNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const goToPrevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((i) => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  // Scroll to the current match when it changes (after expansion render)
  useEffect(() => {
    const match = matches[currentMatchIndex];
    if (!match) return;
    scrollToMatch(match.path);
  }, [currentMatchIndex, matches, scrollToMatch]);

  // Focus search input
  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setMatches([]);
    setCurrentMatchIndex(0);
  }, []);

  // Check if a path should be expanded due to search
  const isPathExpandedBySearch = useCallback((path: string[]) => {
    return expandedPaths.has(path.join('.'));
  }, [expandedPaths]);

  // Get the current match's path as a string for comparison
  const currentMatchPath = useMemo(() => {
    if (matches.length === 0 || currentMatchIndex >= matches.length) return null;
    return matches[currentMatchIndex].path.join('.');
  }, [matches, currentMatchIndex]);

  return {
    searchQuery,
    setSearchQuery,
    matches,
    currentMatchIndex,
    currentMatch: matches[currentMatchIndex] || null,
    currentMatchPath,
    goToNextMatch,
    goToPrevMatch,
    focusSearch,
    clearSearch,
    searchInputRef,
    isPathExpandedBySearch,
    expandedPaths,
    hasMatches: matches.length > 0,
  };
}
