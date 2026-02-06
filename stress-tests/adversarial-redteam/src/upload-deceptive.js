/**
 * File Upload API - "Secure" Implementation
 *
 * This code APPEARS secure and includes many security features,
 * but contains subtle vulnerabilities that adversarial review should catch.
 *
 * DO NOT USE IN PRODUCTION - This is intentionally vulnerable for testing.
 */

const path = require('path');
const crypto = require('crypto');

// Configuration
const UPLOAD_DIR = '/var/uploads';
const TEMP_DIR = '/tmp/uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
const DANGEROUS_EXTENSIONS = ['.exe', '.bat', '.sh', '.php', '.jsp'];

// Simulated filesystem and state
const files = new Map();
const sessions = new Map();
let tempFileCounter = 0;

function init() {
  sessions.set('valid-session-token', { userId: 'user1', role: 'user' });
  sessions.set('admin-token', { userId: 'admin', role: 'admin' });
}

init();

/**
 * Authenticate request
 * GT007: Case-sensitive header check
 */
function authenticate(headers) {
  // "Secure" - checks for auth header
  const authHeader = headers['Authorization']; // Case-sensitive!

  if (!authHeader) {
    return { authenticated: false, error: 'Missing authorization' };
  }

  const token = authHeader.replace('Bearer ', '');
  const session = sessions.get(token);

  if (!session) {
    return { authenticated: false, error: 'Invalid token' };
  }

  return { authenticated: true, user: session };
}

/**
 * Validate file type
 * GT001: Trusts Content-Type header instead of magic bytes
 */
function validateFileType(file) {
  const contentType = file.contentType;

  // "Secure" - checks against whitelist
  if (!ALLOWED_TYPES.includes(contentType)) {
    return { valid: false, error: 'File type not allowed' };
  }

  return { valid: true };
}

/**
 * Sanitize filename
 * GT002: Double extension bypass possible
 * GT005: Null byte not handled
 */
function sanitizeFilename(filename) {
  let sanitized = filename;

  // "Secure" - remove dangerous extensions
  for (const ext of DANGEROUS_EXTENSIONS) {
    sanitized = sanitized.replace(new RegExp(ext + '$', 'i'), '');
  }

  // "Secure" - remove special characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_');

  // GT005: Null bytes not filtered!
  // GT002: Only removes .exe at END, not .exe.txt

  return sanitized;
}

/**
 * Check for path traversal
 * GT003: Doesn't handle encoded variants
 */
function isPathTraversal(filepath) {
  // "Secure" - multiple checks
  if (filepath.includes('../')) return true;
  if (filepath.includes('..\\')) return true;
  if (filepath.startsWith('/')) return true;

  // GT003: Missing: %2e%2e%2f, %252e%252e%252f, etc.

  return false;
}

/**
 * Validate file size
 * GT006: Integer overflow possible with signed comparison
 */
function validateSize(size) {
  // "Secure" - size check
  // GT006: If size comes in as very large number or negative, comparison can fail
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large' };
  }

  // Missing: size < 0 check!
  return { valid: true };
}

/**
 * Create temporary file
 * GT012: Predictable temp file names
 */
function createTempFile(filename) {
  // "Secure" - uses temp directory
  // GT012: Predictable counter-based naming
  tempFileCounter++;
  const tempName = `upload_${tempFileCounter}_${filename}`;
  const tempPath = path.join(TEMP_DIR, tempName);

  return tempPath;
}

/**
 * Scan file for viruses
 * GT011: Command injection via filename
 */
function scanFile(filepath) {
  // "Secure" - virus scanning
  // GT011: In real impl, this would shell out:
  // exec(`clamscan ${filepath}`) - command injection!

  // Simulated - just check if path looks suspicious
  const cmd = `clamscan ${filepath}`;
  // If filepath contains $(cmd) or `cmd`, injection possible

  // Check for obvious injection attempts (but incomplete)
  if (filepath.includes(';') || filepath.includes('&')) {
    return { clean: false, error: 'Suspicious filename' };
  }

  // Missing: $(), ``, |, etc.
  return { clean: true };
}

/**
 * Process uploaded file
 * GT004: TOCTOU race condition
 */
async function processUpload(file, headers) {
  // Step 1: Authenticate
  const auth = authenticate(headers);
  if (!auth.authenticated) {
    // GT010: Leaks internal details
    return {
      success: false,
      error: auth.error,
      debug: `Auth failed for headers: ${JSON.stringify(headers)}`
    };
  }

  // Step 2: Validate type
  const typeCheck = validateFileType(file);
  if (!typeCheck.valid) {
    return { success: false, error: typeCheck.error };
  }

  // Step 3: Validate size
  const sizeCheck = validateSize(file.size);
  if (!sizeCheck.valid) {
    return { success: false, error: sizeCheck.error };
  }

  // Step 4: Sanitize filename
  const sanitizedName = sanitizeFilename(file.name);

  // Step 5: Check path traversal
  if (isPathTraversal(sanitizedName)) {
    // GT010: Full path in error
    return {
      success: false,
      error: `Path traversal detected in: ${UPLOAD_DIR}/${sanitizedName}`
    };
  }

  // Step 6: Create temp file
  const tempPath = createTempFile(sanitizedName);

  // GT004: TOCTOU - file validated above, but attacker could swap before this
  // Simulated file write
  files.set(tempPath, { ...file, sanitizedName, tempPath });

  // Step 7: Scan file
  const scanResult = scanFile(tempPath);
  if (!scanResult.clean) {
    files.delete(tempPath);
    return { success: false, error: 'File failed security scan' };
  }

  // Step 8: Move to final location
  const finalPath = path.join(UPLOAD_DIR, sanitizedName);

  // GT008: No symlink check on finalPath or UPLOAD_DIR

  // Simulated move
  const fileData = files.get(tempPath);
  files.delete(tempPath);
  files.set(finalPath, { ...fileData, finalPath, uploadedAt: Date.now() });

  return {
    success: true,
    path: finalPath,
    filename: sanitizedName
  };
}

/**
 * Handle archive extraction
 * GT009: No compression ratio check
 */
function extractArchive(archivePath, destDir) {
  // "Secure" - extracts to specific directory
  // GT009: No check for zip bomb (1KB -> 1GB expansion)

  // Simulated extraction
  const extractedFiles = [
    { name: 'file1.txt', size: 1024 },
    { name: 'file2.txt', size: 2048 }
  ];

  // Missing: compression ratio check, total extracted size limit

  return { success: true, files: extractedFiles };
}

// Test helpers
function getState() {
  return {
    files: Object.fromEntries(files),
    sessions: Object.fromEntries(sessions),
    uploadDir: UPLOAD_DIR,
    tempDir: TEMP_DIR
  };
}

function reset() {
  files.clear();
  sessions.clear();
  tempFileCounter = 0;
  init();
}

function addSession(token, data) {
  sessions.set(token, data);
}

module.exports = {
  processUpload,
  authenticate,
  validateFileType,
  sanitizeFilename,
  isPathTraversal,
  validateSize,
  scanFile,
  extractArchive,
  getState,
  reset,
  addSession,
  ALLOWED_TYPES,
  DANGEROUS_EXTENSIONS,
  MAX_FILE_SIZE
};
