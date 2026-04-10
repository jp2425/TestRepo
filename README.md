# py-installer-action

A GitHub Action that downloads a Python package from a URL and installs it using `pip`.
Accepts a **direct `.whl` link** or a **`.zip` archive** containing a wheel or source tree.

Designed for **internal Python packages** that are not publicly published on [PyPI](https://pypi.org/).

---

## Features

- Downloads from any HTTP/HTTPS URL — accepts a **direct `.whl`** or a **`.zip` archive**
- Supports **Bearer token authentication** for protected endpoints
- **SHA-256 checksum verification** — fails fast if the file has been tampered with
- **Configurable pip executable** — target a specific Python version or virtual environment
- **Automatic retries** — retries the download on transient network failures
- When given a zip, auto-detects the installable target inside:
  - Prefers a pre-built **wheel** (`.whl`) file
  - Falls back to a **source tree** containing `pyproject.toml`, `setup.py`, or `setup.cfg`
- Forwards optional extra arguments to `pip install`
- Exposes **`package-name`** and **`package-version`** outputs for downstream steps
- Emits GitHub Actions **error annotations** on failure
- Implemented entirely in **Node.js** — no Python required to run the action itself

---

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `url` | ✅ | — | URL of the package — a direct `.whl` file or a `.zip` archive containing a wheel or source tree |
| `token` | No | `''` | Bearer token for authenticated/protected download URLs |
| `pip-args` | No | `''` | Additional arguments forwarded verbatim to `pip install` |
| `checksum` | No | `''` | Expected SHA-256 hex digest of the zip. Fails if the download does not match |
| `pip-executable` | No | `pip` | The pip binary to invoke (e.g. `pip3`, `pip3.12`, or an absolute path) |
| `retries` | No | `0` | Number of additional download attempts on transient failure |

## Outputs

| Output | Description |
|--------|-------------|
| `package-name` | Normalised name of the installed package |
| `package-version` | Version of the installed package as reported by `pip show` |

---

## Usage

### Basic (zip archive)

```yaml
- uses: your-org/py-installer-action@v1
  with:
    url: 'https://example.com/packages/my-package.zip'
```

### Direct wheel URL

```yaml
- uses: your-org/py-installer-action@v1
  with:
    url: 'https://example.com/packages/my_package-1.0.0-py3-none-any.whl'
    token: ${{ secrets.PACKAGE_TOKEN }}
```

### With authentication and checksum verification

```yaml
- uses: your-org/py-installer-action@v1
  with:
    url: 'https://example.com/packages/my-package.zip'
    token: ${{ secrets.PACKAGE_TOKEN }}
    checksum: 'a3f1e2...'   # SHA-256 hex digest of the zip
```

### Targeting a specific Python version

```yaml
- uses: your-org/py-installer-action@v1
  with:
    url: 'https://example.com/packages/my-package.zip'
    pip-executable: 'pip3.12'
```

### With retries and extra pip arguments

```yaml
- uses: your-org/py-installer-action@v1
  with:
    url: 'https://example.com/packages/my-package.zip'
    retries: '3'
    pip-args: '--upgrade --no-deps'
```

### Consuming the outputs

```yaml
- id: install
  uses: your-org/py-installer-action@v1
  with:
    url: 'https://example.com/packages/my-package.zip'

- name: Print installed version
  run: echo "Installed ${{ steps.install.outputs.package-name }} ${{ steps.install.outputs.package-version }}"
```

---

## Full workflow example

```yaml
name: CI

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install internal package
        id: install
        uses: your-org/py-installer-action@v1
        with:
          url: 'https://example.com/packages/my-package.zip'
          token: ${{ secrets.PACKAGE_TOKEN }}
          checksum: 'a3f1e2...'
          pip-executable: 'pip3.12'
          retries: '2'

      - name: Run tests
        run: |
          echo "Testing ${{ steps.install.outputs.package-name }}==${{ steps.install.outputs.package-version }}"
          pytest
```

---

## How it works

1. **Download** – the zip archive is fetched from the provided URL, optionally with a `Bearer` token in the `Authorization` header. The download is retried up to `retries` times on failure.
2. **Verify** – if `checksum` is set, the SHA-256 digest of the downloaded file is compared against the expected value. The step fails immediately on mismatch.
3. **Extract** – the archive is unpacked into a temporary directory managed by the runner.
4. **Discover** – the action scans the extracted contents for an installable target (wheel first, then source tree).
5. **Install** – `pip install` (or the configured `pip-executable`) is run against the discovered target, with any `pip-args` appended.
6. **Report** – `package-name` and `package-version` outputs are set from the wheel filename or `pip show`, for use in downstream steps.

---

## Requirements

- Python and pip must be available on the runner — use [`actions/setup-python`](https://github.com/actions/setup-python) if needed.
- The runner must have network access to the provided URL.

---

## Repository structure

```
action.yml       # Action definition (inputs, outputs, Node.js runner)
src/
  index.js       # Action source: download → verify → extract → discover → install
```

---

## License

MIT
