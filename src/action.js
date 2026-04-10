'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Orchestrates the full installation pipeline.
 *
 * All collaborators are injected via the constructor, making this class
 * fully testable in isolation without touching the filesystem or network.
 *
 * Pipeline:
 *   1. Read and validate action inputs.
 *   2. Download the file (wheel or zip) with optional Bearer token and retries.
 *   3. Verify SHA-256 checksum when provided.
 *   4. If the URL is a .whl, install directly — otherwise extract the zip and
 *      discover the package inside.
 *   5. Install with pip.
 *   6. Resolve the installed package name and version, and set action outputs.
 */
class Action {
  /**
   * @param {object}                                        deps
   * @param {import('./inputs').ActionInputs}               deps.inputs
   * @param {import('./downloader').Downloader}             deps.downloader
   * @param {import('./checksum-verifier').ChecksumVerifier} deps.verifier
   * @param {import('./package-locator').PackageLocator}    deps.locator
   * @param {import('./pip-installer').PipInstaller}        deps.installer
   * @param {import('./metadata-resolver').MetadataResolver} deps.resolver
   * @param {import('@actions/tool-cache')}                 deps.tc
   * @param {import('@actions/core')}                       deps.core
   */
  constructor({ inputs, downloader, verifier, locator, installer, resolver, tc, core }) {
    this._inputs      = inputs;
    this._downloader  = downloader;
    this._verifier    = verifier;
    this._locator     = locator;
    this._installer   = installer;
    this._resolver    = resolver;
    this._tc          = tc;
    this._core        = core;
  }

  /**
   * Runs the action. Any thrown error is caught and forwarded to
   * `core.setFailed`, which marks the workflow step as failed.
   *
   * @returns {Promise<void>}
   */
  async run() {
    try {
      await this.#download();
      await this.#install();
    } catch (error) {
      this._core.setFailed(error.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Private pipeline stages
  // ---------------------------------------------------------------------------

  /** Returns true when the URL points directly to a wheel file. */
  #isWheelUrl(url) {
    return new URL(url).pathname.toLowerCase().endsWith('.whl');
  }

  async #download() {
    const { url, authHeader, checksum, retries } = this._inputs;

    // Stage 1 — Download
    this._core.startGroup(`Downloading ${url}`);
    this._downloadedPath = await this._downloader.download(url, authHeader, retries);
    this._core.info(`Saved to: ${this._downloadedPath}`);
    this._core.endGroup();

    // Stage 2 — Verify checksum (optional)
    if (checksum) {
      this._core.startGroup('Verifying SHA-256 checksum');
      this._verifier.verify(this._downloadedPath, checksum);
      this._core.endGroup();
    }

    // Stage 3 — Extract zip, or use the wheel directly
    if (this.#isWheelUrl(url)) {
      // tool-cache saves to a UUID path with no extension; pip requires the
      // .whl extension to recognise the file as a wheel.
      const wheelName = path.basename(new URL(url).pathname);
      const wheelPath = path.join(path.dirname(this._downloadedPath), wheelName);
      fs.renameSync(this._downloadedPath, wheelPath);
      this._downloadedPath = wheelPath;
      this._core.info('Detected direct wheel URL — skipping extraction.');
      this._target = this._downloadedPath;
    } else {
      this._core.startGroup('Extracting archive');
      this._extractDir = await this._tc.extractZip(this._downloadedPath);
      this._core.info(`Extracted to: ${this._extractDir}`);
      this._core.endGroup();
    }
  }

  async #install() {
    const { pipExecutable, pipArgs } = this._inputs;

    // Stage 4 — Locate installable target (skip when wheel was downloaded directly)
    if (!this._target) {
      this._target = this._locator.find(this._extractDir);
    }

    // Stage 5 — Install
    this._core.startGroup(`Installing with ${pipExecutable}`);
    await this._installer.install(this._target, pipExecutable, pipArgs);
    this._core.endGroup();

    this._core.info('Package installed successfully.');

    // Stage 6 — Resolve and expose outputs
    await this.#setOutputs();
  }

  async #setOutputs() {
    const { pipExecutable } = this._inputs;
    const isWheel = this._target.endsWith('.whl');

    let { packageName, packageVersion } = isWheel
      ? this._resolver.fromWheel(this._target)
      : this._resolver.fromSourceTree(this._target);

    // Cross-check with `pip show` for the canonical normalised name and version.
    if (packageName) {
      const meta = await this._resolver.fromPipShow(pipExecutable, packageName);
      if (meta.packageName)    packageName    = meta.packageName;
      if (meta.packageVersion) packageVersion = meta.packageVersion;
    }

    this._core.setOutput('package-name',    packageName);
    this._core.setOutput('package-version', packageVersion);

    if (packageName && packageVersion) {
      this._core.info(`Installed ${packageName}==${packageVersion}`);
    }
  }
}

module.exports = { Action };
