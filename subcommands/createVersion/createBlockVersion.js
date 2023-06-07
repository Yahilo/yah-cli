/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const path = require('path')
const semver = require('semver')
const { writeFileSync } = require('fs')

const { spinnies } = require('../../loader')
const { appBlockAddVersion } = require('../../utils/api')
const { ensureReadMeIsPresent } = require('../../utils/fileAndFolderHelpers')
const { getShieldHeader } = require('../../utils/getHeaders')
const { getLatestVersion, isCleanBlock } = require('../../utils/gitCheckUtils')
const { GitManager } = require('../../utils/gitManagerV2')
const { readInput } = require('../../utils/questionPrompts')
const { checkLangDepSupport, uploadBlockReadme } = require('./utils')
const { post } = require('../../utils/axios')

const createBlockVersion = async ({ blockManager, cmdOptions }) => {
  const blockConfig = blockManager.config

  const { repoType, name: blockName, supportedAppblockVersions, blockId, orphanBranchFolder } = blockConfig
  const { force } = cmdOptions || {}

  const latestVersion = getLatestVersion(blockConfig.directory)
  if (latestVersion) console.log(`Last published version is ${latestVersion}`)

  isCleanBlock(blockManager.directory, blockName)

  // ------------------------------------------ //
  const [readmePath] = ensureReadMeIsPresent(blockManager.directory, blockName, false)
  if (!readmePath) throw new Error('Make sure to add a README.md ')

  if (!blockId) {
    throw new Error('No blockId found in config! Make sure block is synced')
  }

  // check for abVersion langVersion Dependencies support for block
  let appblockVersionIds

  if (!supportedAppblockVersions) {
    throw new Error(`Please set appblock version and try again`)
  }

  // ========= check language & dependencies support ========================
  await checkLangDepSupport({ force, blockManager, appblockVersionIds, supportedAppblockVersions })

  const version =
    cmdOptions.version ||
    (await readInput({
      name: 'version',
      message: 'Enter the version',
      validate: (ans) => {
        if (!semver.valid(ans)) return 'Invalid versioning'
        if (latestVersion && semver.lt(semver.clean(ans), semver.clean(latestVersion))) {
          return `Last published version is ${latestVersion}`
        }
        return true
      },
      default: latestVersion ? semver.inc(latestVersion, 'patch') : '0.0.1',
    }))

  const versionNote =
    cmdOptions.versionNote ||
    (await readInput({
      name: 'versionNote',
      message: 'Enter the version note (defaults to empty)',
    }))

  const blockConfigData = { ...blockConfig }
  delete blockConfigData.orphanBranchFolder
  delete blockConfigData.workSpaceFolder

  // Update source code to appblock cloud
  spinnies.add('cv', { text: `Registering new version ${version}` })

  const reqBody = {
    block_id: blockId,
    version_no: semver.parse(version).version,
    status: 1,
    release_notes: versionNote,
    app_config: blockConfigData,
    parent_block_ids: blockConfigData.parentBlockIDs || [],
  }

  if (supportedAppblockVersions && appblockVersionIds?.length < 1) {
    reqBody.appblock_versions = supportedAppblockVersions
    delete reqBody.appblock_version_ids
  }

  const resp = await post(appBlockAddVersion, reqBody, { headers: getShieldHeader() })

  const { data } = resp
  if (data.err) {
    throw new Error('Something went wrong from our side\n', data.msg).message
  }
  const versionId = data?.data?.id

  // upload and update readme
  await uploadBlockReadme({ readmePath, blockId, versionId })

  if (repoType === 'mono') {
    // handle mono repo git flow
    const parentBranch = blockConfig.source.branch
    const releaseBranch = `block_${blockName}@${version}`

    const Git = new GitManager(orphanBranchFolder, blockConfig.source.ssh)
    Git.createReleaseBranch(releaseBranch, parentBranch)

    blockConfigData.version = version
    blockConfigData.versionId = versionId
    writeFileSync(path.join(orphanBranchFolder, blockManager.configName), JSON.stringify(blockConfigData, null, 2))

    Git.stageAll()
    Git.commit(`release branch for version ${version}`)
    Git.push(releaseBranch)
    Git.checkoutBranch(parentBranch)
  } else if (repoType === 'multi') {
    // handle multi repo git flow
    // TODO check and setup the correct workflow
    const Git = new GitManager(blockManager.directory, blockConfig.source.ssh)
    await Git.addTag(version, versionNote)
    await Git.pushTags()
  }

  spinnies.succeed('cv', { text: `new version created successfully` })

  return { blockId, versionId }
}

module.exports = createBlockVersion
