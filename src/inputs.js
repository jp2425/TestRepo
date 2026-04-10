'use strict';

/**
 * Reads, parses, and validates all GitHub Actions inputs for this action.
 *
 * Centralising input handling here keeps every other class free from
 * `@actions/core` knowledge and makes unit-testing straightforward — pass
 * any plain object that implements `getInput()`.
 */
class ActionInputs {
  /**
   * @param {import('@actions/core')} core - The @actions/core instance.
   */
  constructor(core) {
    this._url          = core.getInput('url', { required: true });
    this._token        = core.getInput('token')          || '';
    this._pipArgs      = core.getInput('pip-args')       || '';
    this._checksum     = core.getInput('checksum')       || '';
    this._pipExec      = core.getInput('pip-executable') || 'pip';

    const raw    = parseInt(core.getInput('retries') || '0', 10);
    this._retries = isNaN(raw) || raw < 0 ? 0 : raw;
  }

  /** Required. URL of the .zip archive to download. */
  get url()          { return this._url; }

  /** Optional Bearer token for the Authorization header. */
  get token()        { return this._token; }

  /** Optional extra arguments forwarded verbatim to `pip install`. */
  get pipArgs()      { return this._pipArgs; }

  /** Optional expected SHA-256 hex digest of the downloaded archive. */
  get checksum()     { return this._checksum; }

  /** The pip binary to invoke (default: "pip"). */
  get pipExecutable() { return this._pipExec; }

  /** Number of extra download attempts after the first failure. */
  get retries()      { return this._retries; }

  /** Returns the Authorization header value, or undefined when no token was given. */
  get authHeader()   { return this._token ? `Bearer ${this._token}` : undefined; }
}

module.exports = { ActionInputs };
