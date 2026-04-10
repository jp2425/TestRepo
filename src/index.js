'use strict';

const core = require('@actions/core');
const exec = require('@actions/exec');
const tc   = require('@actions/tool-cache');

const { ActionInputs }     = require('./inputs');
const { Downloader }       = require('./downloader');
const { ChecksumVerifier } = require('./checksum-verifier');
const { PackageLocator }   = require('./package-locator');
const { PipInstaller }     = require('./pip-installer');
const { MetadataResolver } = require('./metadata-resolver');
const { Action }           = require('./action');

const inputs     = new ActionInputs(core);
const downloader = new Downloader(tc, core);
const verifier   = new ChecksumVerifier(core);
const locator    = new PackageLocator(core);
const installer  = new PipInstaller(exec, core);
const resolver   = new MetadataResolver(exec, core);

const action = new Action({ inputs, downloader, verifier, locator, installer, resolver, tc, core });

action.run();
