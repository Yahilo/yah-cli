/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable camelcase */
// const { transports } = require('winston')
const { default: axios } = require('axios')
const { readInput } = require('../utils/questionPrompts')
const { appRegistryCreateApp } = require('../utils/api')
const { getShieldHeader } = require('../utils/getHeaders')

const deployConfig = require('./deploy/manager')
const { spinnies } = require('../loader')
const { appConfig } = require('../utils/appconfigStore')

// logger.add(new transports.File({ filename: 'create.log' }))

const createApp = async () => {
  await appConfig.init()
  deployConfig.init()
  const depAppConfig = await deployConfig.deployAppConfig

  if (depAppConfig?.app_id) {
    console.log(`${depAppConfig.app_name} app already exist`)
    process.exit(1)
  }

  // logger.info('------------------------------------------------------------')
  try {
    // const deploymentMode = await readInput({
    //   type: 'list',
    //   name: 'deploymentMode',
    //   message: 'Select the app deployment mode',
    //   choices: ['SaaS', 'Business (ERP)'].map((v, i) => ({
    //     name: v,
    //     value: i,
    //   })),
    // })
    const deploymentMode = 0

    const appName = await readInput({
      name: 'appName',
      message: 'Enter the app name',
      validate: (input) => {
        if (!input || input?.length < 3) return `Please enter the app name with atleast 3 characters`
        return true
      },
    })

    let envName = 'production'
    const subDomain = ''

    if (deploymentMode === 0) {
      envName = await readInput({
        name: 'envName',
        message: 'Enter the app environment name',
        validate: (input) => {
          if (!input || input?.length < 3) return `Please enter the environment name with atleast 3 characters`
          return true
        },
        default: 'Production',
      })
      // NOTE: asking domain name should be enabled once appblocks prem is live
      //   subDomain = await readInput({
      //     name: 'subDomain',
      //     message: 'Enter the sub domain name',
      //     validate: async (ans) => {
      //       try {
      //         // if (/[a-z\-]+/g.test(ans)) {
      //         //   return `Should only contain aplha numeric characters, hyphen`
      //         // }
      //         const subDomainCheck = await axios.post(
      //           appRegistryCheckDomainName,
      //           { sub_domain: ans },
      //           {
      //             headers: getShieldHeader(),
      //           }
      //         )
      //         if (subDomainCheck.data?.data?.exists) return `${ans} already taken`
      //         return true
      //       } catch (error) {
      //         console.log(`Error checking domain name exist`, error)
      //         return `Error checking domain name exist`
      //       }
      //     },
      //     default: `${envName}-${appName}`.toLocaleLowerCase(),
      //   })
    }

    // TODO: Check name availability

    spinnies.add('ca', { text: `Creating ${appName} app` })

    const packageBlockId = await appConfig.packageBlockId

    const createData = {
      app_block_id: packageBlockId,
      app_name: appName,
      environment_name: envName,
      deployment_mode: deploymentMode,
      sub_domain: subDomain,
    }

    const registerAppRes = await axios.post(appRegistryCreateApp, createData, {
      headers: getShieldHeader(),
    })

    const { data } = registerAppRes.data

    const { app_id, app_name, environment_name, ...envDomainData } = data

    const appData = {
      app_id,
      app_name,
      deployment_mode: deploymentMode,
      environments: {
        [environment_name]: {
          environment_id: envDomainData.environment_id,
        },
      },
    }

    if (deploymentMode === 0) {
      if (!envDomainData.backend_url) delete envDomainData.backend_url
      if (!envDomainData.frontend_url) delete envDomainData.frontend_url
      appData.environments[environment_name] = envDomainData
    }

    deployConfig.createDeployConfig = appData

    spinnies.succeed('ca', { text: 'App created successfully' })
  } catch (err) {
    spinnies.fail('ca', { text: err.message })
    // console.log(err)
  }
}

module.exports = createApp
