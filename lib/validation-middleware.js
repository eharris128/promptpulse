// Validation middleware for API endpoints
import {
  validateAndSanitize,
  detectSqlInjection,
  sanitizeMachineId,
  sanitizeProjectPath,
  sanitizeDateString,
  sanitizeSearchInput
} from "./security-utils.js";
import { logger } from "./logger.js";

/**
 * Generic input validation middleware
 * @param {Object} config - Configuration for validation rules
 * @returns {Function} - Express middleware function
 */
export function validateInput(config = {}) {
  return (req, res, next) => {
    const { query, body, params } = req;
    const warnings = [];

    // Validate query parameters
    if (config.query && query) {
      for (const [key, rules] of Object.entries(config.query)) {
        if (query[key]) {
          const result = validateAndSanitize(query[key], rules);
          if (!result.isValid) {
            return res.status(400).json({
              error: `Invalid query parameter: ${key}`,
              details: result.warnings
            });
          }
          query[key] = result.sanitized;
          warnings.push(...result.warnings.map(w => `Query ${key}: ${w}`));
        }
      }
    }

    // Validate body parameters
    if (config.body && body) {
      for (const [key, rules] of Object.entries(config.body)) {
        if (body[key]) {
          const result = validateAndSanitize(body[key], rules);
          if (!result.isValid) {
            return res.status(400).json({
              error: `Invalid body parameter: ${key}`,
              details: result.warnings
            });
          }
          body[key] = result.sanitized;
          warnings.push(...result.warnings.map(w => `Body ${key}: ${w}`));
        }
      }
    }

    // Validate URL parameters
    if (config.params && params) {
      for (const [key, rules] of Object.entries(config.params)) {
        if (params[key]) {
          const result = validateAndSanitize(params[key], rules);
          if (!result.isValid) {
            return res.status(400).json({
              error: `Invalid URL parameter: ${key}`,
              details: result.warnings
            });
          }
          params[key] = result.sanitized;
          warnings.push(...result.warnings.map(w => `Param ${key}: ${w}`));
        }
      }
    }

    // Log warnings if any suspicious activity detected
    if (warnings.length > 0) {
      logger.warn("Input validation warnings", {
        userId: req.user?.id,
        endpoint: req.originalUrl,
        method: req.method,
        warnings,
        ip: req.ip
      });
    }

    next();
  };
}

/**
 * SQL injection detection middleware
 */
export function detectSqlInjectionMiddleware(req, res, next) {
  const inputs = [
    ...Object.values(req.query || {}),
    ...Object.values(req.body || {}),
    ...Object.values(req.params || {})
  ];

  const suspiciousInputs = inputs.filter(input =>
    typeof input === "string" && detectSqlInjection(input)
  );

  if (suspiciousInputs.length > 0) {
    logger.error("Potential SQL injection attempt detected", {
      userId: req.user?.id,
      endpoint: req.originalUrl,
      method: req.method,
      suspiciousInputs,
      ip: req.ip,
      userAgent: req.get("User-Agent")
    });

    // For now, just log - could be enhanced to block requests
    // return res.status(400).json({ error: 'Invalid input detected' })
  }

  next();
}

/**
 * Common validation rules for different input types
 */
export const ValidationRules = {
  machineId: {
    type: "machineId",
    maxLength: 100,
    checkSqlInjection: true
  },
  projectPath: {
    type: "projectPath",
    maxLength: 500,
    checkSqlInjection: true
  },
  dateString: {
    type: "date",
    checkSqlInjection: true
  },
  searchQuery: {
    type: "search",
    maxLength: 100,
    checkSqlInjection: true
  },
  displayName: {
    type: "displayName",
    maxLength: 50,
    checkSqlInjection: true
  },
  apiKey: {
    type: "apiKey",
    maxLength: 100,
    checkSqlInjection: true
  },
  limitNumber: {
    type: "generic",
    maxLength: 10,
    checkSqlInjection: true
  },
  period: {
    type: "generic",
    maxLength: 20,
    checkSqlInjection: true
  }
};

/**
 * Pre-configured validation middleware for common endpoints
 */
export const CommonValidators = {
  // Usage endpoints
  usageQuery: validateInput({
    query: {
      machineId: ValidationRules.machineId,
      since: ValidationRules.dateString,
      until: ValidationRules.dateString,
      limit: ValidationRules.limitNumber,
      projectPath: ValidationRules.projectPath,
      activeOnly: ValidationRules.period
    }
  }),

  // Leaderboard endpoints
  leaderboardParams: validateInput({
    params: {
      period: ValidationRules.period
    }
  }),

  // Search endpoints
  searchQuery: validateInput({
    query: {
      q: ValidationRules.searchQuery,
      machineId: ValidationRules.machineId,
      projectPath: ValidationRules.projectPath
    }
  }),

  // User profile endpoints
  userProfile: validateInput({
    body: {
      displayName: ValidationRules.displayName,
      username: ValidationRules.displayName
    }
  })
};

/**
 * Rate limiting with enhanced security logging
 */
export function securityRateLimit(options = {}) {
  const { maxRequests = 100, windowMs = 15 * 60 * 1000 } = options;

  return (req, res, next) => {
    // This would integrate with existing rate limiting
    // but add security-focused logging

    const key = `${req.ip  }:${  req.originalUrl}`;

    // Could implement Redis-based rate limiting here
    // For now, just pass through to existing rate limiter

    next();
  };
}

/**
 * Request sanitization middleware - sanitizes all inputs
 */
export function sanitizeAllInputs(req, res, next) {
  // Sanitize query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string") {
        req.query[key] = sanitizeInput(value, key);
      }
    }
  }

  // Sanitize body parameters
  if (req.body && typeof req.body === "object") {
    sanitizeObject(req.body);
  }

  // Sanitize URL parameters
  if (req.params) {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === "string") {
        req.params[key] = sanitizeInput(value, key);
      }
    }
  }

  next();
}

/**
 * Helper function to sanitize input based on parameter name
 */
function sanitizeInput(value, paramName) {
  const lowerParam = paramName.toLowerCase();

  if (lowerParam.includes("machine")) {
    return sanitizeMachineId(value);
  } else if (lowerParam.includes("project") || lowerParam.includes("path")) {
    return sanitizeProjectPath(value);
  } else if (lowerParam.includes("date") || lowerParam.includes("since") || lowerParam.includes("until")) {
    return sanitizeDateString(value) || value;
  } else if (lowerParam.includes("search") || lowerParam === "q") {
    return sanitizeSearchInput(value);
  } else {
    return validateAndSanitize(value, { type: "generic" }).sanitized;
  }
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== "object") return;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      obj[key] = sanitizeInput(value, key);
    } else if (typeof value === "object" && value !== null) {
      sanitizeObject(value);
    }
  }
}

/**
 * Security headers middleware
 */
export function securityHeaders(req, res, next) {
  // Add security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  next();
}
