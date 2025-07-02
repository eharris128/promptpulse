// Security testing utilities for verifying SQL injection protection

import { detectSqlInjection, validateAndSanitize } from "./security-utils.js";

/**
 * Common SQL injection attack patterns for testing
 */
export const SQL_INJECTION_TEST_PATTERNS = [
  // Basic injection attempts
  "' OR '1'='1",
  "' OR 1=1--",
  "' OR 1=1#",
  "'; DROP TABLE users; --",
  "' UNION SELECT * FROM users--",

  // Advanced injection attempts
  "admin'--",
  "admin'/*",
  "' OR 'x'='x",
  "') OR ('1'='1--",
  "' OR 1=1 LIMIT 1--",

  // Time-based blind injection
  "'; WAITFOR DELAY '00:00:05'--",
  "' OR SLEEP(5)--",

  // Boolean-based blind injection
  "' AND (SELECT COUNT(*) FROM users) > 0--",

  // UNION-based injection
  "' UNION SELECT 1,2,3,4,5--",
  "' UNION SELECT NULL,NULL,NULL--",

  // Comment-based injection
  "/**/OR/**/1=1",
  "/*!OR*/1=1",

  // Encoded injection attempts
  "%27%20OR%20%271%27%3D%271",
  "0x27204f522027312027203d202731",

  // Stacked queries
  "'; INSERT INTO users VALUES('hacker','password');--",

  // Second-order injection
  "test'; UPDATE users SET password='hacked' WHERE username='admin';--"
];

/**
 * Test input sanitization functions
 * @param {Function} sanitizeFunction - The sanitization function to test
 * @param {string} testName - Name for the test
 * @returns {Object} - Test results
 */
export function testSanitization(sanitizeFunction, testName = "sanitization") {
  const results = {
    testName,
    passed: 0,
    failed: 0,
    failures: [],
    summary: ""
  };

  SQL_INJECTION_TEST_PATTERNS.forEach((pattern, index) => {
    try {
      const sanitized = sanitizeFunction(pattern);

      // Check if the sanitized output still contains dangerous patterns
      if (detectSqlInjection(sanitized)) {
        results.failed++;
        results.failures.push({
          index,
          original: pattern,
          sanitized,
          reason: "Still contains SQL injection patterns after sanitization"
        });
      } else {
        results.passed++;
      }
    } catch (error) {
      results.failed++;
      results.failures.push({
        index,
        original: pattern,
        sanitized: null,
        reason: `Sanitization function threw error: ${error.message}`
      });
    }
  });

  results.summary = `${results.passed}/${SQL_INJECTION_TEST_PATTERNS.length} tests passed`;
  return results;
}

/**
 * Test parameterized query implementation
 * @param {Function} queryFunction - Function that executes a parameterized query
 * @param {Array} testInputs - Array of test inputs to try
 * @returns {Object} - Test results
 */
export async function testParameterizedQuery(queryFunction, testInputs = SQL_INJECTION_TEST_PATTERNS) {
  const results = {
    testName: "parameterized_query",
    passed: 0,
    failed: 0,
    errors: 0,
    failures: [],
    summary: ""
  };

  for (let i = 0; i < testInputs.length; i++) {
    const input = testInputs[i];

    try {
      // Execute the query with malicious input
      const queryResult = await queryFunction(input);

      // If the query executes without throwing an error,
      // we need to verify it didn't actually perform SQL injection
      if (queryResult && typeof queryResult === "object") {
        // Check if the result contains suspicious data that might indicate injection success
        const resultStr = JSON.stringify(queryResult).toLowerCase();
        if (resultStr.includes("drop") || resultStr.includes("union") || resultStr.includes("insert")) {
          results.failed++;
          results.failures.push({
            index: i,
            input,
            result: queryResult,
            reason: "Query result suggests SQL injection may have succeeded"
          });
        } else {
          results.passed++;
        }
      } else {
        results.passed++;
      }
    } catch (error) {
      // Errors are generally good when testing injection - means the query was rejected
      if (error.message.includes("SQL") || error.message.includes("syntax")) {
        results.passed++; // Query properly rejected malicious input
      } else {
        results.errors++;
        results.failures.push({
          index: i,
          input,
          result: null,
          reason: `Unexpected error: ${error.message}`
        });
      }
    }
  }

  results.summary = `${results.passed}/${testInputs.length} tests passed, ${results.errors} errors`;
  return results;
}

/**
 * Comprehensive security test suite
 * @param {Object} testConfig - Configuration for tests
 * @returns {Object} - Complete test results
 */
export async function runSecurityTestSuite(testConfig = {}) {
  const {
    sanitizeFunctions = {},
    queryFunctions = {},
    verbose = false
  } = testConfig;

  const results = {
    timestamp: new Date().toISOString(),
    passed: true,
    summary: "",
    tests: {}
  };

  // Test sanitization functions
  for (const [name, func] of Object.entries(sanitizeFunctions)) {
    if (verbose) console.log(`Testing sanitization function: ${name}`);
    results.tests[`sanitization_${name}`] = testSanitization(func, name);
    if (results.tests[`sanitization_${name}`].failed > 0) {
      results.passed = false;
    }
  }

  // Test parameterized query functions
  for (const [name, func] of Object.entries(queryFunctions)) {
    if (verbose) console.log(`Testing parameterized query: ${name}`);
    results.tests[`query_${name}`] = await testParameterizedQuery(func, SQL_INJECTION_TEST_PATTERNS.slice(0, 5)); // Limit for safety
    if (results.tests[`query_${name}`].failed > 0 || results.tests[`query_${name}`].errors > 0) {
      results.passed = false;
    }
  }

  // Generate summary
  const totalTests = Object.keys(results.tests).length;
  const passedTests = Object.values(results.tests).filter(test => test.failed === 0 && test.errors === 0).length;
  results.summary = `Security Test Suite: ${passedTests}/${totalTests} test categories passed`;

  return results;
}

/**
 * Generate security test report
 * @param {Object} testResults - Results from security tests
 * @returns {string} - Formatted report
 */
export function generateSecurityReport(testResults) {
  let report = `\n=== SECURITY TEST REPORT ===\n`;
  report += `Timestamp: ${testResults.timestamp}\n`;
  report += `Overall Status: ${testResults.passed ? "PASSED" : "FAILED"}\n`;
  report += `Summary: ${testResults.summary}\n\n`;

  for (const [testName, result] of Object.entries(testResults.tests)) {
    report += `--- ${testName.toUpperCase()} ---\n`;
    report += `Status: ${result.failed === 0 && result.errors === 0 ? "PASSED" : "FAILED"}\n`;
    report += `Summary: ${result.summary}\n`;

    if (result.failures && result.failures.length > 0) {
      report += `Failures:\n`;
      result.failures.forEach((failure, index) => {
        report += `  ${index + 1}. Input: "${failure.original || failure.input}"\n`;
        report += `     Reason: ${failure.reason}\n`;
        if (failure.sanitized) {
          report += `     Sanitized: "${failure.sanitized}"\n`;
        }
        report += "\n";
      });
    }
    report += "\n";
  }

  return report;
}

/**
 * Validate that a string is properly parameterized (no direct concatenation)
 * @param {string} sqlQuery - SQL query string to validate
 * @returns {Object} - Validation result
 */
export function validateQueryParameterization(sqlQuery) {
  const result = {
    isParameterized: true,
    issues: [],
    recommendations: []
  };

  // Check for common string concatenation patterns
  const dangerousPatterns = [
    /\$\{.*\}/g, // Template literal interpolation
    /\+\s*['"`]/g, // String concatenation with quotes
    /['"`]\s*\+/g, // String concatenation after quotes
    /=\s*['"`]\s*\+/g, // Assignment with concatenation
  ];

  dangerousPatterns.forEach((pattern, index) => {
    if (pattern.test(sqlQuery)) {
      result.isParameterized = false;
      result.issues.push({
        pattern: pattern.toString(),
        description: getDangerousPatternDescription(index)
      });
    }
  });

  // Check for proper parameterization indicators
  const goodPatterns = [
    /\?/g, // Question mark parameters
    /\$\d+/g, // Numbered parameters ($1, $2, etc.)
    /:\w+/g, // Named parameters (:name, :id, etc.)
  ];

  const hasParameterization = goodPatterns.some(pattern => pattern.test(sqlQuery));

  if (!hasParameterization && result.isParameterized) {
    result.recommendations.push("Consider using parameterized queries with ? or $1, $2, etc.");
  }

  return result;
}

/**
 * Helper function to describe dangerous patterns
 */
function getDangerousPatternDescription(index) {
  const descriptions = [
    "Template literal interpolation detected - use parameterized queries instead",
    "String concatenation with quotes detected - vulnerable to SQL injection",
    "String concatenation detected - use parameterized queries",
    "Assignment with string concatenation - potential SQL injection risk"
  ];
  return descriptions[index] || "Potentially dangerous SQL pattern detected";
}

/**
 * Quick test for common injection vulnerabilities
 * @param {string} input - Input to test
 * @returns {Object} - Quick test result
 */
export function quickInjectionTest(input) {
  return {
    input,
    containsSqlKeywords: /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|UNION)\b/gi.test(input),
    containsQuotes: /['"`]/.test(input),
    containsComments: /(--|\/\*|\*\/|#)/.test(input),
    containsSemicolon: /;/.test(input),
    riskLevel: calculateRiskLevel(input),
    sanitized: validateAndSanitize(input, { type: "generic" }).sanitized
  };
}

/**
 * Calculate risk level for input
 */
function calculateRiskLevel(input) {
  let score = 0;

  if (/\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|UNION)\b/gi.test(input)) score += 3;
  if (/['"`]/.test(input)) score += 1;
  if (/(--|\/\*|\*\/|#)/.test(input)) score += 2;
  if (/;/.test(input)) score += 1;
  if (/\bOR\b.*\b=\b/gi.test(input)) score += 3;

  if (score >= 5) return "HIGH";
  if (score >= 3) return "MEDIUM";
  if (score >= 1) return "LOW";
  return "NONE";
}
