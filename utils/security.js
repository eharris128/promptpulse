// Security utilities for SQL injection prevention

export const buildSecureWhereClause = (conditions) => {
  if (!conditions || conditions.length === 0) {
    return { clause: '', params: [] };
  }
  
  const placeholders = conditions.map(() => '?').join(' AND ');
  const clause = `WHERE ${conditions.map(c => c.condition).join(' AND ')}`;
  const params = conditions.map(c => c.value);
  
  return { clause, params };
};

export const validateSqlIdentifier = (identifier) => {
  // Only allow alphanumeric characters, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }
  return identifier;
};