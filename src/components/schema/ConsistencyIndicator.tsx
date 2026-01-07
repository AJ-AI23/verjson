import React, { useMemo } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ConsistencyIssue } from '@/types/consistency';

interface ConsistencyIndicatorProps {
  issues: ConsistencyIssue[];
  path: string[];
  className?: string;
}

export const ConsistencyIndicator: React.FC<ConsistencyIndicatorProps> = ({
  issues,
  path,
  className
}) => {
  // Match issues to this path - check if issue path starts with or equals this path
  const relevantIssues = useMemo(() => {
    const pathStr = path.join('.');
    const pathStrAlt = path.join('/');
    
    return issues.filter(issue => {
      // Normalize the issue path for comparison
      const issuePath = issue.path || '';
      
      // Check various path formats
      // Exact match
      if (issuePath === pathStr || issuePath === pathStrAlt) return true;
      
      // Check if issue path starts with this path (for nested issues)
      if (issuePath.startsWith(pathStr + '.') || issuePath.startsWith(pathStr + '/')) return true;
      if (issuePath.startsWith(pathStrAlt + '.') || issuePath.startsWith(pathStrAlt + '/')) return true;
      
      // Check if the path ends with the property name for shorter issue paths
      const lastPathSegment = path[path.length - 1];
      if (lastPathSegment && issuePath.endsWith(lastPathSegment)) {
        // Verify it's a proper match (not just a substring)
        const beforeLastSegment = issuePath.slice(0, -(lastPathSegment.length));
        if (beforeLastSegment === '' || beforeLastSegment.endsWith('.') || beforeLastSegment.endsWith('/')) {
          return true;
        }
      }
      
      return false;
    });
  }, [issues, path]);

  if (relevantIssues.length === 0) return null;

  // Group by severity
  const errorCount = relevantIssues.filter(i => i.severity === 'error').length;
  const warningCount = relevantIssues.filter(i => i.severity === 'warning').length;
  const infoCount = relevantIssues.filter(i => i.severity === 'info').length;

  // Determine the highest severity
  const highestSeverity = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'info';

  const Icon = highestSeverity === 'error' 
    ? AlertCircle 
    : highestSeverity === 'warning' 
      ? AlertTriangle 
      : Info;

  const colorClasses = {
    error: 'text-destructive bg-destructive/10',
    warning: 'text-amber-500 bg-amber-500/10',
    info: 'text-blue-500 bg-blue-500/10'
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            'h-4 px-1 py-0 text-[10px] font-medium cursor-pointer border-0',
            colorClasses[highestSeverity],
            className
          )}
        >
          <Icon className="h-2.5 w-2.5 mr-0.5" />
          {relevantIssues.length}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium text-xs">
            {relevantIssues.length} consistency issue{relevantIssues.length !== 1 ? 's' : ''}
          </p>
          <ul className="text-xs space-y-0.5">
            {relevantIssues.slice(0, 3).map((issue, i) => (
              <li key={i} className="flex items-start gap-1">
                {issue.severity === 'error' && <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />}
                {issue.severity === 'warning' && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />}
                {issue.severity === 'info' && <Info className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />}
                <span className="text-muted-foreground">{issue.message}</span>
              </li>
            ))}
            {relevantIssues.length > 3 && (
              <li className="text-muted-foreground">
                +{relevantIssues.length - 3} more...
              </li>
            )}
          </ul>
          {relevantIssues[0]?.suggestion && (
            <p className="text-xs text-muted-foreground mt-1">
              Suggestion: <span className="font-mono">{relevantIssues[0].suggestion}</span>
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// Helper function to get all issues for a subtree (including nested)
export function getIssuesForPath(issues: ConsistencyIssue[], path: string[]): ConsistencyIssue[] {
  const pathStr = path.join('.');
  const pathStrAlt = path.join('/');
  
  return issues.filter(issue => {
    const issuePath = issue.path || '';
    
    // Exact match or nested under this path
    if (issuePath === pathStr || issuePath === pathStrAlt) return true;
    if (issuePath.startsWith(pathStr + '.') || issuePath.startsWith(pathStr + '/')) return true;
    if (issuePath.startsWith(pathStrAlt + '.') || issuePath.startsWith(pathStrAlt + '/')) return true;
    
    return false;
  });
}

// Get count of issues for a path (useful for parent nodes)
export function getIssueCountForPath(issues: ConsistencyIssue[], path: string[]): number {
  return getIssuesForPath(issues, path).length;
}
