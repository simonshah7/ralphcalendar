'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SolarCloseLinear, SolarFolderLinear } from './SolarIcons';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  isFolder: boolean;
}

interface DriveBrowserProps {
  open: boolean;
  onClose: () => void;
}

function formatFileSize(bytes?: string): string {
  if (!bytes) return '';
  const n = parseInt(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getFileIcon(mimeType: string): string {
  if (mimeType.includes('folder')) return '\uD83D\uDCC1';
  if (mimeType.includes('document') || mimeType.includes('word')) return '\uD83D\uDCC4';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '\uD83D\uDCCA';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '\uD83D\uDCCA';
  if (mimeType.includes('pdf')) return '\uD83D\uDCC4';
  if (mimeType.includes('image')) return '\uD83D\uDDBC\uFE0F';
  if (mimeType.includes('video')) return '\uD83C\uDFA5';
  return '\uD83D\uDCC4';
}

export function DriveBrowser({ open, onClose }: DriveBrowserProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [fileContent, setFileContent] = useState<{ content: string; name: string } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : undefined;

  const loadFiles = useCallback(async (folderId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = folderId ? `?folderId=${folderId}` : '';
      const res = await fetch(`/api/drive${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load files');
      }
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setFolderStack([]);
      setFileContent(null);
      loadFiles();
    }
  }, [open, loadFiles]);

  const navigateToFolder = (file: DriveFile) => {
    setFolderStack((prev) => [...prev, { id: file.id, name: file.name }]);
    setFileContent(null);
    loadFiles(file.id);
  };

  const navigateBack = (index: number) => {
    if (index < 0) {
      setFolderStack([]);
      setFileContent(null);
      loadFiles();
    } else {
      const newStack = folderStack.slice(0, index + 1);
      setFolderStack(newStack);
      setFileContent(null);
      loadFiles(newStack[newStack.length - 1].id);
    }
  };

  const openFile = async (file: DriveFile) => {
    // Try to read content for text-based files
    const readableTypes = [
      'document', 'spreadsheet', 'text/', 'json', 'csv', 'xml',
    ];
    const canRead = readableTypes.some((t) => file.mimeType.includes(t));

    if (canRead) {
      setLoadingFile(true);
      try {
        const res = await fetch(`/api/drive/${file.id}`);
        if (res.ok) {
          const data = await res.json();
          setFileContent({ content: data.content, name: data.name });
        }
      } catch {
        // Fall back to opening in Drive
        if (file.webViewLink) window.open(file.webViewLink, '_blank');
      } finally {
        setLoadingFile(false);
      }
    } else if (file.webViewLink) {
      window.open(file.webViewLink, '_blank');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-4 sm:inset-8 lg:inset-16 bg-card border border-card-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-card-border">
              <div className="flex items-center gap-2">
                <SolarFolderLinear className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-foreground">Google Drive</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <SolarCloseLinear className="w-5 h-5" />
              </button>
            </div>

            {/* Breadcrumb */}
            <div className="px-5 py-2 border-b border-card-border flex items-center gap-1 text-sm overflow-x-auto">
              <button
                onClick={() => navigateBack(-1)}
                className="text-accent-purple-btn hover:underline flex-shrink-0"
              >
                Root
              </button>
              {folderStack.map((folder, i) => (
                <span key={folder.id} className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-muted-foreground">/</span>
                  <button
                    onClick={() => navigateBack(i)}
                    className={i === folderStack.length - 1 ? 'text-foreground font-medium' : 'text-accent-purple-btn hover:underline'}
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* File List */}
              <div className={`${fileContent ? 'w-1/2 border-r border-card-border' : 'w-full'} overflow-y-auto`}>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-accent-purple-btn border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : error ? (
                  <div className="p-5 text-center">
                    <p className="text-sm text-red-500 mb-2">{error}</p>
                    <p className="text-xs text-muted-foreground">
                      Make sure your Google Drive folder ID and service account are configured in Settings.
                    </p>
                  </div>
                ) : files.length === 0 ? (
                  <div className="p-5 text-center text-muted-foreground text-sm">
                    No files in this folder.
                  </div>
                ) : (
                  <div className="divide-y divide-card-border">
                    {files.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => file.isFolder ? navigateToFolder(file) : openFile(file)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="text-lg flex-shrink-0">{getFileIcon(file.mimeType)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {file.size && <span>{formatFileSize(file.size)}</span>}
                            {file.modifiedTime && <span>{formatDate(file.modifiedTime)}</span>}
                          </div>
                        </div>
                        {file.isFolder && (
                          <span className="text-muted-foreground text-xs">&#x203A;</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* File Content Preview */}
              {fileContent && (
                <div className="w-1/2 flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-card-border bg-muted/30">
                    <span className="text-sm font-medium text-foreground truncate">{fileContent.name}</span>
                    <button
                      onClick={() => setFileContent(null)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono">
                      {fileContent.content}
                    </pre>
                  </div>
                </div>
              )}

              {loadingFile && (
                <div className="absolute inset-0 bg-card/50 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-accent-purple-btn border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
