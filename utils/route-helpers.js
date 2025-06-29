// Middleware to add dbManager to request object
export function addDbManagerToRequest(dbManager) {
  return (req, res, next) => {
    req.dbManager = dbManager;
    next();
  };
}