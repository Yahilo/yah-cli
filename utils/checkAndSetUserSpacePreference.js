/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const path = require('path')
const { prompt } = require('inquirer')
const { configstore, headLessConfigStore } = require('../configstore')
const { feedback } = require('./cli-feedback')
const { lrManager } = require('./locaRegistry/manager')
const { confirmationPrompt } = require('./questionPrompts')
const { listSpaces } = require('./spacesUtils')
const ConfigFactory = require('./configManagers/configFactory')
const BlockConfigManager = require('./configManagers/blockConfigManager')

async function checkSpaceLinkedToPackageBlock(cmd) {
  if (cmd === 'pull') return true

  // check space is linked with package block
  const configPath = path.resolve('block.config.json')
  const { manager, error } = await ConfigFactory.create(configPath)
  if (error) {
    if (error.type !== 'OUT_OF_CONTEXT') throw error
    throw new Error('Please run the command inside package context ')
  }

  let packageManager = manager

  if (cmd === 'create-version' || manager instanceof BlockConfigManager) {
    const { rootManager } = await manager.findMyParents()
    packageManager = rootManager
  }

  const headlessConfig = headLessConfigStore.store
  const spaceId = headlessConfig.prismaSchemaFolderPath || configstore.get('currentSpaceId')

  if (cmd === 'create-version') {
    // check with synced workspace
    const workSpaceFolder = path.join(packageManager.directory, 'bb_modules', 'workspace')

    const { manager: mc, error: wErr } = await ConfigFactory.create(
      path.join(workSpaceFolder, packageManager.configName)
    )

    if (wErr) {
      if (wErr.type !== 'OUT_OF_CONTEXT') throw wErr
      throw new Error('Please run the command inside package context ')
    }
    
    packageManager = mc
  }

  const { name, blockId } = packageManager.config
  if (!blockId) throw new Error(`Block ID not found for root ${name}`)

  await lrManager.init()

  if (!spaceId || !lrManager.isSpaceLinkedToPackageBlock(blockId, spaceId)) {
    const { space_name, space_id } = await lrManager.linkedSpaceOfPackageBlock(name, blockId)

    if (!space_name) return false

    if (space_id === spaceId) return true

    const switchSpace = await confirmationPrompt({
      name: 'switchSpace',
      message: `${name} package block is under space ${space_name}. Do you want to set space to ${space_name}`,
      default: true,
    })

    if (!switchSpace) {
      feedback({ type: 'error', message: `Access denied for current space` })
      process.exit(0)
    }

    // TODO: Check for space existence
    configstore.set('currentSpaceName', space_name)
    configstore.set('currentSpaceId', space_id)

    feedback({ type: 'success', message: `Current Space: ${configstore.get('currentSpaceName')}` })
  }

  return true
}

async function checkAndSetUserSpacePreference(cmd) {
  const currentSpaceName = configstore.get('currentSpaceName')

  if (!currentSpaceName) {
    try {
      const isLinked = await checkSpaceLinkedToPackageBlock(cmd)
      if (isLinked) return

      const res = await listSpaces()
      if (res.data.err) {
        feedback({ type: 'error', message: res.data.msg })
        process.exit(1)
      }
      /**
       * @type {Array<import('./jsDoc/types').spaceDetails>}
       */
      const Data = res.data.data
      const question = [
        {
          type: 'list',
          message: 'Choose a space to continue',
          choices: Data.map((v) => ({ name: v.space_name, value: { id: v.space_id, name: v.space_name } })),
          name: 'spaceSelect',
        },
      ]
      const {
        spaceSelect: { name, id },
      } = await prompt(question)
      configstore.set('currentSpaceName', name)
      configstore.set('currentSpaceId', id)
    } catch (err) {
      // TODO: feedback here
      feedback({ type: 'error', message: err.message })
      process.exit(1)
    }
  } else {
    // TODO: check and validate the existence of the space,
    // If the call to list spaces fails here continue with the
    // present space name and hope it works.No need to abort then.
    // If the space is not present in the returned list, prompt for new space selection
    feedback({ type: 'success', message: `Current Space: ${currentSpaceName}` })
    await checkSpaceLinkedToPackageBlock(cmd)
  }
}
module.exports = checkAndSetUserSpacePreference
