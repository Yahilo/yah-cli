/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const chalk = require('chalk')
// const { execSync } = require('child_process')
const { readFileSync, writeFileSync } = require('fs')
const path = require('path')
const { configstore } = require('../configstore')
const { blockTypeInverter } = require('./blockTypeInverter')
const convertGitSshUrlToHttps = require('./convertGitUrl')
const createComponent = require('./createComponent')
const { createDirForType } = require('./fileAndFolderHelpers')
const { GitManager } = require('./gitmanager')
// const { tryGitInit } = require('./gitCheckUtils')
const { getGitConfigNameEmail } = require('./questionPrompts')
const registerBlock = require('./registerBlock')
const { BB_CONFIG_NAME } = require('./constants')

/**
 * @typedef returnObject
 * @type {Object}
 * @property {blockSource} blockSource URL to repository
 * @property {String} cloneDirName Name of the local cloned directory,(_prefix_blockname)
 * @property {String} clonePath Path to local cloned directory
 * @property {String} blockFinalName Name of the directory created in source control
 */

/**
 *
 * @param {String} blockName Name of block to be created
 * @param {String} blockShortName Name of block to be created
 * @param {Number} blockTypeNo Type number of block
 * @param {String} createFromExistinURL If a source is provided, a new repo is created from the source IMP:always should be ssh url
 * @param {Boolean} callingFromPullNoCreateNewRefactorMelater To stop halfway and return cloned directory path
 * @param {String} cwd To pass to directory creation function
 * @param {Boolean?} isAStandAloneBlock If user is trying to create a block outside appblock context
 * @param {Object?} Configuration of job
 * @returns {Promise<returnObject>}
 */
async function createBlock(
  blockName,
  blockShortName,
  blockTypeNo,
  createFromExistinURL,
  callingFromPullNoCreateNewRefactorMelater,
  cwd,
  // eslint-disable-next-line default-param-last
  isAStandAloneBlock = false,
  jobConfig,
  metaData,
  package_block_id
) {
  if (arguments.length < 6) throw new Error('NotEnoughArguments in CreateBlock')

  const clonePath = isAStandAloneBlock ? '.' : createDirForType(blockTypeNo, cwd || '.')
  // console.log('clone path return from createDirForType', clonePath)
  if (callingFromPullNoCreateNewRefactorMelater) {
    return { clonePath }
  }

  const {
    description,
    visibility,
    url,
    sshUrl,
    name: cloneDirName,
    blockFinalName,
  } = await createComponent(blockShortName, createFromExistinURL, clonePath)

  if (createFromExistinURL) {
    try {
      // git username try
      const prefersSsh = configstore.get('prefersSsh')
      const parentRepoUrl = prefersSsh ? createFromExistinURL : convertGitSshUrlToHttps(createFromExistinURL)
      const sourceUrl = prefersSsh ? sshUrl : url
      const Git = new GitManager(`${clonePath}/${cloneDirName}`, cloneDirName, sourceUrl, prefersSsh)
      try {
        // execSync(`cd ${clonePath}/${cloneDirName} && git config --global user.name`)
        await Git.getGobalUsername()
      } catch (err) {
        console.log(chalk.dim('Git username and email not set!'))

        const { gitUserName, gitUserEmail } = await getGitConfigNameEmail()
        // execSync(`cd ${clonePath}/${cloneDirName} && git config --local user.name ${gitUserName}`)
        // execSync(`cd ${clonePath}/${cloneDirName} && git config --local user.email ${gitUserEmail}`)
        await Git.setLocalUsername(gitUserName)
        await Git.setLocalUseremail(gitUserEmail)

        console.log(
          chalk.dim(`\nGit local config updated with ${chalk.bold(gitUserName)} & ${chalk.bold(gitUserEmail)}\n`)
        )
      }
      //
      // error: pathspec 'master' did not match any file(s) known to git
      // create a commit to avoid below above error
      //
      //  echo '# ${blockName} by ${configstore.get(
      // 'appBlockUserName'
      // )}' > README.md &&
      // execSync(
      //   `cd ${clonePath}/${cloneDirName} &&
      //   git checkout -b main &&
      //   git commit -m 'happy hacking from appblock team!' --allow-empty &&
      //   git push origin main
      //   `,
      //   { stdio: 'ignore' }
      // )
      await Git.newBranch('main')
      await Git.commit('happy hacking from appblock team!', '--allow-empty')
      await Git.push('main')

      // createFromExistinURL is always ssh url, if user doesnt prefer ssh, convert it to https

      // execSync(
      //   `cd ${clonePath}/${cloneDirName} &&
      // git checkout main &&
      // git remote add tempRemote ${parentRepoUrl} &&
      // git fetch tempRemote &&
      // git merge tempRemote/main --allow-unrelated-histories &&
      // git remote rm tempRemote`,
      //   { stdio: 'ignore' }
      // )

      // Create a temp remote and fetch and merge it to local main to get data from parent repo
      await Git.checkoutbranch('main')
      await Git.addRemote('tempRemote', parentRepoUrl)
      await Git.fetch('tempRemote')
      await Git.merge('tempRemote/main', '--allow-unrelated-histories')
      if (metaData?.version_number) {
        try {
          // Not compatible with windows since using $() and pipe. Need to find another solution
          // await Git.revListTag(metaData.version_number)
          await Git.checkoutTagWithNoBranch(metaData.version_number)
          await Git.removeRemote('tempRemote')
          await Git.removeTags('$(git tag -l)')
        } catch {
          await Git.removeRemote('tempRemote')
        }
      } else {
        await Git.removeRemote('tempRemote')
      }

      console.log(chalk.dim('Succesfully copied block code to local..'))

      // Try to update block config of pulled block,
      // if not present add a new one
      let blockConfig
      try {
        blockConfig = JSON.parse(readFileSync(path.resolve(clonePath, cloneDirName, BB_CONFIG_NAME)))
      } catch (err) {
        if (err.code === 'ENOENT') {
          console.log(chalk.dim('Pulled block has no config file, adding a new one'))
          blockConfig = {
            type: blockTypeInverter(blockTypeNo),
            language: 'js',
            start: 'npx webpack-dev-server',
            build: 'npx webpack',
            postPull: 'npm i',
          }
        }
      }
      blockConfig.name = blockFinalName
      blockConfig.source = { https: url, ssh: sshUrl }
      writeFileSync(path.resolve(clonePath, cloneDirName, BB_CONFIG_NAME), JSON.stringify(blockConfig))

      console.log(chalk.dim('Succesfully updated block config..'))

      // execSync(
      //   `cd ${clonePath}/${cloneDirName} &&
      //   git add -A &&
      //   git commit -m 'initial commit' &&
      //   git push origin main
      //   `
      //   // { stdio: 'ignore' }
      // )

      await Git.stageAll()
      await Git.commit('initial commit')
      await Git.push('main')

      console.log(chalk.dim('Succesfully pushed new version code to git..'))
    } catch (err) {
      console.log('Something went wrong while pulling\n')
      console.log(err)
      process.exit(1)
    }
  }

  let blockId
  try {
    const resData = await registerBlock(
      blockTypeNo,
      blockFinalName,
      blockFinalName,
      visibility === 'PUBLIC',
      sshUrl,
      description,
      jobConfig,
      package_block_id
    )

    blockId = resData.data.ID
  } catch (err) {
    console.log(err.message)
    process.exit(1)
  }

  return {
    blockSource: { https: url, ssh: sshUrl },
    cloneDirName,
    clonePath,
    blockFinalName,
    blockId,
  }
}

module.exports = createBlock
