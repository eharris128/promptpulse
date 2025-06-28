// Server-side security utilities for input sanitization and SQL injection prevention

/**
 * Escapes SQL special characters to prevent SQL injection
 * @param {string} input - The input string to escape
 * @returns {string} - The escaped string
 */
export function escapeSqlCharacters(input) {
  if (!input || typeof input !== 'string') return ''
  
  return input
    .replace(/'/g, "''")        // Escape single quotes
    .replace(/\\/g, '\\\\')     // Escape backslashes
    .replace(/\0/g, '\\0')      // Escape null bytes
    .replace(/\n/g, '\\n')      // Escape newlines
    .replace(/\r/g, '\\r')      // Escape carriage returns
    .replace(/\x1a/g, '\\Z')    // Escape Control+Z
}

/**
 * Sanitizes display names with SQL injection protection
 * @param {string} input - The display name to sanitize
 * @returns {string} - The sanitized display name
 */
export function sanitizeDisplayName(input) {
  if (!input || typeof input !== 'string') return ''
  
  // Trim whitespace and limit length
  let sanitized = input.trim().slice(0, 50)
  
  // Remove HTML tags and dangerous characters
  sanitized = sanitized.replace(/<[^>]*>/g, '')
  sanitized = sanitized.replace(/[<>'\"&]/g, '')
  
  // SQL injection protection
  sanitized = escapeSqlCharacters(sanitized)
  
  return sanitized
}

/**
 * Sanitizes API keys with strict validation
 * @param {string} input - The API key to sanitize
 * @returns {string} - The sanitized API key
 */
export function sanitizeApiKey(input) {
  if (!input || typeof input !== 'string') return ''
  
  // Trim whitespace
  let sanitized = input.trim()
  
  // Remove HTML tags and dangerous characters
  sanitized = sanitized.replace(/<[^>]*>/g, '')
  sanitized = sanitized.replace(/[<>'\"&]/g, '')
  
  // Only allow alphanumeric, underscores, hyphens, and dots
  sanitized = sanitized.replace(/[^a-zA-Z0-9_\-.]/g, '')
  
  // Limit to reasonable API key length
  sanitized = sanitized.slice(0, 100)
  
  // Additional SQL protection (though API keys shouldn't contain SQL chars)
  sanitized = escapeSqlCharacters(sanitized)
  
  return sanitized
}

/**
 * Sanitizes search input to prevent SQL injection and XSS
 * @param {string} input - The search input to sanitize
 * @returns {string} - The sanitized search input
 */
export function sanitizeSearchInput(input) {
  if (!input || typeof input !== 'string') return ''
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, 100)
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '')
  
  // Remove dangerous SQL patterns (keywords that could be used in injections)
  sanitized = sanitized.replace(/(\b(ALTER|CREATE|DELETE|DROP|EXEC|INSERT|MERGE|SELECT|UPDATE|UNION|INTO|FROM|WHERE|SCRIPT|JAVASCRIPT)\b)/gi, '')
  
  // Escape SQL characters
  sanitized = escapeSqlCharacters(sanitized)
  
  return sanitized
}

/**
 * Generic input sanitization for general use
 * @param {string} input - The input to sanitize
 * @param {number} maxLength - Maximum allowed length (default: 255)
 * @returns {string} - The sanitized input
 */
export function sanitizeGenericInput(input, maxLength = 255) {
  if (!input || typeof input !== 'string') return ''
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength)
  
  // Remove HTML tags and script-related content
  sanitized = sanitized.replace(/<[^>]*>/g, '')
  sanitized = sanitized.replace(/javascript:/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=/gi, '')
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>'\"&]/g, '')
  
  // SQL injection protection
  sanitized = escapeSqlCharacters(sanitized)
  
  return sanitized
}

/**
 * Validates SQL identifiers (table names, column names, etc.)
 * @param {string} identifier - The identifier to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function validateSqlIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') return false
  
  // Only allow alphanumeric characters, underscores, and hyphens
  return /^[a-zA-Z0-9_-]+$/.test(identifier)
}

/**
 * Sanitizes machine ID input
 * @param {string} input - The machine ID to sanitize
 * @returns {string} - The sanitized machine ID
 */
export function sanitizeMachineId(input) {
  if (!input || typeof input !== 'string') return ''
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, 100)
  
  // Only allow alphanumeric, underscores, hyphens, and dots
  sanitized = sanitized.replace(/[^a-zA-Z0-9_\-.]/g, '')
  
  // SQL protection
  sanitized = escapeSqlCharacters(sanitized)
  
  return sanitized
}

/**
 * Sanitizes project path input
 * @param {string} input - The project path to sanitize
 * @returns {string} - The sanitized project path
 */
export function sanitizeProjectPath(input) {
  if (!input || typeof input !== 'string') return ''
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, 500)
  
  // Remove dangerous characters but allow path separators
  sanitized = sanitized.replace(/[<>'\"&]/g, '')
  
  // SQL injection protection
  sanitized = escapeSqlCharacters(sanitized)
  
  return sanitized
}

/**
 * Validates and sanitizes date strings
 * @param {string} input - The date string to validate
 * @returns {string|null} - The sanitized date string or null if invalid
 */
export function sanitizeDateString(input) {
  if (!input || typeof input !== 'string') return null
  
  // Basic ISO date format validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(input)) return null
  
  // Try to parse as date to ensure validity
  const date = new Date(input)
  if (isNaN(date.getTime())) return null
  
  return input
}

/**
 * Detects potential SQL injection patterns in input
 * @param {string} input - The input to analyze
 * @returns {boolean} - True if potential injection detected
 */
export function detectSqlInjection(input) {
  if (!input || typeof input !== 'string') return false
  
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /'/g,
    /--/g,
    /\/\*/g,
    /\*\//g,
    /;/g
  ]
  
  return suspiciousPatterns.some(pattern => pattern.test(input))
}

/**
 * Comprehensive input validation and sanitization
 * @param {string} input - The input to process
 * @param {Object} options - Validation options
 * @returns {Object} - Object with sanitized input and validation results
 */
export function validateAndSanitize(input, options = {}) {
  const {
    maxLength = 255,
    allowSpecialChars = false,
    checkSqlInjection = true,
    type = 'generic'
  } = options
  
  const result = {
    original: input,
    sanitized: '',
    isValid: true,
    warnings: []
  }
  
  if (!input || typeof input !== 'string') {
    result.isValid = false
    result.warnings.push('Invalid input type')
    return result
  }
  
  // Check for SQL injection patterns
  if (checkSqlInjection && detectSqlInjection(input)) {
    result.warnings.push('Potential SQL injection detected')
  }
  
  // Apply appropriate sanitization based on type
  switch (type) {
    case 'displayName':
      result.sanitized = sanitizeDisplayName(input)
      break
    case 'apiKey':
      result.sanitized = sanitizeApiKey(input)
      break
    case 'search':
      result.sanitized = sanitizeSearchInput(input)
      break
    case 'machineId':
      result.sanitized = sanitizeMachineId(input)
      break
    case 'projectPath':
      result.sanitized = sanitizeProjectPath(input)
      break
    case 'date':
      result.sanitized = sanitizeDateString(input)
      if (!result.sanitized) {
        result.isValid = false
        result.warnings.push('Invalid date format')
      }
      break
    default:
      result.sanitized = sanitizeGenericInput(input, maxLength)
  }
  
  return result
}