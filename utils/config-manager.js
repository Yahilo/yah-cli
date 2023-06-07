/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fsPromise = require('fs/promises')
const fs = require('fs')
const path = require('path')
const { BB_CONFIG_NAME } = require('./constants')

async function getBBConfig(rootDir) {
  const root = rootDir || '.'
  const appBlockData = JSON.parse(await fsPromise.readFile(path.join(root, BB_CONFIG_NAME), 'utf8'))
  return appBlockData
}

async function addBlock(name, blockData) {
  const root = '.'
  const appConfig = await getBBConfig()
  if (!appConfig.dependencies) {
    appConfig.dependencies = {}
  }
  appConfig.dependencies = {
    ...appConfig.dependencies,
    [name]: blockData,
  }
  fs.writeFileSync(path.join(root, BB_CONFIG_NAME), JSON.stringify(appConfig), {
    encoding: 'utf8',
  })
}

async function upsertBBConfig(name, blockData) {
  const root = '.'
  const appConfig = await getBBConfig()
  appConfig[name] = blockData
  fs.writeFileSync(path.join(root, BB_CONFIG_NAME), JSON.stringify(appConfig), {
    encoding: 'utf8',
  })
}

module.exports = { getBBConfig, addBlock, upsertBBConfig }
