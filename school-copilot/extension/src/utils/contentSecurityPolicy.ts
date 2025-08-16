/**
 * Content Security Policy (CSP) Implementation
 * XSS prevention and secure content loading policies
 */

export interface CSPDirective {
  name: string;
  values: string[];
}

export interface CSPPolicy {
  directives: CSPDirective[];
  reportOnly?: boolean;
  reportUri?: string;
}

// CSP directive names
export const CSP_DIRECTIVES = {
  DEFAULT_SRC: 'default-src',
  SCRIPT_SRC: 'script-src',
  STYLE_SRC: 'style-src',
  IMG_SRC: 'img-src',
  FONT_SRC: 'font-src',
  CONNECT_SRC: 'connect-src',
  MEDIA_SRC: 'media-src',
  OBJECT_SRC: 'object-src',
  CHILD_SRC: 'child-src',
  FRAME_SRC: 'frame-src',
  WORKER_SRC: 'worker-src',
  MANIFEST_SRC: 'manifest-src',
  BASE_URI: 'base-uri',
  FORM_ACTION: 'form-action',
  FRAME_ANCESTORS: 'frame-ancestors',
  PLUGIN_TYPES: 'plugin-types',
  SANDBOX: 'sandbox',
  UPGRADE_INSECURE_REQUESTS: 'upgrade-insecure-requests',
  BLOCK_ALL_MIXED_CONTENT: 'block-all-mixed-content',
  REQUIRE_SRI_FOR: 'require-sri-for',
  REPORT_URI: 'report-uri',
  REPORT_TO: 'report-to'
} as const;

// CSP source keywords
export const CSP_SOURCES = {
  SELF: "'self'",
  UNSAFE_INLINE: "'unsafe-inline'",
  UNSAFE_EVAL: "'unsafe-eval'",
  STRICT_DYNAMIC: "'strict-dynamic'",
  UNSAFE_HASHES: "'unsafe-hashes'",
  NONE: "'none'",
  DATA: 'data:',
  BLOB: 'blob:',
  FILESYSTEM: 'filesystem:',
  HTTPS: 'https:',
  HTTP: 'http:',
  WS: 'ws:',
  WSS: 'wss:'
} as const;

// Content Security Policy Manager
export class CSPManager {
  private static instance: CSPManager;
  private currentPolicy: CSPPolicy | null = null;
  private violations: CSPViolation[] = [];
  private maxViolations = 100;

  private constructor() {
    this.setupViolationReporting();
  }

  static getInstance(): CSPManager {
    if (!CSPManager.instance) {
      CSPManager.instance = new CSPManager();
    }
    return CSPManager.instance;
  }

  // Set up CSP violation reporting
  private setupViolationReporting(): void {
    document.addEventListener('securitypolicyviolation', (event) => {
      this.handleViolation({
        blockedURI: event.blockedURI,
        columnNumber: event.columnNumber,
        disposition: event.disposition,
        documentURI: event.documentURI,
        effectiveDirective: event.effectiveDirective,
        lineNumber: event.lineNumber,
        originalPolicy: event.originalPolicy,
        referrer: event.referrer,
        sample: event.sample,
        sourceFile: event.sourceFile,
        statusCode: event.statusCode,
        violatedDirective: event.violatedDirective,
        timestamp: new Date()
      });
    });
  }

  // Handle CSP violations
  private handleViolation(violation: CSPViolation): void {
    console.warn('CSP Violation:', violation);
    
    this.violations.unshift(violation);
    
    // Maintain violations list size
    if (this.violations.length > this.maxViolations) {
      this.violations = this.violations.slice(0, this.maxViolations);
    }

    // Report to backend if configured
    this.reportViolation(violation);
  }

  // Report violation to backend
  private async reportViolation(violation: CSPViolation): Promise<void> {
    try {
      if (this.currentPolicy?.reportUri) {
        await fetch(this.currentPolicy.reportUri, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/csp-report'
          },
          body: JSON.stringify({
            'csp-report': violation
          })
        });
      }
    } catch (error) {
      console.error('Failed to report CSP violation:', error);
    }
  }

  // Create a CSP policy
  createPolicy(directives: Partial<Record<keyof typeof CSP_DIRECTIVES, string[]>>): CSPPolicy {
    const policyDirectives: CSPDirective[] = [];

    for (const [directiveName, values] of Object.entries(directives)) {
      if (values && values.length > 0) {
        policyDirectives.push({
          name: directiveName.toLowerCase().replace(/_/g, '-'),
          values
        });
      }
    }

    return {
      directives: policyDirectives
    };
  }

  // Generate CSP header string
  generateCSPHeader(policy: CSPPolicy): string {
    const directives = policy.directives.map(directive => 
      `${directive.name} ${directive.values.join(' ')}`
    );

    return directives.join('; ');
  }

  // Apply CSP policy to the document
  applyPolicy(policy: CSPPolicy): void {
    this.currentPolicy = policy;
    
    // Create meta tag for CSP
    const existingMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existingMeta) {
      existingMeta.remove();
    }

    const meta = document.createElement('meta');
    meta.setAttribute('http-equiv', policy.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy');
    meta.setAttribute('content', this.generateCSPHeader(policy));
    
    document.head.appendChild(meta);
  }

  // Get current policy
  getCurrentPolicy(): CSPPolicy | null {
    return this.currentPolicy;
  }

  // Get violations
  getViolations(): CSPViolation[] {
    return [...this.violations];
  }

  // Clear violations
  clearViolations(): void {
    this.violations = [];
  }

  // Check if a source is allowed by current policy
  isSourceAllowed(directive: string, source: string): boolean {
    if (!this.currentPolicy) return true;

    const policyDirective = this.currentPolicy.directives.find(d => d.name === directive);
    if (!policyDirective) return true;

    // Check if source matches any allowed values
    return policyDirective.values.some(value => {
      if (value === CSP_SOURCES.SELF && source.startsWith(window.location.origin)) {
        return true;
      }
      if (value === source) {
        return true;
      }
      if (value.endsWith('*') && source.startsWith(value.slice(0, -1))) {
        return true;
      }
      return false;
    });
  }
}

// CSP Violation interface
export interface CSPViolation {
  blockedURI: string;
  columnNumber: number;
  disposition: string;
  documentURI: string;
  effectiveDirective: string;
  lineNumber: number;
  originalPolicy: string;
  referrer: string;
  sample: string;
  sourceFile: string;
  statusCode: number;
  violatedDirective: string;
  timestamp: Date;
}

// Predefined CSP policies
export const STRICT_CSP_POLICY: CSPPolicy = {
  directives: [
    { name: CSP_DIRECTIVES.DEFAULT_SRC, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.SCRIPT_SRC, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.STYLE_SRC, values: [CSP_SOURCES.SELF, CSP_SOURCES.UNSAFE_INLINE] },
    { name: CSP_DIRECTIVES.IMG_SRC, values: [CSP_SOURCES.SELF, CSP_SOURCES.DATA] },
    { name: CSP_DIRECTIVES.FONT_SRC, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.CONNECT_SRC, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.MEDIA_SRC, values: [CSP_SOURCES.NONE] },
    { name: CSP_DIRECTIVES.OBJECT_SRC, values: [CSP_SOURCES.NONE] },
    { name: CSP_DIRECTIVES.CHILD_SRC, values: [CSP_SOURCES.NONE] },
    { name: CSP_DIRECTIVES.FRAME_SRC, values: [CSP_SOURCES.NONE] },
    { name: CSP_DIRECTIVES.WORKER_SRC, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.BASE_URI, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.FORM_ACTION, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.FRAME_ANCESTORS, values: [CSP_SOURCES.NONE] },
    { name: CSP_DIRECTIVES.UPGRADE_INSECURE_REQUESTS, values: [] },
    { name: CSP_DIRECTIVES.BLOCK_ALL_MIXED_CONTENT, values: [] }
  ]
};

export const DEVELOPMENT_CSP_POLICY: CSPPolicy = {
  directives: [
    { name: CSP_DIRECTIVES.DEFAULT_SRC, values: [CSP_SOURCES.SELF, 'localhost:*', '127.0.0.1:*'] },
    { name: CSP_DIRECTIVES.SCRIPT_SRC, values: [CSP_SOURCES.SELF, CSP_SOURCES.UNSAFE_EVAL, 'localhost:*'] },
    { name: CSP_DIRECTIVES.STYLE_SRC, values: [CSP_SOURCES.SELF, CSP_SOURCES.UNSAFE_INLINE, 'localhost:*'] },
    { name: CSP_DIRECTIVES.IMG_SRC, values: [CSP_SOURCES.SELF, CSP_SOURCES.DATA, 'localhost:*'] },
    { name: CSP_DIRECTIVES.FONT_SRC, values: [CSP_SOURCES.SELF, 'localhost:*'] },
    { name: CSP_DIRECTIVES.CONNECT_SRC, values: [CSP_SOURCES.SELF, 'localhost:*', 'ws://localhost:*', 'wss://localhost:*'] },
    { name: CSP_DIRECTIVES.MEDIA_SRC, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.OBJECT_SRC, values: [CSP_SOURCES.NONE] },
    { name: CSP_DIRECTIVES.BASE_URI, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.FORM_ACTION, values: [CSP_SOURCES.SELF] }
  ]
};

export const EXTENSION_CSP_POLICY: CSPPolicy = {
  directives: [
    { name: CSP_DIRECTIVES.DEFAULT_SRC, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.SCRIPT_SRC, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.STYLE_SRC, values: [CSP_SOURCES.SELF, CSP_SOURCES.UNSAFE_INLINE] },
    { name: CSP_DIRECTIVES.IMG_SRC, values: [CSP_SOURCES.SELF, CSP_SOURCES.DATA] },
    { name: CSP_DIRECTIVES.FONT_SRC, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.CONNECT_SRC, values: [CSP_SOURCES.SELF, 'https://*.schoolcopilot.com'] },
    { name: CSP_DIRECTIVES.MEDIA_SRC, values: [CSP_SOURCES.NONE] },
    { name: CSP_DIRECTIVES.OBJECT_SRC, values: [CSP_SOURCES.NONE] },
    { name: CSP_DIRECTIVES.CHILD_SRC, values: [CSP_SOURCES.NONE] },
    { name: CSP_DIRECTIVES.FRAME_SRC, values: [CSP_SOURCES.NONE] },
    { name: CSP_DIRECTIVES.BASE_URI, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.FORM_ACTION, values: [CSP_SOURCES.SELF] },
    { name: CSP_DIRECTIVES.FRAME_ANCESTORS, values: [CSP_SOURCES.NONE] }
  ]
};

// CSP Builder class for dynamic policy creation
export class CSPBuilder {
  private directives: Map<string, Set<string>> = new Map();

  // Add a directive
  addDirective(name: string, ...sources: string[]): CSPBuilder {
    if (!this.directives.has(name)) {
      this.directives.set(name, new Set());
    }
    
    const directiveSet = this.directives.get(name)!;
    sources.forEach(source => directiveSet.add(source));
    
    return this;
  }

  // Remove a directive
  removeDirective(name: string): CSPBuilder {
    this.directives.delete(name);
    return this;
  }

  // Add source to existing directive
  addSource(directive: string, ...sources: string[]): CSPBuilder {
    return this.addDirective(directive, ...sources);
  }

  // Remove source from directive
  removeSource(directive: string, source: string): CSPBuilder {
    const directiveSet = this.directives.get(directive);
    if (directiveSet) {
      directiveSet.delete(source);
    }
    return this;
  }

  // Build the policy
  build(): CSPPolicy {
    const policyDirectives: CSPDirective[] = [];
    
    for (const [name, sources] of this.directives.entries()) {
      if (sources.size > 0) {
        policyDirectives.push({
          name,
          values: Array.from(sources)
        });
      }
    }

    return {
      directives: policyDirectives
    };
  }

  // Create a builder from existing policy
  static fromPolicy(policy: CSPPolicy): CSPBuilder {
    const builder = new CSPBuilder();
    
    for (const directive of policy.directives) {
      builder.addDirective(directive.name, ...directive.values);
    }
    
    return builder;
  }
}

// Utility functions
export const cspManager = CSPManager.getInstance();

export const applyStrictCSP = (): void => {
  cspManager.applyPolicy(STRICT_CSP_POLICY);
};

export const applyDevelopmentCSP = (): void => {
  cspManager.applyPolicy(DEVELOPMENT_CSP_POLICY);
};

export const applyExtensionCSP = (): void => {
  cspManager.applyPolicy(EXTENSION_CSP_POLICY);
};

export const createCSPBuilder = (): CSPBuilder => {
  return new CSPBuilder();
};

export const getCSPViolations = (): CSPViolation[] => {
  return cspManager.getViolations();
};

export const clearCSPViolations = (): void => {
  cspManager.clearViolations();
};

// CSP nonce generator for inline scripts/styles
export const generateNonce = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
};

// CSP hash generator for inline content
export const generateCSPHash = async (content: string, algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest(algorithm.toUpperCase(), data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  return `'${algorithm}-${hashBase64}'`;
};

// Initialize CSP based on environment
export const initializeCSP = (): void => {
  const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isExtension) {
    applyExtensionCSP();
  } else if (isDevelopment) {
    applyDevelopmentCSP();
  } else {
    applyStrictCSP();
  }
  
  console.log('CSP initialized for', isExtension ? 'extension' : isDevelopment ? 'development' : 'production');
};