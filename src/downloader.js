'use strict';

/**
 * Downloads a remote archive to a local temporary file with optional retry
 * logic for transient network failures.
 */
class Downloader {
  /**
   * @param {import('@actions/tool-cache')} tc   - The @actions/tool-cache instance.
   * @param {import('@actions/core')}       core - The @actions/core instance.
   */
  constructor(tc, core) {
    this._tc   = tc;
    this._core = core;
  }

  /**
   * Downloads `url` and returns the local path of the saved file.
   *
   * Retries the download up to `retries` additional times on failure.
   * The `Authorization` header is set to `auth` when provided.
   *
   * @param {string}           url     - Remote URL to download.
   * @param {string|undefined} auth    - Value for the Authorization header.
   * @param {number}           retries - Number of extra attempts (0 = no retries).
   * @returns {Promise<string>} Absolute path to the downloaded file.
   * @throws {Error} After all attempts have been exhausted.
   */
  async download(url, auth, retries = 0) {
    const maxAttempts = retries + 1;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        this._core.warning(`Retrying download (attempt ${attempt} of ${maxAttempts})…`);
      }

      try {
        return await this._tc.downloadTool(url, undefined, auth);
      } catch (err) {
        lastError = err;
        this._core.warning(`Download attempt ${attempt} failed: ${err.message}`);
      }
    }

    throw lastError;
  }
}

module.exports = { Downloader };
