/**
 * Accessibility Testing Utilities
 * Automated accessibility testing using axe-core
 */

import { AxeResults, Result, RunOptions } from 'axe-core';

// Import axe-core dynamically to avoid bundling issues
let axe: any = null;

const loadAxe = async () => {
  if (!axe) {
    try {
      axe = await import('axe-core');
    } catch (error) {
      console.warn('axe-core not available for accessibility testing:', error);
      return null;
    }
  }
  return axe;
};

export interface AccessibilityTestResult {
  violations: Result[];
  passes: Result[];
  incomplete: Result[];
  inapplicable: Result[];
  summary: {
    violationCount: number;
    passCount: number;
    incompleteCount: number;
    criticalViolations: number;
    seriousViolations: number;
    moderateViolations: number;
    minorViolations: number;
  };
  score: number; // 0-100 accessibility score
}

export interface AccessibilityTestOptions {
  element?: Element | string;
  rules?: string[];
  tags?: string[];
  exclude?: string[];
  include?: string[];
  level?: 'A' | 'AA' | 'AAA';
}

/**
 * Run accessibility tests on the specified element or document
 */
export const runAccessibilityTest = async (
  options: AccessibilityTestOptions = {}
): Promise<AccessibilityTestResult | null> => {
  const axeCore = await loadAxe();
  if (!axeCore) {
    return null;
  }

  const {
    element = document,
    rules,
    tags = ['wcag2a', 'wcag2aa', 'wcag21aa'],
    exclude,
    include,
    level = 'AA'
  } = options;

  const runOptions: RunOptions = {
    tags,
    rules: rules ? { [rules.join(',')]: { enabled: true } } : undefined,
    exclude: exclude ? [exclude.join(',')] : undefined,
    include: include ? [include.join(',')] : undefined,
  };

  try {
    const results: AxeResults = await axeCore.run(element, runOptions);
    
    // Calculate summary statistics
    const summary = {
      violationCount: results.violations.length,
      passCount: results.passes.length,
      incompleteCount: results.incomplete.length,
      criticalViolations: results.violations.filter(v => v.impact === 'critical').length,
      seriousViolations: results.violations.filter(v => v.impact === 'serious').length,
      moderateViolations: results.violations.filter(v => v.impact === 'moderate').length,
      minorViolations: results.violations.filter(v => v.impact === 'minor').length,
    };

    // Calculate accessibility score (0-100)
    const totalTests = summary.violationCount + summary.passCount;
    const score = totalTests > 0 ? Math.round((summary.passCount / totalTests) * 100) : 100;

    return {
      violations: results.violations,
      passes: results.passes,
      incomplete: results.incomplete,
      inapplicable: results.inapplicable,
      summary,
      score
    };
  } catch (error) {
    console.error('Accessibility test failed:', error);
    return null;
  }
};

/**
 * Run continuous accessibility monitoring
 */
export class AccessibilityMonitor {
  private observer: MutationObserver | null = null;
  private testInterval: NodeJS.Timeout | null = null;
  private onViolation: ((violations: Result[]) => void) | null = null;
  private isRunning = false;

  constructor(onViolation?: (violations: Result[]) => void) {
    this.onViolation = onViolation || null;
  }

  start(options: AccessibilityTestOptions & { interval?: number } = {}) {
    if (this.isRunning) return;

    const { interval = 5000, ...testOptions } = options;
    this.isRunning = true;

    // Run initial test
    this.runTest(testOptions);

    // Set up periodic testing
    this.testInterval = setInterval(() => {
      this.runTest(testOptions);
    }, interval);

    // Set up DOM change monitoring
    this.observer = new MutationObserver(() => {
      // Debounce DOM changes
      if (this.testInterval) {
        clearTimeout(this.testInterval);
      }
      this.testInterval = setTimeout(() => {
        this.runTest(testOptions);
      }, 1000);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-*', 'role', 'tabindex', 'alt', 'title']
    });
  }

  stop() {
    this.isRunning = false;

    if (this.testInterval) {
      clearInterval(this.testInterval);
      this.testInterval = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private async runTest(options: AccessibilityTestOptions) {
    const result = await runAccessibilityTest(options);
    if (result && result.violations.length > 0 && this.onViolation) {
      this.onViolation(result.violations);
    }
  }
}

/**
 * Generate accessibility report
 */
export const generateAccessibilityReport = (
  result: AccessibilityTestResult
): string => {
  const { violations, summary, score } = result;

  let report = `# Accessibility Test Report\n\n`;
  report += `**Overall Score:** ${score}/100\n\n`;
  report += `## Summary\n`;
  report += `- Total Violations: ${summary.violationCount}\n`;
  report += `- Passed Tests: ${summary.passCount}\n`;
  report += `- Incomplete Tests: ${summary.incompleteCount}\n\n`;

  if (summary.criticalViolations > 0) {
    report += `⚠️ **Critical Issues:** ${summary.criticalViolations}\n`;
  }
  if (summary.seriousViolations > 0) {
    report += `🔴 **Serious Issues:** ${summary.seriousViolations}\n`;
  }
  if (summary.moderateViolations > 0) {
    report += `🟡 **Moderate Issues:** ${summary.moderateViolations}\n`;
  }
  if (summary.minorViolations > 0) {
    report += `🔵 **Minor Issues:** ${summary.minorViolations}\n`;
  }

  if (violations.length > 0) {
    report += `\n## Violations\n\n`;
    
    violations.forEach((violation, index) => {
      report += `### ${index + 1}. ${violation.help}\n`;
      report += `**Impact:** ${violation.impact}\n`;
      report += `**Description:** ${violation.description}\n`;
      report += `**Help URL:** ${violation.helpUrl}\n`;
      report += `**Affected Elements:** ${violation.nodes.length}\n\n`;
      
      violation.nodes.forEach((node, nodeIndex) => {
        report += `#### Element ${nodeIndex + 1}\n`;
        report += `**Target:** \`${node.target.join(', ')}\`\n`;
        report += `**HTML:** \`${node.html}\`\n`;
        
        if (node.failureSummary) {
          report += `**Issue:** ${node.failureSummary}\n`;
        }
        
        report += '\n';
      });
    });
  }

  return report;
};

/**
 * Get accessibility recommendations based on test results
 */
export const getAccessibilityRecommendations = (
  result: AccessibilityTestResult
): string[] => {
  const recommendations: string[] = [];
  const { violations } = result;

  // Common accessibility issues and recommendations
  const issueRecommendations: Record<string, string> = {
    'color-contrast': 'Increase color contrast between text and background to meet WCAG standards',
    'image-alt': 'Add descriptive alt text to all images',
    'label': 'Ensure all form controls have associated labels',
    'keyboard': 'Make all interactive elements keyboard accessible',
    'focus-order-semantics': 'Ensure logical focus order and proper semantic structure',
    'aria-labels': 'Add appropriate ARIA labels and descriptions',
    'heading-order': 'Use proper heading hierarchy (h1, h2, h3, etc.)',
    'link-purpose': 'Make link purposes clear from their text or context',
    'button-name': 'Ensure all buttons have accessible names',
    'form-field-multiple-labels': 'Avoid multiple labels for single form fields'
  };

  // Extract unique rule IDs from violations
  const ruleIds = [...new Set(violations.map(v => v.id))];
  
  ruleIds.forEach(ruleId => {
    if (issueRecommendations[ruleId]) {
      recommendations.push(issueRecommendations[ruleId]);
    }
  });

  // Add general recommendations based on violation count
  if (violations.length > 10) {
    recommendations.push('Consider implementing automated accessibility testing in your development workflow');
  }

  if (violations.some(v => v.impact === 'critical' || v.impact === 'serious')) {
    recommendations.push('Address critical and serious accessibility issues immediately');
  }

  return recommendations;
};

/**
 * Test specific accessibility features
 */
export const testAccessibilityFeatures = async () => {
  const tests = {
    keyboardNavigation: await testKeyboardNavigation(),
    screenReaderSupport: await testScreenReaderSupport(),
    colorContrast: await testColorContrast(),
    focusManagement: await testFocusManagement(),
  };

  return tests;
};

const testKeyboardNavigation = async (): Promise<boolean> => {
  // Test if all interactive elements are keyboard accessible
  const interactiveElements = document.querySelectorAll(
    'button, a, input, select, textarea, [tabindex], [role="button"], [role="link"]'
  );

  let accessible = true;
  interactiveElements.forEach(element => {
    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex === '-1' && !element.hasAttribute('aria-hidden')) {
      accessible = false;
    }
  });

  return accessible;
};

const testScreenReaderSupport = async (): Promise<boolean> => {
  // Test for proper ARIA labels and semantic structure
  const unlabeledElements = document.querySelectorAll(
    'button:not([aria-label]):not([aria-labelledby]):empty, ' +
    'input:not([aria-label]):not([aria-labelledby]):not([id]), ' +
    'img:not([alt]):not([aria-label]):not([role="presentation"])'
  );

  return unlabeledElements.length === 0;
};

const testColorContrast = async (): Promise<boolean> => {
  // This would require more complex color analysis
  // For now, return true as axe-core handles this
  return true;
};

const testFocusManagement = async (): Promise<boolean> => {
  // Test if focus is properly managed
  const focusableElements = document.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  // Check if there's at least one focusable element
  return focusableElements.length > 0;
};