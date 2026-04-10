'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Resolves the name and version of an installed Python package from various
 * sources: the wheel filename, source-tree build descriptors, or `pip show`.
 *
 * Keeping metadata resolution isolated allows the orchestrator to remain
 * focused on the installation pipeline and makes each strategy unit-testable.
 */
class MetadataResolver {
  /**
   * @param {import('@actions/exec')} exec - The @actions/exec instance.
   * @param {import('@actions/core')} core - The @actions/core instance.
   */
  constructor(exec, core) {
    this._exec = exec;
    this._core = core;
  }

  /**
   * Extracts name and version from a wheel filename.
   *
   * Wheel filename format (PEP 427):
   *   `{distribution}-{version}(-{build})?-{python}-{abi}-{platform}.whl`
   *
   * @param {string} wheelPath - Full path or filename of the wheel.
   * @returns {{ packageName: string, packageVersion: string }}
   */
  fromWheel(wheelPath) {
    const parts = path.basename(wheelPath, '.whl').split('-');
    return {
      // PEP 427: underscores in the distribution name replace hyphens/dots.
      packageName:    parts[0].replace(/_/g, '-'),
      packageVersion: parts[1] ?? '',
    };
  }

  /**
   * Attempts to read the package name from build descriptor files in `dir`.
   * Tries `pyproject.toml` first, then `setup.cfg`.
   *
   * @param {string} dir - Directory containing the source tree.
   * @returns {{ packageName: string, packageVersion: string }}
   *   `packageVersion` is always `''` since source trees do not reliably
   *   expose their version without executing build code.
   */
  fromSourceTree(dir) {
    const packageName =
      this.#nameFromPyprojectToml(dir) ??
      this.#nameFromSetupCfg(dir) ??
      path.basename(dir);

    return { packageName, packageVersion: '' };
  }

  /**
   * Runs `<pipExec> show <packageName>` and parses the `Name` and `Version`
   * fields from its output, returning the post-installation ground truth.
   *
   * @param {string} pipExec      - The pip executable (e.g. "pip", "pip3").
   * @param {string} packageName  - Package name to query.
   * @returns {Promise<{ packageName: string, packageVersion: string }>}
   */
  async fromPipShow(pipExec, packageName) {
    let output = '';

    try {
      await this._exec.exec(pipExec, ['show', packageName], {
        silent: true,
        ignoreReturnCode: true,
        listeners: {
          stdout: (data) => { output += data.toString(); },
        },
      });
    } catch {
      return { packageName, packageVersion: '' };
    }

    const nameMatch    = output.match(/^Name:\s*(.+)$/m);
    const versionMatch = output.match(/^Version:\s*(.+)$/m);

    return {
      packageName:    nameMatch    ? nameMatch[1].trim()    : packageName,
      packageVersion: versionMatch ? versionMatch[1].trim() : '',
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Reads the `name` field from `pyproject.toml` using a simple regex to
   * avoid pulling in a full TOML parser.
   *
   * @param {string} dir
   * @returns {string|null}
   */
  #nameFromPyprojectToml(dir) {
    const tomlPath = path.join(dir, 'pyproject.toml');
    if (!fs.existsSync(tomlPath)) return null;
    const content = fs.readFileSync(tomlPath, 'utf8');
    const match   = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
    return match ? match[1] : null;
  }

  /**
   * Reads the `name` field from `setup.cfg`.
   *
   * @param {string} dir
   * @returns {string|null}
   */
  #nameFromSetupCfg(dir) {
    const cfgPath = path.join(dir, 'setup.cfg');
    if (!fs.existsSync(cfgPath)) return null;
    const content = fs.readFileSync(cfgPath, 'utf8');
    const match   = content.match(/^\s*name\s*=\s*(.+)$/m);
    return match ? match[1].trim() : null;
  }
}

module.exports = { MetadataResolver };
