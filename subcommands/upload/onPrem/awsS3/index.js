/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
const path = require('path')
const { spinnies } = require('../../../../loader')
const { s3Handler } = require('../../../../utils/aws/s3')
const { getBBConfig } = require('../../../../utils/config-manager')

const { singleBuildDeployment } = require('./singleBuild')

const onPremS3Upload = async (options) => {
  const { config, deployConfigManager, envData } = options
  const deployedData = config.deployed || {}
  deployedData.name = config.name
  const { environment_name: envName } = envData

  try {
    const { dependencies } = await getBBConfig()

    if (!config.blocks) {
      config.blocks = Object.values(dependencies)
        .filter((b) => ['ui-container', 'ui-elements', 'ui-dep-lib'].includes(b.meta.type))
        .map((b) => b.meta.name)
    }

    const uploadBlocks = Object.values(dependencies).reduce((acc, dep) => {
      const { type: blockType, name: blockName } = dep.meta
      if (!config.blocks?.includes(blockName)) return acc
      acc.push({ blockName, blockType, blockFolder: dep.directory })

      return acc
    }, [])

    const bucket = config.domain
    if (!deployedData.bucket) {
      spinnies.add('bk', { text: `Creating bucket to upload` })
      const { bucket: bucketName } = await s3Handler.createBucket({ bucket })
      deployedData.bucket = bucketName
    }
    spinnies.remove('bk')

    const uploadKeys = {}
    const opdBackupFolder = deployConfigManager.getOnPremDeployContentBackupFolder({
      suffix: `/frontend/build/${config.name}`,
    })

    if (config.singleBuildDeployment) {
      const backendUrl = envData.on_premise?.backend?.aws_fargate?.[0]?.load_balancer_dns
      await singleBuildDeployment({ deployConfigManager, config, opdBackupFolder, env: envName, backendUrl })
      return
    }

    await Promise.all(
      uploadBlocks.map(async ({ blockName, blockType, blockFolder }) => {
        spinnies.add(`${blockName}`, { text: `Uploading ${blockName}` })
        try {
          const prefix = blockType === 'ui-elements' ? blockName : null
          const uploadedBlocks = await s3Handler.uploadDir({
            bucket,
            dirPath: path.join(blockFolder, 'dist'),
            prefix,
            backupPath: prefix ? path.join(opdBackupFolder, prefix) : opdBackupFolder,
          })
          uploadKeys[blockName] = uploadedBlocks
          spinnies.succeed(`${blockName}`, { text: `Uploaded ${blockName}` })
          return true
        } catch (error) {
          spinnies.fail(`${blockName}`, { text: `Error uploading ${blockName}: ${error.message}` })
          return false
        }
      })
    )

    deployedData.uploadKeys = uploadKeys
    deployedData.newUploads = true

    spinnies.add(`ups3`, { text: `Saving ${config.name} details` })
    await deployConfigManager.writeOnPremDeployedConfig({ config: deployedData, name: config.name })

    spinnies.succeed(`ups3`, { text: `Uploaded ${config.name} successfully` })
  } catch (error) {
    deployedData.newUploads = false
    await deployConfigManager.writeOnPremDeployedConfig({ config: deployedData, name: config.name })
    spinnies.add(`ups3`)
    spinnies.fail(`ups3`, { text: `Error: ${error.message || error}` })
    spinnies.stopAll()

    console.log(error)
  }
}

module.exports = onPremS3Upload
