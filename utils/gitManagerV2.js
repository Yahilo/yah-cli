/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const path = require('path')
const { pExec } = require('.')
const { configstore } = require('../configstore')
const { GitError } = require('./errors/gitError')

/**
 * @typedef pExecResolveObject
 * @type {Object}
 * @property {("success" | "error")} status Status of command execution
 * @property {String} msg Message from stdout or stderr
 */

class GitManager {
  /**
   *
   * @param {String} cwd The directory path where the command is to be run
   * @param {String} url Source url (git repo https or ssh id if ssh is true)
   */
  constructor(cwd, url) {
    this.cwd = path.resolve(cwd)
    this.ssh = configstore.get('prefersSsh')
    this.username = configstore.get('githubUserName')
    this.token = configstore.get('gitPersonalAccessToken')
    this.url = url
    this._createRemote(url)
  }

  /**
   * Selects and sets remote url from block meta data
   * @param {String} url
   */
  _createRemote(url) {
    this.remote = this.ssh ? url : url.replace('//github.com', `//${this.token}:x-oauth-basic@github.com`)
  }

  /* ********************************
   *************** A ****************
   ******************************** */

  addRemote(remoteName, parentRepo) {
    return this._run('remote', ['add', remoteName, parentRepo])
  }

  /* ********************************
   *************** C ****************
   ******************************** */

  commit(message, ...opts) {
    return this._run('commit', ['-m', `"${message}"`, ...opts])
  }

  clone(destination) {
    return this._run('clone', [this.remote, destination])
  }

  init() {
    return this._run('init', [])
  }

  checkoutBranch(name) {
    return this._run('checkout', [name])
  }

  checkoutTag(tag, branch = 'main') {
    return this._run('checkout', [`tags/${tag}`, `-b ${branch}`])
  }

  checkoutTagWithNoBranch(tag) {
    return this._run('checkout', [`${tag}`])
  }

  undoCheckout() {
    return this._run('checkout', ['-'])
  }

  cd(directoryPath) {
    this.cwd = path.resolve(directoryPath)
  }

  /* ********************************
   *************** F ****************
   ******************************** */

  fetch(from) {
    return this._run('fetch', [from])
  }

  /* ********************************
   *************** G ****************
   ******************************** */

  getGlobalUsername() {
    return this._run('config', ['--global', 'user.name'])
  }

  /* ********************************
   *************** M ****************
   ******************************** */

  merge(from, ...opts) {
    return this._run('merge', [from, ...opts])
  }

  /* ********************************
   *************** N ****************
   ******************************** */

  /**
   *
   * @param {String} branchName Name of new branch
   * @returns {Promise<pExecResolveObject>}
   */
  newBranch(branchName) {
    return this._run('checkout', ['-b', branchName])
  }

  /**
   *
   * @param {String} branchName Name of new branch
   * @returns {Promise<pExecResolveObject>}
   */
  renameBranch(branchName) {
    return this._run('branch', ['-M', branchName])
  }

  /* ********************************
   *************** P ****************
   ******************************** */

  pull() {
    this._run('pull', [this.remote])
  }

  currentBranch() {
    return this._run('branch', ['--show-current'])
  }

  diff() {
    return this._run('diff --name-only --staged', [])
  }

  push(upstreamBranch) {
    return this._run('push', [this.remote, upstreamBranch || 'main'])
  }

  pushTags() {
    return this._run('push', [this.remote, '--tags'])
  }

  addTag(tag, msg) {
    return this._run('tag', [`-a ${tag}`, `-m "${msg}"`])
  }

  /* ********************************
   *************** R ****************
   ******************************** */

  removeRemote(remoteName) {
    return this._run('remote', ['rm', remoteName])
  }

  removeTags(tags) {
    return this._run('tag', ['-d', tags])
  }

  /* ********************************
   *************** S ****************
   ******************************** */

  stageAll() {
    return this._run('add', ['-A'])
  }

  status() {
    return this._run('status', [])
  }

  setUpstreamAndPush(upstreamBranch) {
    return this._run('push -u', [this.remote, upstreamBranch || 'main'])
  }

  setLocalUsername(name) {
    return this._run('config', ['--local', 'user.name', name])
  }

  setGlobalUsername(name) {
    return this._run('config', ['--global', 'user.name', name])
  }

  setLocalUserEmail(email) {
    return this._run('config', ['--local', 'user.email', email])
  }

  setGlobalUserEmail(email) {
    return this._run('config', ['--global', 'user.email', email])
  }

  revListTag(tag) {
    return this._run('rev-list', ['--reverse', tag, '| git cherry-pick -n --stdin'])
  }

  async _run(operation, opts) {
    const r = await pExec(`git ${operation} ${opts.join(' ')}`, { cwd: this.cwd })
    if (r.status === 'error') {
      throw new GitError(this.cwd, r.msg, false, operation, opts)
    }
    return r
  }
}

module.exports = { GitManager }
