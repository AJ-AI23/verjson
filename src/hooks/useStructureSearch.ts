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
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find all matches in the schema
  const findMatches = useCallback((query: string, obj: any, currentPath: string[] = []): SearchMatch[] => {
    if (!query.trim() || !obj) return [];
    
    const results: SearchMatch[] = [];
    const lowerQuery = query.toLowerCase();

    const searchInValue = (value: any, path: string[], key: string) => {
      // Check property name
      if (key.toLowerCase().includes(lowerQuery)) {
        results.push({ path: [...path, key], matchType: 'name', matchedText: key });
      }

      // Check primitive values
      if (typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) {
        results.push({ path: [...path, key], matchType: 'value', matchedText: value });
      } else if (typeof value === 'number' && String(value).includes(query)) {
        results.push({ path: [...path, key], matchType: 'value', matchedText: String(value) });
      } else if (typeof value === 'boolean' && String(value).toLowerCase().includes(lowerQuery)) {
        results.push({ path: [...path, key], matchType: 'value', matchedText: String(value) });
      }

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

      // Recurse into nested objects and arrays
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            searchInValue(item, [...path, key], String(index));
          });
        } else {
          Object.entries(value).forEach(([childKey, childValue]) => {
            searchInValue(childValue, [...path, key], childKey);
          });
        }
      }
    };

    // Start searching from root
    if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        searchInValue(value, [], key);
      });
    }

    return results;
  }, []);

  // Update matches when query or schema changes
  useEffect(() => {
    if (searchQuery.trim()) {
      const found = findMatches(searchQuery, schema);
      setMatches(found);
      setCurrentMatchIndex(0);
    } else {
      setMatches([]);
      setCurrentMatchIndex(0);
    }
  }, [searchQuery, schema, findMatches]);

  // Get paths that need to be expanded for the current match
  const pathsToExpand = useMemo(() => {
    if (matches.length === 0 || currentMatchIndex >= matches.length) {
      return new Set<string>();
    }
    
    const match = matches[currentMatchIndex];
    const paths = new Set<string>();
    
    // Add all ancestor paths
    for (let i = 1; i <= match.path.length; i++) {
      paths.add(match.path.slice(0, i).join('.'));
    }
    
    return paths;
  }, [matches, currentMatchIndex]);

  // Expand paths when match changes
  useEffect(() => {
    if (pathsToExpand.size > 0) {
      setExpandedPaths(prev => {
        const next = new Set(prev);
        pathsToExpand.forEach(p => next.add(p));
        return next;
      });
    }
  }, [pathsToExpand]);

  // Scroll to the matched element
  const scrollToMatch = useCallback((matchPath: string[]) => {
    if (!containerRef.current) return;
    
    // Give the DOM time to update after expansion
    requestAnimationFrame(() => {
      setTimeout(() => {
        const pathId = matchPath.join('.');
        // Look for element with data-search-path attribute
        const element = containerRef.current?.querySelector(`[data-search-path="${pathId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight effect
          element.classList.add('search-highlight');
          setTimeout(() => {
            element.classList.remove('search-highlight');
          }, 2000);
        }
      }, 100);
    });
  }, [containerRef]);

  // Navigate to next/previous match
  const goToNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(matches[nextIndex].path);
  }, [matches, currentMatchIndex, scrollToMatch]);

  const goToPrevMatch = useCallback(() => {
    if (matches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(matches[prevIndex].path);
  }, [matches, currentMatchIndex, scrollToMatch]);

  // Scroll to first match when search results change
  useEffect(() => {
    if (matches.length > 0) {
      scrollToMatch(matches[0].path);
    }
  }, [matches.length > 0 ? matches[0]?.path.join('.') : '']);

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
