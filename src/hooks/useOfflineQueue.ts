import { useEffect, useRef, useState, useCallback } from 'react';
import { chatService } from '@/services/chat.service';
import { toast } from 'sonner';
import { logger } from '@/services/monitoring/logger';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const MAX_QUEUE_FILE_SIZE = 10 * 1024 * 1024;

// ── Types ──────────────────────────────────────────────────────────────────

export type QueuedTextMessage = {
  id: string;
  kind: 'text';
  conversationId: string;
  content: string;
  timestamp: number;
};

export type QueuedFileMessage = {
  id: string;
  kind: 'file';
  conversationId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  data: ArrayBuffer; // stored in IndexedDB
  caption?: string;
  timestamp: number;
};

export type QueuedItem = QueuedTextMessage | QueuedFileMessage;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Sanitize file name for storage path: no path traversal, only safe chars. */
function sanitizeFileName(name: string): string {
  const basename = name.replace(/^.*[/\\]/, '');
  const safe = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe || 'file';
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `legacy-${Date.now()}-${random}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

import { encryptObject, decryptObject, encryptArrayBuffer, decryptArrayBuffer } from '@/utils/crypto';

// ── IndexedDB helpers ──────────────────────────────────────────────────────

const DB_NAME = 'openplan_offline_queue';
const DB_VERSION = 1;
const STORE = 'queue';

// The record type actually stored in IndexedDB
type SecureStoreRecord = {
  id: string;
  encryptedMetadata: { ciphertext: string; iv: string };
  encryptedData?: { ciphertext: ArrayBuffer; iv: ArrayBuffer };
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(): Promise<QueuedItem[]> {
  try {
    const db = await openDB();
    const records = await new Promise<SecureStoreRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as SecureStoreRecord[]);
      req.onerror = () => reject(req.error);
    });

    const decryptedItems: QueuedItem[] = [];
    for (const record of records) {
      try {
        const metadata = await decryptObject<any>(record.encryptedMetadata);
        if (!metadata) continue;

        if (metadata.kind === 'file' && record.encryptedData) {
          const originalData = await decryptArrayBuffer(record.encryptedData);
          metadata.data = originalData;
        }

        decryptedItems.push({ id: record.id, ...metadata } as QueuedItem);
      } catch (err) {
        logger.error('[OfflineQueue] Failed to decrypt item', record.id, err);
      }
    }
    return decryptedItems;
  } catch (err) {
    logger.error('[OfflineQueue] dbGetAll failed:', err);
    return [];
  }
}

async function dbPut(item: QueuedItem): Promise<void> {
  try {
    const db = await openDB();
    
    // Separate data from metadata for file messages
    const metadata: any = { ...item };
    delete metadata.id; // Store ID at the root level for IndexedDB
    
    let encryptedData;
    if (item.kind === 'file') {
      encryptedData = await encryptArrayBuffer(item.data);
      delete metadata.data;
    }

    const encryptedMetadata = await encryptObject(metadata);

    const recordToStore: SecureStoreRecord = {
      id: item.id,
      encryptedMetadata,
      encryptedData
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(recordToStore);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    logger.error('[OfflineQueue] dbPut failed:', err);
    throw err;
  }
}

async function dbDelete(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'));
    });
  } catch (err) {
    logger.error('[OfflineQueue] dbDelete failed', id, err);
    throw err;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useOfflineQueue(userId: string | undefined) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const isFlushing = useRef(false);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh count from DB
  const refreshCount = useCallback(async () => {
    const items = await dbGetAll();
    setPendingCount(items.length);
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Flush the queue – send all pending items in order
  const flush = useCallback(async () => {
    if (isFlushing.current || !userId) return;
    isFlushing.current = true;

    try {
      const items = await dbGetAll();
      if (items.length === 0) return;

      const validItems = items.filter(
        (item) => typeof item.timestamp === 'number' && !Number.isNaN(item.timestamp)
      );
      if (validItems.length !== items.length) {
        logger.warn('[OfflineQueue] Some items had invalid timestamps and were skipped');
      }
      validItems.sort((a, b) => a.timestamp - b.timestamp);

      let sentCount = 0;
      let failedCount = 0;
      let firstFailureDelayMs: number | null = null;

      const sendQueuedItem = async (item: QueuedItem) => {
        if (item.kind === 'text') {
          await chatService.sendMessage(item.conversationId, item.content);
          return;
        }

        // File attachments are not yet supported — skip silently
        logger.warn('[OfflineQueue] File attachments not yet supported, skipping item', item.id);
        throw new Error('File attachments are not yet supported in this backend version.');
      };

      for (const item of validItems) {
        try {
          let sent = false;
          for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
            try {
              await sendQueuedItem(item);
              sent = true;
              break;
            } catch (err) {
              if (attempt === MAX_RETRY_ATTEMPTS) {
                throw err;
              }
              const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
              await sleep(delay);
            }
          }

          if (!sent) {
            failedCount++;
            continue;
          }

          await dbDelete(item.id);
          sentCount++;
        } catch (err) {
          logger.error('[OfflineQueue] Failed to send queued item', item.id, err);
          failedCount++;
          if (firstFailureDelayMs === null) {
            firstFailureDelayMs = RETRY_BASE_DELAY_MS * 2 ** (MAX_RETRY_ATTEMPTS - 1);
          }
        }
      }

      if (sentCount > 0) {
        toast.success(`📤 ${sentCount} queued message${sentCount > 1 ? 's' : ''} sent`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} message(s) could not be sent after retries. They remain in the queue.`);
        if (isOnline && firstFailureDelayMs !== null) {
          if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = setTimeout(() => {
            flushTimeoutRef.current = null;
            flush();
          }, firstFailureDelayMs);
        }
      }
    } finally {
      isFlushing.current = false;
      refreshCount();
    }
  }, [userId, refreshCount]);

  // Online / offline listeners (debounce flush to avoid rapid repeated calls)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.info('🌐 Back online — sending queued messages…');
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = setTimeout(() => {
        flushTimeoutRef.current = null;
        flush();
      }, 300);
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('📵 No internet — messages will be queued and sent when reconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flush]);

  // Enqueue a text message
  const enqueueText = useCallback(async (conversationId: string, content: string) => {
    const trimmed = content.trim();
    if (!conversationId || !trimmed) {
      throw new Error('Cannot queue an empty text message.');
    }

    const item: QueuedTextMessage = {
      id: createUuid(),
      kind: 'text',
      conversationId,
      content: trimmed,
      timestamp: Date.now(),
    };
    await dbPut(item);
    refreshCount();
  }, [refreshCount]);

  // File offline-queuing is not yet supported by the backend.
  // Reject immediately so the caller shows the user a clear error
  // rather than silently storing a file that will never be flushed.
  const enqueueFile = useCallback(
    (_conversationId: string, _file: File, _caption?: string): Promise<void> =>
      Promise.reject(
        new Error(
          'File messages cannot be sent while offline. ' +
          'Please reconnect and try sending the file again.'
        )
      ),
    []
  );

  return { isOnline, pendingCount, enqueueText, enqueueFile, flush };
}
