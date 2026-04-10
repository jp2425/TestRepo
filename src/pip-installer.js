'use strict';

/**
 * Installs a Python package by delegating to the pip CLI.
 *
 * Isolating pip invocation here keeps the orchestrator free from exec details
 * and makes this behaviour straightforward to stub in tests.
 */
class PipInstaller {
  /**
   * @param {import('@actions/exec')} exec - The @actions/exec instance.
   * @param {import('@actions/core')} core - The @actions/core instance.
   */
  constructor(exec, core) {
    this._exec = exec;
    this._core = core;
  }

  /**
   * Runs `<pipExec> install <target> [...extraArgs]`.
   *
   * @param {string} target   - Absolute path to a `.whl` file or a source root.
   * @param {string} pipExec  - The pip binary to invoke (e.g. "pip", "pip3").
   * @param {string} pipArgs  - Space-separated extra arguments forwarded to pip.
   * @returns {Promise<void>}
   * @throws {Error} When pip exits with a non-zero status.
   */
  async install(target, pipExec, pipArgs) {
    const extraArgs = pipArgs
      ? pipArgs.split(/\s+/).filter((arg) => arg.length > 0)
      : [];

    await this._exec.exec(pipExec, ['install', target, ...extraArgs]);
  }
}

module.exports = { PipInstaller };
