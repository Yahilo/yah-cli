/* eslint-disable prefer-const */
/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
const { existsSync, mkdirSync, rmdirSync, readdirSync, statSync, copyFileSync, unlinkSync, rmSync } = require('fs')
const path = require('path')

const { GitManager } = require('../../../utils/gitManagerV2')
const { checkAndSetGitConfigNameEmail } = require('../../../utils/gitCheckUtils')
const { getGitConfigNameEmailFromConfigStore } = require('../../../utils/questionPrompts')
const { headLessConfigStore } = require('../../../configstore')

const buildCommitMessage = (commitHash, commitMessage) => `[commitHash:${commitHash}] ${commitMessage}`

// const copyDirectory = (sourceDir, destinationDir, excludedDirs) => {
//   const copyCommandWithExclusions = `rsync -av --exclude={${excludedDirs.join(',')}} ${sourceDir}/ ${destinationDir}/`

//   console.log('copy command with exclusions is', copyCommandWithExclusions)
//   // execSync(copyCommandWithExclusions)
// }

const getLatestCommits = async (branchName, n, Git) => {
  let latestWorkSpaceCommit = await Git.getCommits(branchName, n)

  let commits = latestWorkSpaceCommit?.out?.trim()?.split('\n') ?? []

  return commits
}

const retrieveCommitHash = (commitMessage) => {
  const pattern = /\[commitHash:(\w+)\]/
  const matches = commitMessage.match(pattern)
  if (matches && matches.length > 1) {
    return matches[1]
  }
  return ''
}

const generateOrphanBranch = async (options) => {
  const { bbModulesPath, block, repoUrl, blockMetaDataMap } = options
  let blockConfig = block.blockManager.config

  let orphanBranchName = blockConfig.source.branch

  const orphanRemoteName = 'origin'
  const orphanBranchPath = path.resolve(bbModulesPath, orphanBranchName)
  const orphanBranchFolderExists = existsSync(orphanBranchPath)
  let exclusions = ['.git', '._ab_em', '._ab_em_elements', 'cliruntimelogs', 'logs', 'headless-config.json']
  const orphanCommitMessage = ''

  if (blockConfig.type === 'package') {
    const memberBlocks = block?.memberBlocks ?? {}
    Object.keys(memberBlocks)?.forEach((item) => {
      const memberBlockDirectory = blockMetaDataMap[item].blockManager.directory
      const directoryPathArray = memberBlockDirectory.split('/')
      const directoryRelativePath = directoryPathArray[directoryPathArray.length - 1]

      exclusions.push(directoryRelativePath)
    })
  }

  if (!(block?.workSpaceCommitID?.length > 0)) {
    console.log(`Error syncing ${blockConfig.name}`)
    return
  }

  const Git = new GitManager(orphanBranchPath, repoUrl)

  if (!orphanBranchFolderExists) {
    try {
      mkdirSync(orphanBranchPath)

      await Git.init()

      await Git.addRemote(orphanRemoteName, Git.remote)

      const { gitUserName, gitUserEmail } = await getGitConfigNameEmailFromConfigStore(true, headLessConfigStore)

      await checkAndSetGitConfigNameEmail(orphanBranchPath, { gitUserEmail, gitUserName })

      await Git.fetch()
    } catch (err) {
      rmdirSync(orphanBranchPath, { recursive: true, force: true })
      throw err
    }
  }

  const remoteBranchData = await Git.checkRemoteBranch(orphanBranchName)

  const remoteBranchExists = (remoteBranchData?.out ?? '').includes(orphanBranchName)

  if (!remoteBranchExists) {
    await Git.newOrphanBranch(orphanBranchName)

    copyDirectory(block.blockManager.directory, orphanBranchPath, exclusions)

    await Git.stageAll()

    await Git.commit(buildCommitMessage(block.workSpaceCommitID, orphanCommitMessage))

    await Git.setUpstreamAndPush(orphanBranchName)
  } else {
    await Git.fetch()

    await Git.checkoutBranch(orphanBranchName)

    await Git.pull()

    // compare code from the existing workspace folder and the orphan branch folder

    let orphanBranchCommits = await getLatestCommits(orphanBranchName, 1, Git)

    const orphanBranchCommitMessage = orphanBranchCommits[0].split(' ')[1]

    const orphanBranchCommitHash = retrieveCommitHash(orphanBranchCommitMessage)
    if (orphanBranchCommitHash !== block.workSpaceCommitID) {
      clearDirectory(orphanBranchPath, exclusions)

      copyDirectory(block.blockManager.directory, orphanBranchPath, exclusions)

      await Git.stageAll()
      try {
        await Git.commit(buildCommitMessage(block.workSpaceCommitID, orphanCommitMessage))
      }catch (err) {
        console.log("Warning: Commit error in ",blockConfig?.name)
      }
      await Git.push(orphanBranchName)
    }
  }
}

function copyDirectory(sourceDir, destinationDir, exclusions) {
  const stack = [
    {
      source: sourceDir,
      destination: destinationDir,
    },
  ]

  while (stack.length > 0) {
    const { source, destination } = stack.pop()

    if (!existsSync(destination)) {
      mkdirSync(destination, { recursive: true })
    }

    const files = readdirSync(source)

    files.forEach((file) => {
      const sourcePath = path.join(source, file)
      const destinationPath = path.join(destination, file)

      const fileStats = statSync(sourcePath)

      if (!isExcluded(file, fileStats, exclusions)) {
        if (fileStats.isFile()) {
          copyFileSync(sourcePath, destinationPath)
        } else {
          stack.push({
            source: sourcePath,
            destination: destinationPath,
          })
        }
      }
    })
  }
}

function clearDirectory(directoryPath, exclusions) {
  const stack = [directoryPath]
  let isFirstDirectory = true

  while (stack.length > 0) {
    const currentPath = stack.pop()

    if (!existsSync(currentPath)) {
      continue
    }

    const files = readdirSync(currentPath)

    for (const file of files) {
      const filePath = path.join(currentPath, file)
      const fileStats = statSync(filePath)

      if (!isExcluded(file, fileStats, exclusions)) {
        if (fileStats.isFile()) {
          unlinkSync(filePath)
        } else {
          stack.push(filePath)
        }
      }
    }
    if (!isFirstDirectory) {
      rmSync(currentPath)
    }
  }
}

function isExcluded(name, stats, exclusions) {
  return exclusions.some((exclusion) => {
    if (stats.isDirectory()) {
      return name.startsWith(exclusion)
    }
    return name === exclusion
  })
}

module.exports = {
  generateOrphanBranch,
  getLatestCommits,
}
