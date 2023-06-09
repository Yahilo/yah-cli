/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable camelcase */
const { writeFileSync, existsSync, mkdirSync } = require('fs')
const path = require('path')
const axios = require('axios')
const { blocksSync } = require('./api')
const { getShieldHeader } = require('./getHeaders')
const { feedback } = require('./cli-feedback')

/**
 *
 * @param {Number} block_type 1 or 2 or 3
 * @param {String} block_name Long name of block
 * @param {String} block_short_name Preferred short name of block
 * @param {Boolean} is_public Visibility of repo
 * @param {String} github_url Github repo url
 * @param {String} block_desc Description same as github repo description
 * @param {String} job_config Configuration for job
 */
// eslint-disable-next-line consistent-return
async function syncBlocks(block_name_array, block_meta_data_map, currentSpaceID, returnOnError, syncLogs) {
  //   spinnies.add('syncBlocks', { text: `Creating Blocks ` })
  const logOutRoot = path.resolve('logs', 'out')
  const syncLogDirectory = path.join(logOutRoot, 'sync-logs')
  try {
    const postData = {
      block_meta_data_map,
      block_name_array,
    }

    const shieldHeader = getShieldHeader()

    shieldHeader.space_id = currentSpaceID

    const res = await axios.post(blocksSync, postData, {
      headers: shieldHeader,
    })

    if (res.data.err) {
      feedback({ type: 'error', message: res.data.msg })
      throw new Error('Response failed')
    }

    const resData = res.data.data

    // eslint-disable-next-line no-param-reassign
    syncLogs.apiLogs = {
      non_available_block_names: resData?.non_available_block_names_map ?? {},
      error: res?.data?.err ?? false,
      message: res?.data?.msg ?? '',
    }
    updateSyncLogs(syncLogDirectory, syncLogs, returnOnError)
  } catch (err) {
    // eslint-disable-next-line no-param-reassign
    syncLogs.apiLogs = { error: true, message: 'Sync Api Failed', non_available_block_names: {} }
    updateSyncLogs(syncLogDirectory, syncLogs, returnOnError)
    if (returnOnError) {
      throw new Error('BB Sync failed.')
    }
  }
  // spinnies.succeed('syncBlocks', { text: `Blocks Created Successfully` })
  // spinnies.remove('syncBlocks')
}

function updateSyncLogs(directoryPath, nonAvailableBlockNamesMap) {
  // Create the directory if it doesn't exist
  if (!existsSync(directoryPath)) {
    mkdirSync(directoryPath, { recursive: true })
    console.log('sync logs created:', directoryPath)
  }

  const filePath = path.join(directoryPath, 'logs')

  writeFileSync(filePath, JSON.stringify(nonAvailableBlockNamesMap, null, 2), 'utf8', { flag: 'w' })
}

module.exports = syncBlocks
