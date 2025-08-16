/**
 * Secure Storage System
 * Encrypted local storage for sensitive data with key management
 */

// Encryption utilities
export class CryptoManager {
  private static instance: CryptoManager;
  private masterKey: CryptoKey | null = null;
  private keyCache: Map<string, CryptoKey> = new Map();

  private constructor() {}

  static getInstance(): CryptoManager {
    if (!CryptoManager.instance) {
      CryptoManager.instance = new CryptoManager();
    }
    return CryptoManager.instance;
  }

  // Generate a new encryption key
  async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  // Derive key from password
  async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Export key to raw format
  async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.exportKey('raw', key);
  }

  // Import key from raw format
  async importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt data
  async encrypt(data: string, key: CryptoKey): Promise<{
    encrypted: ArrayBuffer;
    iv: Uint8Array;
  }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encoder.encode(data)
    );

    return { encrypted, iv };
  }

  // Decrypt data
  async decrypt(encryptedData: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  // Generate salt
  generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  // Set master key
  setMasterKey(key: CryptoKey): void {
    this.masterKey = key;
  }

  // Get master key
  getMasterKey(): CryptoKey | null {
    return this.masterKey;
  }

  // Cache key with identifier
  cacheKey(identifier: string, key: CryptoKey): void {
    this.keyCache.set(identifier, key);
  }

  // Get cached key
  getCachedKey(identifier: string): CryptoKey | null {
    return this.keyCache.get(identifier) || null;
  }

  // Clear key cache
  clearKeyCache(): void {
    this.keyCache.clear();
  }
}

// Secure storage interface
export interface SecureStorageOptions {
  encrypt?: boolean;
  compress?: boolean;
  ttl?: number; // Time to live in milliseconds
  keyId?: string; // Key identifier for encryption
}

export interface StoredData {
  data: string;
  encrypted: boolean;
  compressed: boolean;
  timestamp: number;
  ttl?: number;
  iv?: string; // Base64 encoded IV for encrypted data
  keyId?: string;
  checksum: string;
}

// Secure storage class
export class SecureStorage {
  private static instance: SecureStorage;
  private cryptoManager: CryptoManager;
  private storagePrefix = 'schoolCopilot_secure_';

  private constructor() {
    this.cryptoManager = CryptoManager.getInstance();
  }

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  // Initialize with master password
  async initialize(masterPassword?: string): Promise<void> {
    if (masterPassword) {
      const salt = this.getOrCreateSalt();
      const masterKey = await this.cryptoManager.deriveKeyFromPassword(masterPassword, salt);
      this.cryptoManager.setMasterKey(masterKey);
    } else {
      // Generate a session key if no password provided
      const sessionKey = await this.cryptoManager.generateKey();
      this.cryptoManager.setMasterKey(sessionKey);
    }
  }

  // Get or create salt for key derivation
  private getOrCreateSalt(): Uint8Array {
    const saltKey = this.storagePrefix + 'salt';
    let saltBase64 = localStorage.getItem(saltKey);
    
    if (!saltBase64) {
      const salt = this.cryptoManager.generateSalt();
      saltBase64 = this.arrayBufferToBase64(salt);
      localStorage.setItem(saltKey, saltBase64);
    }
    
    return this.base64ToArrayBuffer(saltBase64);
  }

  // Store data securely
  async setItem(
    key: string, 
    value: any, 
    options: SecureStorageOptions = {}
  ): Promise<void> {
    const {
      encrypt = true,
      compress = false,
      ttl,
      keyId = 'master'
    } = options;

    try {
      let dataString = JSON.stringify(value);
      let iv: Uint8Array | undefined;
      let encryptionKey: CryptoKey | null = null;

      // Compress if requested
      if (compress) {
        // Simple compression using JSON.stringify optimization
        dataString = this.compress(dataString);
      }

      // Encrypt if requested
      if (encrypt) {
        encryptionKey = keyId === 'master' 
          ? this.cryptoManager.getMasterKey()
          : this.cryptoManager.getCachedKey(keyId);

        if (!encryptionKey) {
          throw new Error(`Encryption key not found: ${keyId}`);
        }

        const encrypted = await this.cryptoManager.encrypt(dataString, encryptionKey);
        dataString = this.arrayBufferToBase64(encrypted.encrypted);
        iv = encrypted.iv;
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(dataString);

      // Create stored data object
      const storedData: StoredData = {
        data: dataString,
        encrypted,
        compressed: compress,
        timestamp: Date.now(),
        ttl,
        iv: iv ? this.arrayBufferToBase64(iv) : undefined,
        keyId: encrypt ? keyId : undefined,
        checksum
      };

      // Store in localStorage
      const storageKey = this.storagePrefix + key;
      localStorage.setItem(storageKey, JSON.stringify(storedData));

    } catch (error) {
      console.error('SecureStorage.setItem failed:', error);
      throw new Error(`Failed to store data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Retrieve data securely
  async getItem<T = any>(key: string): Promise<T | null> {
    try {
      const storageKey = this.storagePrefix + key;
      const storedDataString = localStorage.getItem(storageKey);
      
      if (!storedDataString) {
        return null;
      }

      const storedData: StoredData = JSON.parse(storedDataString);

      // Check TTL
      if (storedData.ttl && Date.now() - storedData.timestamp > storedData.ttl) {
        this.removeItem(key);
        return null;
      }

      // Verify checksum
      const expectedChecksum = await this.calculateChecksum(storedData.data);
      if (storedData.checksum !== expectedChecksum) {
        console.warn('Data integrity check failed for key:', key);
        this.removeItem(key);
        return null;
      }

      let dataString = storedData.data;

      // Decrypt if encrypted
      if (storedData.encrypted) {
        if (!storedData.iv || !storedData.keyId) {
          throw new Error('Missing encryption metadata');
        }

        const encryptionKey = storedData.keyId === 'master'
          ? this.cryptoManager.getMasterKey()
          : this.cryptoManager.getCachedKey(storedData.keyId);

        if (!encryptionKey) {
          throw new Error(`Decryption key not found: ${storedData.keyId}`);
        }

        const encryptedData = this.base64ToArrayBuffer(dataString);
        const iv = this.base64ToArrayBuffer(storedData.iv);
        
        dataString = await this.cryptoManager.decrypt(encryptedData, iv, encryptionKey);
      }

      // Decompress if compressed
      if (storedData.compressed) {
        dataString = this.decompress(dataString);
      }

      return JSON.parse(dataString);

    } catch (error) {
      console.error('SecureStorage.getItem failed:', error);
      return null;
    }
  }

  // Remove item
  removeItem(key: string): void {
    const storageKey = this.storagePrefix + key;
    localStorage.removeItem(storageKey);
  }

  // Check if item exists
  hasItem(key: string): boolean {
    const storageKey = this.storagePrefix + key;
    return localStorage.getItem(storageKey) !== null;
  }

  // Get all keys
  getKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.storagePrefix)) {
        keys.push(key.substring(this.storagePrefix.length));
      }
    }
    return keys;
  }

  // Clear all secure storage
  clear(): void {
    const keys = this.getKeys();
    keys.forEach(key => this.removeItem(key));
  }

  // Clean expired items
  cleanExpired(): void {
    const keys = this.getKeys();
    const now = Date.now();

    keys.forEach(key => {
      try {
        const storageKey = this.storagePrefix + key;
        const storedDataString = localStorage.getItem(storageKey);
        
        if (storedDataString) {
          const storedData: StoredData = JSON.parse(storedDataString);
          
          if (storedData.ttl && now - storedData.timestamp > storedData.ttl) {
            this.removeItem(key);
          }
        }
      } catch (error) {
        // Remove corrupted data
        this.removeItem(key);
      }
    });
  }

  // Get storage statistics
  getStats(): {
    totalItems: number;
    totalSize: number;
    encryptedItems: number;
    compressedItems: number;
    expiredItems: number;
  } {
    const keys = this.getKeys();
    let totalSize = 0;
    let encryptedItems = 0;
    let compressedItems = 0;
    let expiredItems = 0;
    const now = Date.now();

    keys.forEach(key => {
      try {
        const storageKey = this.storagePrefix + key;
        const storedDataString = localStorage.getItem(storageKey);
        
        if (storedDataString) {
          totalSize += storedDataString.length;
          const storedData: StoredData = JSON.parse(storedDataString);
          
          if (storedData.encrypted) encryptedItems++;
          if (storedData.compressed) compressedItems++;
          if (storedData.ttl && now - storedData.timestamp > storedData.ttl) {
            expiredItems++;
          }
        }
      } catch (error) {
        // Count corrupted items as expired
        expiredItems++;
      }
    });

    return {
      totalItems: keys.length,
      totalSize,
      encryptedItems,
      compressedItems,
      expiredItems
    };
  }

  // Utility methods
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return this.arrayBufferToBase64(hashBuffer);
  }

  private compress(data: string): string {
    // Simple compression - in production, use a proper compression library
    return data.replace(/\s+/g, ' ').trim();
  }

  private decompress(data: string): string {
    // Simple decompression - in production, use a proper compression library
    return data;
  }
}

// Predefined secure storage instances for different data types
export class SecureStorageManager {
  private static instance: SecureStorageManager;
  private storage: SecureStorage;
  private initialized = false;

  private constructor() {
    this.storage = SecureStorage.getInstance();
  }

  static getInstance(): SecureStorageManager {
    if (!SecureStorageManager.instance) {
      SecureStorageManager.instance = new SecureStorageManager();
    }
    return SecureStorageManager.instance;
  }

  async initialize(masterPassword?: string): Promise<void> {
    if (!this.initialized) {
      await this.storage.initialize(masterPassword);
      this.initialized = true;
      
      // Clean expired items on initialization
      this.storage.cleanExpired();
      
      // Set up periodic cleanup
      setInterval(() => {
        this.storage.cleanExpired();
      }, 5 * 60 * 1000); // Every 5 minutes
    }
  }

  // Store authentication tokens
  async storeAuthToken(token: string, expiresIn?: number): Promise<void> {
    const ttl = expiresIn ? expiresIn * 1000 : 24 * 60 * 60 * 1000; // Default 24 hours
    await this.storage.setItem('auth_token', token, {
      encrypt: true,
      ttl
    });
  }

  // Get authentication token
  async getAuthToken(): Promise<string | null> {
    return await this.storage.getItem<string>('auth_token');
  }

  // Store user session data
  async storeSessionData(sessionData: any): Promise<void> {
    await this.storage.setItem('session_data', sessionData, {
      encrypt: true,
      ttl: 8 * 60 * 60 * 1000 // 8 hours
    });
  }

  // Get user session data
  async getSessionData(): Promise<any> {
    return await this.storage.getItem('session_data');
  }

  // Store user preferences (non-sensitive)
  async storeUserPreferences(preferences: any): Promise<void> {
    await this.storage.setItem('user_preferences', preferences, {
      encrypt: false,
      compress: true
    });
  }

  // Get user preferences
  async getUserPreferences(): Promise<any> {
    return await this.storage.getItem('user_preferences');
  }

  // Store cached queries (with TTL)
  async storeCachedQuery(queryId: string, response: any): Promise<void> {
    await this.storage.setItem(`cached_query_${queryId}`, response, {
      encrypt: false,
      compress: true,
      ttl: 60 * 60 * 1000 // 1 hour
    });
  }

  // Get cached query
  async getCachedQuery(queryId: string): Promise<any> {
    return await this.storage.getItem(`cached_query_${queryId}`);
  }

  // Store sensitive settings
  async storeSensitiveSettings(settings: any): Promise<void> {
    await this.storage.setItem('sensitive_settings', settings, {
      encrypt: true,
      compress: false
    });
  }

  // Get sensitive settings
  async getSensitiveSettings(): Promise<any> {
    return await this.storage.getItem('sensitive_settings');
  }

  // Clear all data
  clearAll(): void {
    this.storage.clear();
  }

  // Get storage statistics
  getStorageStats() {
    return this.storage.getStats();
  }

  // Check if initialized
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export convenience functions
export const secureStorage = SecureStorageManager.getInstance();

export const initializeSecureStorage = (masterPassword?: string) => 
  secureStorage.initialize(masterPassword);

export const storeAuthToken = (token: string, expiresIn?: number) => 
  secureStorage.storeAuthToken(token, expiresIn);

export const getAuthToken = () => 
  secureStorage.getAuthToken();

export const storeSessionData = (data: any) => 
  secureStorage.storeSessionData(data);

export const getSessionData = () => 
  secureStorage.getSessionData();

export const clearSecureStorage = () => 
  secureStorage.clearAll();