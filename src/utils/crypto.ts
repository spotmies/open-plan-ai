/**
 * Utility functions for encrypting and decrypting data using the Web Crypto API.
 * This provides a basic layer of security for data stored in IndexedDB or localStorage.
 */

import { logger } from '@/services/monitoring/logger';

const KEY_STORAGE_KEY = 'openplan_crypto_key_v2';
const SALT_STORAGE_KEY = 'openplan_crypto_salt_v2';
const LEGACY_KEY_STORAGE_KEY = 'openplan_crypto_key';
const LEGACY_SALT = new TextEncoder().encode('open-plan-ai-offline-storage-salt');
const ITERATIONS = 100000;
const MAX_STRING_PAYLOAD_BYTES = 1024 * 1024;
const MAX_BINARY_PAYLOAD_BYTES = 25 * 1024 * 1024;

let cachedKeyPromise: Promise<CryptoKey> | null = null;
let cachedLegacyKeyPromise: Promise<CryptoKey> | null = null;

function readSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Best effort only in restricted browsing modes.
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getOrCreateSalt(): Uint8Array {
  const stored = readSessionItem(SALT_STORAGE_KEY);
  if (stored) {
    try {
      const bytes = base64ToBytes(stored);
      if (bytes.length >= 16) {
        return bytes;
      }
    } catch {
      // Fall through and regenerate.
    }
  }

  const fresh = crypto.getRandomValues(new Uint8Array(16));
  writeSessionItem(SALT_STORAGE_KEY, bytesToBase64(fresh));
  return fresh;
}

function getOrCreateRawKey(): Uint8Array {
  const existing = readSessionItem(KEY_STORAGE_KEY) || readSessionItem(LEGACY_KEY_STORAGE_KEY);
  if (existing) {
    try {
      const bytes = base64ToBytes(existing);
      if (bytes.length === 32) {
        if (!readSessionItem(KEY_STORAGE_KEY)) {
          writeSessionItem(KEY_STORAGE_KEY, existing);
        }
        return bytes;
      }
    } catch {
      // Fall through and regenerate.
    }
  }

  const fresh = crypto.getRandomValues(new Uint8Array(32));
  writeSessionItem(KEY_STORAGE_KEY, bytesToBase64(fresh));
  return fresh;
}

async function deriveAesKey(rawKey: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    rawKey.buffer as ArrayBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates an encryption key. In a real application, you might derive this
 * from a user session token or password. For this implementation, we'll
 * generate a random key and store it in memory/sessionStorage.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (!cachedKeyPromise) {
    cachedKeyPromise = deriveAesKey(getOrCreateRawKey(), getOrCreateSalt());
  }
  return cachedKeyPromise;
}

async function getLegacyEncryptionKey(): Promise<CryptoKey> {
  if (!cachedLegacyKeyPromise) {
    cachedLegacyKeyPromise = deriveAesKey(getOrCreateRawKey(), LEGACY_SALT);
  }
  return cachedLegacyKeyPromise;
}

/**
 * Encrypts a string payload.
 * Returns an object containing the ciphertext and the IV used, both base64 encoded.
 */
export async function encryptData(payload: string): Promise<{ ciphertext: string; iv: string }> {
  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedPayload = new TextEncoder().encode(payload);
    if (encodedPayload.byteLength > MAX_STRING_PAYLOAD_BYTES) {
      throw new Error('Payload too large to encrypt safely');
    }

    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource
      },
      key,
      encodedPayload as unknown as BufferSource
    );

    // Convert to base64 for easier storage
    const ciphertextBase64 = bytesToBase64(new Uint8Array(encryptedContent));
    const ivBase64 = bytesToBase64(iv);

    return { ciphertext: ciphertextBase64, iv: ivBase64 };
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts a previously encrypted payload.
 */
export async function decryptData(encryptedData: { ciphertext: string; iv: string }): Promise<string> {
  try {
    // Decode from base64
    const ivBytes = base64ToBytes(encryptedData.iv);
    const cipherBytes = base64ToBytes(encryptedData.ciphertext);
    if (ivBytes.byteLength !== 12) {
      throw new Error('Invalid IV length');
    }

    let decryptedContent: ArrayBuffer;
    try {
      const key = await getEncryptionKey();
      decryptedContent = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes as unknown as BufferSource,
        },
        key,
        cipherBytes as unknown as BufferSource
      );
    } catch {
      const legacyKey = await getLegacyEncryptionKey();
      decryptedContent = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes as unknown as BufferSource,
        },
        legacyKey,
        cipherBytes as unknown as BufferSource
      );
    }

    return new TextDecoder().decode(decryptedContent);
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Helper to encrypt a JSON object.
 */
export async function encryptObject(obj: unknown): Promise<{ ciphertext: string; iv: string }> {
  return encryptData(JSON.stringify(obj));
}

/**
 * Helper to decrypt back to a JSON object.
 */
export async function decryptObject<T>(encryptedData: { ciphertext: string; iv: string } | undefined): Promise<T | null> {
  if (!encryptedData || !encryptedData.ciphertext || !encryptedData.iv) {
    return null;
  }

  try {
    const decryptedString = await decryptData(encryptedData);
    return JSON.parse(decryptedString) as T;
  } catch (err) {
    logger.error('Failed to decrypt object:', err);
    return null;
  }
}

/**
 * Encrypts an ArrayBuffer payload directly.
 */
export async function encryptArrayBuffer(buffer: ArrayBuffer): Promise<{ ciphertext: ArrayBuffer; iv: ArrayBuffer }> {
  try {
    if (buffer.byteLength > MAX_BINARY_PAYLOAD_BYTES) {
      throw new Error('Binary payload too large to encrypt safely');
    }

    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource
      },
      key,
      buffer as unknown as BufferSource
    );

    return { ciphertext: encryptedContent, iv: iv.buffer as ArrayBuffer };
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt ArrayBuffer');
  }
}

/**
 * Decrypts an ArrayBuffer payload directly.
 */
export async function decryptArrayBuffer(encryptedData: { ciphertext: ArrayBuffer; iv: ArrayBuffer }): Promise<ArrayBuffer> {
  try {
    if (encryptedData.iv.byteLength !== 12) {
      throw new Error('Invalid IV length');
    }

    let decryptedContent: ArrayBuffer;
    try {
      const key = await getEncryptionKey();
      decryptedContent = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: encryptedData.iv as unknown as BufferSource,
        },
        key,
        encryptedData.ciphertext as unknown as BufferSource
      );
    } catch {
      const legacyKey = await getLegacyEncryptionKey();
      decryptedContent = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: encryptedData.iv as unknown as BufferSource,
        },
        legacyKey,
        encryptedData.ciphertext as unknown as BufferSource
      );
    }

    return decryptedContent;
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt ArrayBuffer');
  }
}
