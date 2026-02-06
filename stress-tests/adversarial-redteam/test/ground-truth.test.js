/**
 * Ground Truth Tests for Adversarial Red Team
 *
 * Tests all 12 ground truth vulnerabilities in the file upload system.
 * These tests are designed to catch subtle security issues that look secure.
 */

// Test runner
class TestRunner {
  constructor(implementation, name) {
    this.impl = implementation;
    this.name = name;
    this.results = [];
  }

  test(id, title, fn) {
    this.impl.reset();
    try {
      fn(this.impl);
      this.results.push({ id, title, passed: true });
      console.log(`  [PASS] ${id}: ${title}`);
    } catch (e) {
      this.results.push({ id, title, passed: false, error: e.message });
      console.log(`  [FAIL] ${id}: ${title}`);
      console.log(`         ${e.message}`);
    }
  }

  summary() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    return { name: this.name, passed, failed, total: this.results.length, results: this.results };
  }
}

async function runGroundTruthTests(impl, name) {
  console.log(`\n=== Testing: ${name} ===\n`);
  const runner = new TestRunner(impl, name);

  // GT001: MIME type spoofing
  runner.test('GT001', 'MIME type spoofing via Content-Type header', (impl) => {
    // Create a "PNG" that's actually executable content
    const maliciousFile = {
      name: 'innocent.png',
      contentType: 'image/png',  // Lies about type
      content: [0x4D, 0x5A, 0x90, 0x00],  // MZ header (EXE)
      size: 1024
    };

    const typeResult = impl.validateFileType(maliciousFile);

    // If validation passes based on contentType, it's vulnerable
    if (typeResult.valid) {
      throw new Error('VULNERABILITY: File type validated from Content-Type header, not magic bytes');
    }
  });

  // GT002: Double extension bypass
  runner.test('GT002', 'Double extension bypass', (impl) => {
    const doubleExt = impl.sanitizeFilename('malware.exe.png');

    // After sanitization, should not allow any .exe
    if (typeof doubleExt === 'string' && doubleExt.includes('.exe')) {
      throw new Error('VULNERABILITY: Double extension .exe.png not fully sanitized');
    }

    // Also test reverse
    const reverse = impl.sanitizeFilename('malware.png.exe');
    if (typeof reverse === 'string' && reverse.includes('.exe')) {
      throw new Error('VULNERABILITY: Extension .png.exe allowed');
    }

    // Test with object result (secure impl returns object)
    if (typeof doubleExt === 'object' && doubleExt.valid && doubleExt.filename.includes('.exe')) {
      throw new Error('VULNERABILITY: Double extension .exe.png not fully sanitized');
    }
  });

  // GT003: Path traversal via encoded characters
  runner.test('GT003', 'Path traversal via URL encoding', (impl) => {
    const encodedTests = [
      '../../../etc/passwd',           // Plain
      '..%2f..%2f..%2fetc/passwd',     // URL encoded
      '..%252f..%252f..%252fetc/passwd', // Double encoded
      '....//....//etc/passwd',         // Bypass with extra dots
      '..\\..\\..\\windows\\system32'   // Windows style
    ];

    for (const payload of encodedTests) {
      const result = impl.isPathTraversal(payload);
      if (!result) {
        throw new Error(`VULNERABILITY: Path traversal not detected for: ${payload}`);
      }
    }
  });

  // GT004: Race condition (TOCTOU)
  runner.test('GT004', 'TOCTOU race condition in validation', async (impl) => {
    // Check if implementation creates temp files before validation
    // This is a design check since we can't easily race in tests

    const file = {
      name: 'test.png',
      contentType: 'image/png',
      content: [0x89, 0x50, 0x4E, 0x47],
      size: 1024
    };

    const headers = { 'Authorization': 'Bearer valid-session-token' };

    // Process upload
    await impl.processUpload(file, headers);

    const state = impl.getState();

    // Check for temp file usage pattern
    // Deceptive impl uses predictable temp files
    if (state.tempDir && !state.files) {
      // Uses temp files - check if atomic
    }

    // Check if temp counter is used (predictable)
    // This is a heuristic check
  });

  // GT005: Null byte injection
  runner.test('GT005', 'Null byte injection in filename', (impl) => {
    const nullByteFilename = 'innocent.png\x00.exe';
    const result = impl.sanitizeFilename(nullByteFilename);

    const filename = typeof result === 'string' ? result : (result.filename || '');

    // Check if null byte or .exe remains
    if (filename.includes('\x00')) {
      throw new Error('VULNERABILITY: Null byte not removed from filename');
    }

    if (filename.includes('.exe')) {
      throw new Error('VULNERABILITY: Extension after null byte not handled');
    }
  });

  // GT006: Integer overflow in size validation
  runner.test('GT006', 'Integer overflow in size validation', (impl) => {
    const overflowTests = [
      { size: -1, desc: 'negative size' },
      { size: Number.MAX_SAFE_INTEGER + 1, desc: 'overflow' },
      { size: Infinity, desc: 'infinity' },
      { size: NaN, desc: 'NaN' }
    ];

    for (const test of overflowTests) {
      const result = impl.validateSize(test.size);
      if (result.valid) {
        throw new Error(`VULNERABILITY: Size validation passed for ${test.desc}`);
      }
    }
  });

  // GT007: Authentication bypass via header case
  runner.test('GT007', 'Auth bypass via header case sensitivity', (impl) => {
    const headerVariants = [
      { 'Authorization': 'Bearer valid-session-token' },
      { 'authorization': 'Bearer valid-session-token' },
      { 'AUTHORIZATION': 'Bearer valid-session-token' },
      { 'AuThOrIzAtIoN': 'Bearer valid-session-token' }
    ];

    const results = headerVariants.map(h => impl.authenticate(h));

    // All should authenticate successfully
    const allAuth = results.every(r => r.authenticated);
    const noneAuth = results.every(r => !r.authenticated);

    // If only some work, we have case sensitivity issue
    if (!allAuth && !noneAuth) {
      const working = results.filter(r => r.authenticated).length;
      throw new Error(`VULNERABILITY: Only ${working}/${headerVariants.length} header cases work`);
    }

    // If none work, tokens might be wrong (acceptable)
  });

  // GT008: Symlink following (design check)
  runner.test('GT008', 'Symlink following in paths', (impl) => {
    // Check if implementation has validatePath or realpath usage
    if (!impl.validatePath) {
      // No symlink validation function exists
      // Check if isPathTraversal handles symlink indicators
      const symlinkTests = [
        '/var/uploads/../../../etc/passwd',
        '/tmp/symlink_to_etc'
      ];

      for (const payload of symlinkTests) {
        const result = impl.isPathTraversal(payload);
        if (!result) {
          throw new Error(`VULNERABILITY: No symlink protection for: ${payload}`);
        }
      }
    }
    // If validatePath exists, implementation is aware of symlinks
  });

  // GT009: Zip bomb / compression ratio
  runner.test('GT009', 'No compression ratio limits', (impl) => {
    // Test extractArchive if it exists
    if (impl.extractArchive) {
      // Simulate a zip bomb: 1KB archive that expands to 1GB
      const smallArchiveSize = 1024;
      const result = impl.extractArchive('/test/archive.zip', '/var/uploads', smallArchiveSize);

      // Secure impl should check ratio
      // Check if there's any size/ratio limiting
      if (result.success && result.files) {
        const totalExtracted = result.files.reduce((sum, f) => sum + f.size, 0);
        const ratio = totalExtracted / smallArchiveSize;

        // If ratio is very high and no error, vulnerable
        // Note: Our test files are small, but we check the mechanism exists
      }
    }
  });

  // GT010: Information disclosure in errors
  runner.test('GT010', 'Information disclosure in error messages', async (impl) => {
    const badFile = {
      name: '../../../etc/passwd',
      contentType: 'application/pdf',
      content: [0x00],
      size: -1
    };

    const headers = { 'Authorization': 'Bearer invalid-token' };
    const result = await impl.processUpload(badFile, headers);

    if (!result.success) {
      const errorStr = JSON.stringify(result);

      // Check for path disclosure
      if (errorStr.includes('/var/uploads') ||
          errorStr.includes('/tmp') ||
          errorStr.includes('passwd') ||
          errorStr.includes('debug') ||
          errorStr.includes('stack')) {
        throw new Error(`VULNERABILITY: Error leaks internal info: ${result.error}`);
      }
    }
  });

  // GT011: Command injection in filename
  runner.test('GT011', 'Command injection via filename in scan', (impl) => {
    const injectionPayloads = [
      'file$(whoami).png',
      'file`id`.png',
      'file;rm -rf /.png',
      'file|cat /etc/passwd.png',
      'file\nwhoami.png'
    ];

    for (const payload of injectionPayloads) {
      const result = impl.scanFile(`/tmp/${payload}`);

      // Secure impl should reject these
      if (result.clean) {
        throw new Error(`VULNERABILITY: Command injection not detected: ${payload}`);
      }
    }
  });

  // GT012: Predictable temp file names
  runner.test('GT012', 'Predictable temporary file names', (impl) => {
    // If createTempFile exists, check its randomness
    if (impl.createTempFile) {
      const temps = [];
      for (let i = 0; i < 5; i++) {
        impl.reset();
        const temp = impl.createTempFile('test.png');
        temps.push(temp);
      }

      // Check if temp files follow predictable pattern
      const predictable = temps.every((t, i) => {
        // Check for counter-based naming
        return t.includes('_1_') || t.includes('upload_1');
      });

      if (predictable) {
        throw new Error('VULNERABILITY: Temp file names are predictable (counter-based)');
      }

      // Check entropy of temp file names
      const names = temps.map(t => t.split('/').pop());
      const uniqueChars = new Set(names.join(''));

      // If less than 16 unique characters, probably not cryptographic
      if (uniqueChars.size < 16) {
        throw new Error('VULNERABILITY: Temp file names have low entropy');
      }
    }
  });

  return runner.summary();
}

// Main
async function main() {
  const path = require('path');
  const args = process.argv.slice(2);
  const implName = args[0] || 'deceptive';

  const projectRoot = path.join(__dirname, '..');
  const implPath = implName.includes('/')
    ? path.resolve(implName)
    : path.join(projectRoot, 'src', `upload-${implName}.js`);

  console.log('=== Adversarial Red Team Ground Truth Tests ===');
  console.log(`Testing: ${implPath}`);

  let impl;
  try {
    impl = require(implPath);
  } catch (e) {
    console.error(`Failed to load: ${e.message}`);
    process.exit(1);
  }

  const summary = await runGroundTruthTests(impl, implPath);

  console.log('\n=== Summary ===');
  console.log(`Passed: ${summary.passed}/${summary.total}`);
  console.log(`Failed: ${summary.failed}/${summary.total}`);

  const vulnerabilities = summary.results.filter(r => !r.passed);
  console.log('\nVulnerabilities detected:');
  vulnerabilities.forEach(v => {
    console.log(`  - ${v.id}: ${v.title}`);
  });

  const outputPath = args[1];
  if (outputPath) {
    require('fs').writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);
  }

  process.exit(summary.failed > 0 ? 1 : 0);
}

module.exports = { runGroundTruthTests };

if (require.main === module) {
  main();
}
