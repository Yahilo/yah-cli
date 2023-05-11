/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const chalk = require('chalk')
const treeKill = require('tree-kill')
const { stopEmulator } = require('../utils/emulator-manager')
const { appConfig } = require('../utils/appconfigStore')
const { sleep } = require('../utils')
const { stopEmulatedElements } = require('./start/singleBuild/util')

global.rootDir = process.cwd()

const stop = async (name, options) => {
  const { global: isGlobal, hard, blockType } = options

  await appConfig.init(null, null, null, { isGlobal })

  if (appConfig.isInBlockContext && !appConfig.isInAppblockContext) {
    // eslint-disable-next-line no-param-reassign
    name = appConfig.allBlockNames.next().value
  }

  if (name?.length < 1) {
    if ([...appConfig.allBlockNames].length <= 0) {
      console.log('\nNo blocks to stop!\n')
      process.exit(1)
    }

    // let localRegistry
    if (isGlobal) {
      // localRegistry = appConfig.lrManager.localRegistry

      const { localRegistryData } = appConfig.lrManager
      for (const pck in localRegistryData) {
        if (Object.hasOwnProperty.call(localRegistryData, pck)) {
          // console.log(`---Stopping blocks in ${pck}---`)
          const { rootPath } = localRegistryData[pck]
          await appConfig.init(rootPath, null, null, { isGlobal: false, reConfig: true })
          stopAllBlock(rootPath, hard, blockType)
        }
      }
      return
    }
    stopAllBlock('.', hard, blockType)
  } else if (appConfig.has(name)) {
    if (appConfig.isLive(name)) {
      for (const blck of appConfig.fnBlocks) {
        if (blck.meta.name === name) {
          console.log(`${name} is a function block`)
          console.log(`All functions will be stopped`)
        }
      }
      stopBlock(name)
    } else {
      console.log(`${chalk.whiteBright(name)} is not a live block.`)
      console.log(`Use ${chalk.italic(`block start ${name}`)} to start the block`)
    }
  } else {
    // TODO -- throw a no block found error and handle it in index by displaying all availbale live blocks
    console.log(chalk.red(`No block named ${chalk.bold(name)} found!`))
    console.log(`Currently live blocks are:`)
    for (const {
      meta: { name: blockname },
    } of appConfig.liveBlocks) {
      console.log(blockname)
    }
  }
}

async function stopAllBlock(rootPath, hard, blockType) {
  if ([...appConfig.liveJobBlocks].length !== 0) {
    console.log('\nJob blocks are live! Please stop jobs and try again\n')
    process.exit(1)
  }

  if ([...appConfig.liveBlocks].length === 0) {
    console.log('\nNo blocks are live!\n')
    await sleep(2000) // to wait for any write opertaion to complete
    process.exit(1)
  }

  if (!blockType || blockType === 'ui') {
    for (const bk of appConfig.uiBlocks) {
      const bName = bk.meta.name
      const liveData = appConfig.getLiveDetailsof(bName)
      if (liveData?.isOn && !liveData.singleBuild) {
        stopBlock(bName)
      }
    }
    await stopEmulatedElements({ rootPath, hard })
  }

  if (!blockType || blockType === 'function') {
    stopEmulator(rootPath, hard)
    global.assignedPorts = []
    // If Killing emulator is successful, update all function block configs..
    for (const {
      meta: { name },
    } of appConfig.fnBlocks) {
      appConfig.stopBlock = name
    }
    // If Killing emulator is successful, update all job block configs..
    for (const {
      meta: { name },
    } of appConfig.jobBlocks) {
      appConfig.stopBlock = name
    }
  }
}

function stopBlock(name) {
  const liveDetails = appConfig.getLiveDetailsof(name)
  if (liveDetails.isJobOn) {
    console.log('\nLive Job found for this block! Please stop job and try again\n')
    process.exit(1)
  }
  treeKill(liveDetails.pid, (err) => {
    if (err) {
      console.log('Error in stopping block process with pid ', liveDetails.pid)
      console.log(err)
      return
    }
    appConfig.stopBlock = name
    console.log(`${name} stopped successfully!`)
  })
}

module.exports = stop
