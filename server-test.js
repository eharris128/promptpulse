import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.join(__dirname, ".env.test") });

// Ensure we're using the test environment
process.env.NODE_ENV = "test";

// Verify critical test environment variables
if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set in test environment");
  process.exit(1);
}

if (!process.env.PORT) {
  console.warn("WARNING: PORT not set in test environment, defaulting to 3002");
  process.env.PORT = "3002";
}

console.log(`Starting test server on port ${process.env.PORT}`);
console.log(`Database: ${process.env.DATABASE_URL ? "Connected" : "Not configured"}`);

// Import and start the server
import("./server.js");
