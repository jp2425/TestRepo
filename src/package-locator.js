'use strict';

const fs   = require('fs');
const path = require('path');

/** Build descriptor filenames that identify a Python source tree. */
const SOURCE_BUILD_FILES = Object.freeze(['pyproject.toml', 'setup.py', 'setup.cfg']);

/**
 * Locates the installable Python package inside an extracted archive directory.
 *
 * Search strategy (first match wins):
 *   1. A pre-built wheel (`.whl`) — pip installs these directly and efficiently.
 *   2. A source tree root identified by a recognised build descriptor
 *      (`pyproject.toml`, `setup.py`, or `setup.cfg`).
 */
class PackageLocator {
  /**
   * @param {import('@actions/core')} core - The @actions/core instance.
   */
  constructor(core) {
    this._core = core;
  }

  /**
   * Finds the installable target inside `extractDir`.
   *
   * @param {string} extractDir - Root of the extracted archive.
   * @returns {string} Absolute path to a `.whl` file or a source root directory.
   * @throws {Error} When no installable package is found.
   */
  find(extractDir) {
    // Priority 1 — pre-built wheel
    const wheels = this.#findFiles(extractDir, name => name.endsWith('.whl'));
    if (wheels.length > 0) {
      this._core.info(`Found wheel: ${wheels[0]}`);
      return wheels[0];
    }

    // Priority 2 — source distribution
    for (const buildFile of SOURCE_BUILD_FILES) {
      const matches = this.#findFiles(extractDir, name => name === buildFile);
      if (matches.length > 0) {
        const packageDir = path.dirname(matches[0]);
        this._core.info(`Found source package at ${packageDir} (via ${buildFile})`);
        return packageDir;
      }
    }

    throw new Error(
      'No installable Python package found in the archive. ' +
      'Expected a .whl file or a directory containing ' +
      'pyproject.toml, setup.py, or setup.cfg.'
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Recursively walks `dir` and returns every file path for which `predicate`
   * returns `true`, sorted alphabetically.
   *
   * @param {string} dir
   * @param {(name: string, fullPath: string) => boolean} predicate
   * @returns {string[]}
   */
  #findFiles(dir, predicate) {
    const results = [];

    const walk = (current) => {
      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        return; // Skip unreadable directories.
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (predicate(entry.name, fullPath)) {
          results.push(fullPath);
        }
      }
    };

    walk(dir);
    return results.sort();
  }
}

module.exports = { PackageLocator };
