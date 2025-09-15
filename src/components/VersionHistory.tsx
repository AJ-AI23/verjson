import React, { useState, useMemo } from 'react';
import { SchemaPatch, formatVersion, applySelectedPatches } from '@/lib/versionUtils';
import { DocumentVersionComparison } from '@/lib/importVersionUtils';
import { ImportVersionDialog } from './ImportVersionDialog';
import { useDocumentVersions } from '@/hooks/useDocumentVersions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Package, Tag, Trash2, Eye, Download, FileCheck } from 'lucide-react';
import { ImportReviewDialog } from '@/components/ImportReviewDialog';

interface VersionHistoryProps {
  documentId: string;
  userRole?: 'owner' | 'editor' | 'viewer' | null;
  isOwner?: boolean;
  onToggleSelection?: (patchId: string) => void;
  onMarkAsReleased?: (patchId: string) => void;
  onDeleteVersion?: (patchId: string) => void;
  onImportVersion?: (importedSchema: any, comparison: DocumentVersionComparison, sourceDocumentName: string) => void;
  currentSchema?: any;
  currentFileType?: string;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ 
  documentId, 
  userRole,
  isOwner,
  onToggleSelection, 
  onMarkAsReleased, 
  onDeleteVersion,
  onImportVersion,
  currentSchema,
  currentFileType
}) => {
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPatches, setPreviewPatches] = useState<SchemaPatch[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedVersionForReview, setSelectedVersionForReview] = useState<string | null>(null);
  
  // Fetch document versions directly from database - use versions state directly for reactivity
  const { versions, userRole: hookUserRole, loading, error } = useDocumentVersions(documentId);
  
  // Use userRole from hook if available, otherwise fall back to prop
  const effectiveUserRole = hookUserRole || userRole;
  
  // Convert versions to patches - memoize to avoid unnecessary recalculations
  const patches = useMemo(() => {
    if (!versions.length) return [];
    
    const convertedPatches = versions.map(version => ({
      id: version.id,
      timestamp: new Date(version.created_at).getTime(),
      version: {
        major: version.version_major,
        minor: version.version_minor,
        patch: version.version_patch,
      },
      description: version.description,
      patches: (() => {
        try {
          return version.patches && typeof version.patches === 'string' 
            ? JSON.parse(version.patches) 
            : version.patches || undefined;
        } catch (e) {
          return undefined;
        }
      })(),
      tier: version.tier,
      isReleased: version.is_released,
      fullDocument: version.full_document || undefined,
      isSelected: version.is_selected,
      status: version.status || 'visible',
    }));
    
    return convertedPatches;
  }, [versions]);
  
  // Fetch document information
  const [documentInfo, setDocumentInfo] = useState<any>(null);
  
  React.useEffect(() => {
    const fetchDocumentInfo = async () => {
      if (!documentId) return;
      
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();
          
        if (error) {
          console.error('Failed to fetch document info:', error);
        } else {
          setDocumentInfo(data);
        }
      } catch (err) {
        console.error('Error fetching document info:', err);
      }
    };
    
    fetchDocumentInfo();
  }, [documentId]);
  
  
  // Calculate current schema based on selected patches from database
  const calculatedCurrentSchema = useMemo(() => {
    try {
      return applySelectedPatches(patches);
    } catch (err) {
      console.error('🚨 VersionHistory: Error calculating current schema:', err);
      return {};
    }
  }, [patches]);
  
  // Handle preview of what schema would look like with different selections
  const handlePreview = (patchId: string, wouldBeSelected: boolean) => {
    const targetPatch = patches.find(p => p.id === patchId);
    if (!targetPatch) return;
    
    const updatedPatches = patches.map(p => 
      p.id === patchId ? { ...p, isSelected: wouldBeSelected } : p
    );
    
    setPreviewPatches(updatedPatches);
    setPreviewOpen(true);
  };
  
  // Calculate preview schema - only apply patches up to the target timestamp
  const previewSchema = useMemo(() => {
    if (previewPatches.length === 0) return {};
    
    // Find the target patch timestamp
    const targetPatch = previewPatches.find(p => p.isSelected !== patches.find(orig => orig.id === p.id)?.isSelected);
    const targetTimestamp = targetPatch?.timestamp;
    
    try {
      return applySelectedPatches(previewPatches, targetTimestamp);
    } catch (err) {
      console.error('🚨 VersionHistory: Error calculating preview schema:', err);
      return {};
    }
  }, [previewPatches, patches]);
  
  // Handle import version
  const handleImportVersion = (importedSchema: any, comparison: DocumentVersionComparison, sourceDocumentName: string) => {
    onImportVersion?.(importedSchema, comparison, sourceDocumentName);
    setImportDialogOpen(false);
  };

  // Handle review version
  const handleReviewVersion = (versionId: string) => {
    setSelectedVersionForReview(versionId);
    setReviewDialogOpen(true);
  };

  // Get summary of schema for display
  const getSchemaSummary = (schema: any) => {
    if (!schema || typeof schema !== 'object') return 'Empty schema';
    
    const keys = Object.keys(schema);
    if (keys.length === 0) return 'Empty schema';
    
    const summary = [];
    if (schema.info?.title) summary.push(`Title: ${schema.info.title}`);
    if (schema.info?.version) summary.push(`Version: ${schema.info.version}`);
    if (schema.paths) summary.push(`Paths: ${Object.keys(schema.paths).length}`);
    if (schema.components?.schemas) summary.push(`Schemas: ${Object.keys(schema.components.schemas).length}`);
    
    // For JSON Schema, also check for schema-specific properties
    if (schema.title) summary.push(`Title: ${schema.title}`);
    if (schema.properties) summary.push(`Properties: ${Object.keys(schema.properties).length}`);
    if (schema.type) summary.push(`Type: ${schema.type}`);
    
    return summary.length > 0 ? summary.join(', ') : `${keys.length} top-level properties`;
  };
  
  if (patches.length === 0) {
    return (
      <div className="text-sm text-slate-500 p-4 text-center">
        No version history yet
      </div>
    );
  }

  // Sort patches by timestamp, newest first (descending order)
  const sortedPatches = [...patches].sort((a, b) => b.timestamp - a.timestamp);
  
  // Check if a patch is before a released version (but allow initial version to be deselected)
  const isBeforeReleased = (patch: SchemaPatch) => {
    const patchIndex = sortedPatches.findIndex(p => p.id === patch.id);
    // With newest first order, check earlier indices (which are newer timestamps)
    return sortedPatches.slice(0, patchIndex).some(p => p.isReleased && p.description !== 'Initial version');
  };
  
  // Check if this is the initial version
  const isInitialVersion = (patch: SchemaPatch) => {
    return patch.description === 'Initial version' && patch.isReleased;
  };
  
  // Check if a patch can be deselected
  const canDeselect = (patch: SchemaPatch) => {
    if (isInitialVersion(patch)) return false; // Cannot deselect initial version
    if (patch.isReleased) return false; // Cannot deselect released versions
    return !(isBeforeReleased(patch) && patch.isSelected);
  };
  
  // Check if a version can be deleted
  const canDelete = (patch: SchemaPatch) => {
    if (isInitialVersion(patch)) return false;
    
    // Check if this is a released version with later versions
    const patchIndex = sortedPatches.findIndex(p => p.id === patch.id);
    // With newest first order, check earlier indices (which are newer timestamps)
    const hasLaterVersions = sortedPatches.slice(0, patchIndex).length > 0;
    
    return !(patch.isReleased && hasLaterVersions);
  };
  
  return (
    <div className="version-history overflow-auto max-h-[400px]">
      {/* Document Information Panel */}
      {documentInfo && (
        <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="font-medium text-green-800 mb-3">Document Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong className="text-green-700">Document ID:</strong>
              <div className="font-mono text-xs bg-white p-2 rounded border break-all">{documentInfo.id}</div>
            </div>
            <div>
              <strong className="text-green-700">File Name:</strong>
              <div className="font-medium">{documentInfo.name}</div>
            </div>
            <div>
              <strong className="text-green-700">File Type:</strong>
              <div>
                <Badge variant="outline" className="text-xs">
                  {documentInfo.file_type}
                </Badge>
              </div>
            </div>
            <div>
              <strong className="text-green-700">Workspace ID:</strong>
              <div className="font-mono text-xs bg-white p-1 rounded border break-all">{documentInfo.workspace_id}</div>
            </div>
            <div>
              <strong className="text-green-700">Created:</strong>
              <div className="text-xs">{new Date(documentInfo.created_at).toLocaleString()}</div>
            </div>
            <div>
              <strong className="text-green-700">Last Updated:</strong>
              <div className="text-xs">{new Date(documentInfo.updated_at).toLocaleString()}</div>
            </div>
            <div>
              <strong className="text-green-700">Content Keys:</strong>
              <div className="font-mono text-xs">
                {documentInfo.content ? Object.keys(documentInfo.content).join(', ') : 'No content'}
              </div>
            </div>
            <div>
              <strong className="text-green-700">User ID:</strong>
              <div className="font-mono text-xs bg-white p-1 rounded border break-all">{documentInfo.user_id}</div>
            </div>
          </div>
        </div>
      )}

      
      {/* Version History Table */}
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Select</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Version</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
            {(onMarkAsReleased || onDeleteVersion) && (
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {sortedPatches.map((patch, index) => {
            const beforeReleased = isBeforeReleased(patch);
            const isInitial = isInitialVersion(patch);
            const canDeselectPatch = canDeselect(patch);
            return (
              <tr key={patch.id} className={`hover:bg-slate-50 ${patch.isSelected ? 'bg-blue-50' : ''} ${isInitial ? 'border-l-4 border-l-blue-500' : ''}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={patch.isSelected}
                      disabled={!canDeselectPatch && patch.isSelected}
                      onCheckedChange={(checked) => {
                         if (onToggleSelection) {
                           onToggleSelection(patch.id);
                         }
                       }}
                      title={
                        isInitial ? 'Initial version - foundation document (cannot be deselected)' :
                        beforeReleased && patch.isSelected ? 'Cannot deselect versions before a released version' : 
                        'Toggle version selection'
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-slate-500 hover:text-slate-700"
                      onClick={() => handlePreview(patch.id, patch.isSelected)}
                      title="Preview schema with current version selections"
                    >
                      <Eye size={12} />
                    </Button>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    {formatVersion(patch.version)}
                    {patch.isReleased && (
                      <Badge variant={isInitial ? "default" : "secondary"} className="text-xs">
                        <Package size={10} className="mr-1" />
                        {isInitial ? 'Initial' : 'Released'}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span title={patch.description} className={isInitial ? 'font-medium text-blue-700' : ''}>
                    {patch.description.length > 25 
                      ? `${patch.description.slice(0, 25)}...` 
                      : patch.description}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500 text-xs">
                  {new Date(patch.timestamp).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={
                    patch.tier === 'major' ? 'destructive' : 
                    patch.tier === 'minor' ? 'default' : 
                    'secondary'
                  } className="text-xs">
                    {patch.tier}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {patch.isSelected ? (
                    <Badge variant="default" className="text-xs">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                      Applied
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <span className="w-2 h-2 bg-slate-400 rounded-full mr-1"></span>
                      Skipped
                    </Badge>
                  )}
                </td>
                {(onMarkAsReleased || onDeleteVersion) && (
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {patch.status === 'pending' && (effectiveUserRole === 'owner' || effectiveUserRole === 'editor') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleReviewVersion(patch.id)}
                          title="Review this pending version"
                        >
                          <FileCheck size={10} />
                          Review
                        </Button>
                      )}
                      
                      {onMarkAsReleased && !patch.isReleased && !isInitial && patch.isSelected && effectiveUserRole !== 'viewer' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1"
                          onClick={() => onMarkAsReleased(patch.id)}
                          title="Mark this version as released"
                        >
                          <Tag size={10} />
                          Release
                        </Button>
                      )}
                      
                      {onDeleteVersion && canDelete(patch) && effectiveUserRole === 'owner' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete this version"
                            >
                              <Trash2 size={10} />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                           <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
                             <AlertDialogHeader>
                               <AlertDialogTitle>Delete Version</AlertDialogTitle>
                             </AlertDialogHeader>
                             <div className="overflow-y-auto max-h-[60vh] pr-2">
                               <AlertDialogDescription className="space-y-3">
                                 <div>
                                   Are you sure you want to delete version {formatVersion(patch.version)}?
                                   {patch.description && ` (${patch.description})`}
                                 </div>
                                 
                                 {patch.patches && patch.patches.length > 0 && (
                                   <div className="mt-4">
                                     <div className="text-sm font-medium text-slate-700 mb-2">
                                       Affected Changes ({patch.patches.length} operations):
                                     </div>
                                     <div className="bg-slate-50 rounded-md p-3 text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
                                       {patch.patches.slice(0, 20).map((operation: any, idx: number) => (
                                         <div key={idx} className="flex gap-2">
                                           <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                             operation.op === 'add' ? 'bg-green-100 text-green-700' :
                                             operation.op === 'remove' ? 'bg-red-100 text-red-700' :
                                             'bg-blue-100 text-blue-700'
                                           }`}>
                                             {operation.op}
                                           </span>
                                           <span className="text-slate-600">{operation.path || '/'}</span>
                                         </div>
                                       ))}
                                       {patch.patches.length > 20 && (
                                         <div className="text-slate-500 text-center py-2">
                                           ... and {patch.patches.length - 20} more changes
                                         </div>
                                       )}
                                     </div>
                                   </div>
                                 )}
                                 
                                 <div className="text-sm text-red-600 font-medium">
                                   This action cannot be undone.
                                 </div>
                               </AlertDialogDescription>
                             </div>
                             <AlertDialogFooter className="mt-4">
                               <AlertDialogCancel>Cancel</AlertDialogCancel>
                               <AlertDialogAction
                                 className="bg-red-600 hover:bg-red-700"
                                 onClick={() => onDeleteVersion(patch.id)}
                               >
                                 Delete
                               </AlertDialogAction>
                             </AlertDialogFooter>
                           </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Schema Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Debug Information Panel */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-3">Preview Generation Details</h4>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong className="text-blue-700">Document ID:</strong>
                    <div className="font-mono text-xs bg-white p-1 rounded border">{documentId}</div>
                  </div>
                  <div>
                    <strong className="text-blue-700">Total Versions Available:</strong>
                    <div className="font-mono">{previewPatches.length}</div>
                  </div>
                </div>
                
                <div>
                  <strong className="text-blue-700">Versions Applied (in chronological order):</strong>
                  <div className="mt-1 space-y-1">
                    {previewPatches
                      .sort((a, b) => a.timestamp - b.timestamp)
                      .map((patch, index) => (
                        <div key={patch.id} className="flex items-center gap-2 p-2 bg-white rounded border text-xs">
                          <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <div className="font-semibold">v{formatVersion(patch.version)} - {patch.description}</div>
                            <div className="text-gray-600">
                              Selected: {patch.isSelected ? '✅' : '❌'} | 
                              Released: {patch.isReleased ? '✅' : '❌'} | 
                              Has Full Document: {patch.fullDocument ? '✅' : '❌'} | 
                              Has Patches: {patch.patches ? '✅' : '❌'}
                            </div>
                            {patch.fullDocument && (
                              <div className="text-green-600">
                                Full Document Keys: {Object.keys(patch.fullDocument).join(', ')}
                              </div>
                            )}
                            {patch.patches && (
                              <div className="text-orange-600">
                                Patches Count: {patch.patches.length}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(patch.timestamp).toLocaleString()}
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <strong className="text-blue-700">Selected Versions Only:</strong>
                  <div className="font-mono text-xs">
                    {previewPatches.filter(p => p.isSelected).map(p => `v${formatVersion(p.version)}`).join(' → ') || 'None selected'}
                  </div>
                </div>
                
                <div>
                  <strong className="text-blue-700">Base Version (Latest Released & Selected):</strong>
                  <div className="font-mono text-xs">
                    {(() => {
                      const baseVersion = [...previewPatches]
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .find(p => p.isReleased && p.isSelected);
                      return baseVersion ? `v${formatVersion(baseVersion.version)} (${baseVersion.description})` : 'No base version found';
                    })()}
                  </div>
                </div>
                
                <div>
                  <strong className="text-blue-700">Final Schema Keys:</strong>
                  <div className="font-mono text-xs bg-white p-1 rounded border">
                    {Object.keys(previewSchema || {}).length > 0 ? Object.keys(previewSchema).join(', ') : 'EMPTY - No keys found'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-slate-50 rounded">
              <h4 className="font-medium text-slate-700 mb-2">Summary</h4>
              <p className="text-sm text-slate-600">{getSchemaSummary(previewSchema)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <h4 className="font-medium text-slate-700 mb-2">Full Schema (JSON)</h4>
              <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96 text-slate-800">
                {JSON.stringify(previewSchema, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Version Dialog */}
      {onImportVersion && (currentSchema || calculatedCurrentSchema) && currentFileType && (
        <ImportVersionDialog
          isOpen={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          currentSchema={currentSchema || calculatedCurrentSchema}
          onImportConfirm={handleImportVersion}
          currentDocumentId={documentId}
          currentFileType={currentFileType}
        />
      )}

      {/* Review Dialog */}
      <ImportReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        documentId={documentId}
        versionId={selectedVersionForReview || ''}
        document={{
          name: documentInfo?.name || 'Document',
          content: currentSchema || calculatedCurrentSchema
        }}
      />
    </div>
  );
};
