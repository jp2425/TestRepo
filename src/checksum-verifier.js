'use strict';

const crypto = require('crypto');
const fs     = require('fs');

/**
 * Verifies the SHA-256 digest of a downloaded file against an expected value.
 *
 * Keeping verification isolated here lets the orchestrator stay free of
 * cryptography details and makes the logic independently testable.
 */
class ChecksumVerifier {
  /**
   * @param {import('@actions/core')} core - The @actions/core instance.
   */
  constructor(core) {
    this._core = core;
  }

  /**
   * Computes the SHA-256 digest of `filePath` and compares it to `expected`.
   *
   * @param {string} filePath - Absolute path to the file to hash.
   * @param {string} expected - Expected lowercase hex digest.
   * @throws {Error} When the digest does not match.
   */
  verify(filePath, expected) {
    const data       = fs.readFileSync(filePath);
    const actual     = crypto.createHash('sha256').update(data).digest('hex').toLowerCase();
    const normalised = expected.toLowerCase().trim();

    if (actual !== normalised) {
      throw new Error(
        `SHA-256 checksum mismatch.\n  Expected: ${normalised}\n  Actual:   ${actual}`
      );
    }

    this._core.info(`SHA-256 verified: ${actual}`);
  }
}

module.exports = { ChecksumVerifier };
