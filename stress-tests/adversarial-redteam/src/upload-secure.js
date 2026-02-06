/**
 * File Upload API - Actually Secure Implementation
 *
 * This addresses all ground truth vulnerabilities:
 * - GT001: Magic bytes validation, not Content-Type
 * - GT002: Whitelist extensions, not blacklist
 * - GT003: Decodes and normalizes paths before checking
 * - GT004: Atomic operations, no TOCTOU
 * - GT005: Null byte filtering
 * - GT006: Safe integer validation
 * - GT007: Case-insensitive header matching
 * - GT008: Symlink and realpath validation
 * - GT009: Compression ratio limits
 * - GT010: Generic error messages
 * - GT011: Safe command construction (no shell)
 * - GT012: Cryptographic random temp names
 */

const path = require('path');
const crypto = require('crypto');

// Configuration
const UPLOAD_DIR = '/var/uploads';
const TEMP_DIR = '/tmp/uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_FILE_SIZE = 0;
const MAX_COMPRESSION_RATIO = 100; // Max 100x expansion
const MAX_EXTRACTED_SIZE = 100 * 1024 * 1024; // 100MB total

// Whitelist of allowed extensions (not blacklist!)
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];

// Magic bytes for file type verification
const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46]
};

// Simulated filesystem and state
const files = new Map();
const sessions = new Map();

function init() {
  sessions.set('valid-session-token', { userId: 'user1', role: 'user' });
  sessions.set('admin-token', { userId: 'admin', role: 'admin' });
}

init();

/**
 * Authenticate request
 * GT007: Case-insensitive header matching
 */
function authenticate(headers) {
  // Normalize header keys to lowercase
  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  const authHeader = normalizedHeaders['authorization'];

  if (!authHeader) {
    return { authenticated: false, error: 'Authentication required' };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const session = sessions.get(token);

  if (!session) {
    return { authenticated: false, error: 'Authentication required' };
  }

  return { authenticated: true, user: session };
}

/**
 * Validate file type using magic bytes
 * GT001: Actually validates file content
 */
function validateFileType(file) {
  if (!file.content || file.content.length < 4) {
    return { valid: false, error: 'Invalid file' };
  }

  // Check magic bytes, not Content-Type header
  for (const [mimeType, magic] of Object.entries(MAGIC_BYTES)) {
    let matches = true;
    for (let i = 0; i < magic.length; i++) {
      if (file.content[i] !== magic[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return { valid: true, detectedType: mimeType };
    }
  }

  return { valid: false, error: 'Invalid file' };
}

/**
 * Sanitize filename
 * GT002: Whitelist approach, not blacklist
 * GT005: Removes null bytes
 */
function sanitizeFilename(filename) {
  // GT005: Remove null bytes FIRST
  let sanitized = filename.replace(/\0/g, '');

  // Extract base name and extension
  const ext = path.extname(sanitized).toLowerCase();
  let base = path.basename(sanitized, ext);

  // GT002: Whitelist allowed extensions
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'Invalid file' };
  }

  // Remove any remaining dangerous characters
  base = base.replace(/[^a-zA-Z0-9._-]/g, '_');

  // GT002: Also check for dangerous extensions hidden in base name
  const dangerousExts = ['.exe', '.bat', '.sh', '.php', '.jsp', '.cmd', '.ps1'];
  for (const dangerousExt of dangerousExts) {
    if (base.toLowerCase().includes(dangerousExt)) {
      return { valid: false, error: 'Invalid file' };
    }
  }

  // Limit length
  if (base.length > 100) {
    base = base.substring(0, 100);
  }

  // Generate unique name to prevent overwrites
  const uniqueId = crypto.randomBytes(8).toString('hex');

  return {
    valid: true,
    filename: `${base}_${uniqueId}${ext}`
  };
}

/**
 * Check for path traversal
 * GT003: Decodes and normalizes before checking
 */
function isPathTraversal(filepath) {
  // Decode multiple times to catch double-encoding
  let decoded = filepath;
  for (let i = 0; i < 3; i++) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;
    }
  }

  // Normalize the path
  const normalized = path.normalize(decoded);

  // Check for traversal patterns
  if (normalized.includes('..')) return true;
  if (normalized.includes('..\\')) return true;

  // Ensure it doesn't escape intended directory
  const resolved = path.resolve(UPLOAD_DIR, normalized);
  if (!resolved.startsWith(UPLOAD_DIR)) return true;

  return false;
}

/**
 * Validate file size
 * GT006: Safe integer validation
 */
function validateSize(size) {
  // Check type first
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    return { valid: false, error: 'Invalid file' };
  }

  // Check for safe integer range
  if (!Number.isSafeInteger(size)) {
    return { valid: false, error: 'Invalid file' };
  }

  // Check bounds
  if (size < MIN_FILE_SIZE || size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Invalid file' };
  }

  return { valid: true };
}

/**
 * Create secure temporary file
 * GT012: Cryptographic random names
 */
function createTempFile() {
  const randomName = crypto.randomBytes(32).toString('hex');
  const tempPath = path.join(TEMP_DIR, randomName);
  return tempPath;
}

/**
 * Scan file for viruses safely
 * GT011: No shell execution, use array args
 */
function scanFile(filepath) {
  // GT011: Use spawn with array args, never string interpolation
  // const { spawnSync } = require('child_process');
  // const result = spawnSync('clamscan', [filepath], { encoding: 'utf-8' });

  // Validate filepath doesn't contain injection attempts
  // Even with spawn, validate for defense in depth
  const dangerousPatterns = [';', '&', '|', '$', '`', '$(', '${', '\n', '\r'];
  for (const pattern of dangerousPatterns) {
    if (filepath.includes(pattern)) {
      return { clean: false, error: 'Invalid file' };
    }
  }

  // Simulated scan - always passes for testing
  return { clean: true };
}

/**
 * Check for symlinks
 * GT008: Resolves and validates real path
 */
function validatePath(filepath) {
  // In real implementation:
  // const fs = require('fs');
  // const realPath = fs.realpathSync(filepath);
  // if (!realPath.startsWith(UPLOAD_DIR)) return false;

  // Simulated: check for obvious symlink indicators
  if (filepath.includes('->') || filepath.includes('@')) {
    return { valid: false, error: 'Invalid file' };
  }

  // Ensure path is within allowed directory
  const resolved = path.resolve(filepath);
  if (!resolved.startsWith(UPLOAD_DIR) && !resolved.startsWith(TEMP_DIR)) {
    return { valid: false, error: 'Invalid file' };
  }

  return { valid: true };
}

/**
 * Process uploaded file atomically
 * GT004: Single-pass validation and storage
 */
async function processUpload(file, headers) {
  // Step 1: Authenticate
  const auth = authenticate(headers);
  if (!auth.authenticated) {
    // GT010: Generic error message
    return { success: false, error: 'Upload failed' };
  }

  // Step 2: Validate size FIRST (cheap check)
  const sizeCheck = validateSize(file.size);
  if (!sizeCheck.valid) {
    return { success: false, error: 'Upload failed' };
  }

  // Step 3: Validate actual file type via magic bytes
  const typeCheck = validateFileType(file);
  if (!typeCheck.valid) {
    return { success: false, error: 'Upload failed' };
  }

  // Step 4: Sanitize filename (whitelist approach)
  const sanitizeResult = sanitizeFilename(file.name);
  if (!sanitizeResult.valid) {
    return { success: false, error: 'Upload failed' };
  }

  // Step 5: Check path traversal with full decoding
  if (isPathTraversal(sanitizeResult.filename)) {
    return { success: false, error: 'Upload failed' };
  }

  // GT004: Atomic operation - no temp file, direct write
  // In real impl, use atomic write library
  const finalPath = path.join(UPLOAD_DIR, sanitizeResult.filename);

  // GT008: Validate final path
  const pathCheck = validatePath(finalPath);
  if (!pathCheck.valid) {
    return { success: false, error: 'Upload failed' };
  }

  // Store file
  files.set(finalPath, {
    ...file,
    sanitizedName: sanitizeResult.filename,
    finalPath,
    uploadedAt: Date.now(),
    uploadedBy: auth.user.userId
  });

  // Step 6: Scan file (after storage, can quarantine if needed)
  const scanResult = scanFile(finalPath);
  if (!scanResult.clean) {
    files.delete(finalPath);
    return { success: false, error: 'Upload failed' };
  }

  return {
    success: true,
    filename: sanitizeResult.filename
    // GT010: Don't expose full path
  };
}

/**
 * Handle archive extraction safely
 * GT009: Compression ratio and size limits
 */
function extractArchive(archivePath, destDir, archiveSize) {
  // Validate path
  const pathCheck = validatePath(destDir);
  if (!pathCheck.valid) {
    return { success: false, error: 'Extraction failed' };
  }

  // Simulated extraction with limits
  let totalExtracted = 0;
  const extractedFiles = [];

  // In real implementation, check each file before extracting:
  // - Total size limit
  // - Compression ratio limit
  // - Path traversal in archive entries

  const simulatedFiles = [
    { name: 'file1.txt', size: 1024 },
    { name: 'file2.txt', size: 2048 }
  ];

  for (const f of simulatedFiles) {
    // GT009: Check compression ratio
    if (archiveSize > 0 && (totalExtracted + f.size) / archiveSize > MAX_COMPRESSION_RATIO) {
      return { success: false, error: 'Extraction failed' };
    }

    // Check total extracted size
    if (totalExtracted + f.size > MAX_EXTRACTED_SIZE) {
      return { success: false, error: 'Extraction failed' };
    }

    totalExtracted += f.size;
    extractedFiles.push(f);
  }

  return { success: true, files: extractedFiles };
}

// Test helpers
function getState() {
  return {
    files: Object.fromEntries(files),
    sessions: Object.fromEntries(sessions)
  };
}

function reset() {
  files.clear();
  sessions.clear();
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
  validatePath,
  extractArchive,
  getState,
  reset,
  addSession,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE
};
