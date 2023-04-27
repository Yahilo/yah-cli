/* eslint-disable prefer-const */
/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
const { writeFileSync, readFileSync, existsSync, rmSync } = require('fs')
const path = require('path')
const { configstore } = require('../../../../configstore')
const { spinnies } = require('../../../../loader')
const { copyEmulatorCode } = require('../../../../utils/emulator-manager')
const { pexec } = require('../../../../utils/execPromise')
const { checkPnpm } = require('../../../../utils/pnpmUtils')
const { readInput } = require('../../../../utils/questionPrompts')
const { updatePackageVersionIfNeeded } = require('../../../start/singleBuild/mergeDatas')

const generateDockerFile = ({ ports, dependencies, version, env, config }) => {
  // eslint-disable-next-line no-param-reassign
  if (!version) version = process.version.replace('v', '')

  const envPath = existsSync(`.env.function.${env}`) ? `.env.function.${env}` : `.env.function`

  const addPackageManager = `RUN npm install -g pnpm@7.9.0`
  const runPackageManager = `RUN pnpm i`
  const beforeDockerStartCommand = config.beforeDockerStartCommand?.length > 0 ? config.beforeDockerStartCommand : []

  const fileData = `
  #syntax=docker/dockerfile:1
  FROM --platform=linux/amd64 node:${version}-alpine
  
  RUN apk --no-cache add git
  
  ${addPackageManager}
  
  ENV NODE_ENV production
  
  WORKDIR .
  
  COPY ._ab_em ./._ab_em/
  COPY package.json .
  ${dependencies.map((dep) => `COPY ${dep.directory} ./${dep.directory}/`).join('\n')}
  COPY ${envPath} .env.function
  COPY block.config.json .
  
  ${runPackageManager}
  # RUN npm ci --only=production
  
  EXPOSE ${ports}
  
  RUN npm install pm2 -g
  
  ${beforeDockerStartCommand.map((c) => c).join('\n')}

  # USER node
  
  CMD ["pm2-runtime", "._ab_em/index.js", "-i max"]
  
  `
  writeFileSync('./Dockerfile', fileData)
}

const generateRootPackageJsonFile = ({ appName, dependencies }) => {
  // const npmInstallCmd = "npm ci --only=production"
  const nodePackageManager = configstore.get('nodePackageManager')

  const npmInstallCmd = nodePackageManager === 'pnpm' ? `${nodePackageManager} i` : 'npm i'
  const postinstall = dependencies.map(({ directory }) => `(cd ${directory} && ${npmInstallCmd})`).join(';')

  const fileData = `
  {
      "name": "${appName}",
      "version": "1.0.0",
      "scripts": {
        "postinstall": "(cd ._ab_em && ${npmInstallCmd});${postinstall}"
      }
  }
      `
  writeFileSync('./package.json', fileData)
}

const getAWSECRConfig = async (options) => {
  const { appName, envName } = options
  const container = await readInput({
    name: 'container',
    message: 'Enter a name of container',
    default: `${appName}${envName}container`.toLowerCase(),
    validate: (input) => {
      if (!input || input.length < 5) return `Name should be at least 5 characters`
      if (!/[a-z0-9]/.test(input)) return `Name should contain only small letters and numbers`
      return true
    },
  })
  return { container }
}

const updateEmulatorPackageSingleBuild = async ({ dependencies, emulatorPath }) => {
  const emulatorPackageJsonPath = path.join(emulatorPath, 'package.json')
  const emulatorPackageJson = await JSON.parse(readFileSync(path.resolve(emulatorPackageJsonPath)).toString())
  // await symlink(src, dest)
  const mergedPackages = {
    dependencies: { em: emulatorPackageJson.dependencies || {} },
    devDependencies: { em: emulatorPackageJson.devDependencies || {} },
  }

  await Promise.all(
    Object.values(dependencies).map(async (bk) => {
      const {
        meta: { name },
        directory: dir,
      } = bk
      const directory = path.resolve(dir)

      try {
        const packages = await JSON.parse(readFileSync(path.join(directory, 'package.json')).toString())
        mergedPackages.dependencies = { ...mergedPackages.dependencies, [name]: packages.dependencies }
        mergedPackages.devDependencies = { ...mergedPackages.devDependencies, [name]: packages.devDependencies }
      } catch (error) {
        console.log(`Error reading package.json for block ${name} : ${error.message}`)
      }
    })
  )

  emulatorPackageJson.dependencies = updatePackageVersionIfNeeded(mergedPackages.dependencies)
  emulatorPackageJson.devDependencies = updatePackageVersionIfNeeded(mergedPackages.devDependencies)

  writeFileSync(emulatorPackageJsonPath, JSON.stringify(emulatorPackageJson, null, 2))

  const modulesPath = path.join(emulatorPath, 'node_modules')
  if (existsSync(modulesPath)) rmSync(modulesPath, { recursive: true })

  let installer = 'npm i'
  const nodePackageManager = configstore.get('nodePackageManager')
  global.usePnpm = nodePackageManager === 'pnpm' || checkPnpm()
  if (global.usePnpm) installer = 'pnpm i'
  spinnies.add('singleBuild', { text: `Installing dependencies for emulator (${installer})` })
  const i = await pexec(`cd ${emulatorPath} && ${installer}`)
  if (i.err) throw new Error(i.err)
  spinnies.remove('singleBuild')
}

const generateDockerFileSingleBuild = ({ ports, dependencies, version, env, config }) => {
  // eslint-disable-next-line no-param-reassign
  if (!version) version = process.version.replace('v', '')

  const envPath = existsSync(`.env.function.${env}`) ? `.env.function.${env}` : `.env.function`

  const addPackageManager = `RUN npm install -g pnpm@7.9.0`
  const runPackageManager = `RUN pnpm i`

  const beforeDockerStartCommand = config.beforeDockerStartCommand?.length > 0 ? config.beforeDockerStartCommand : []

  const fileData = `
#syntax=docker/dockerfile:1
FROM --platform=linux/amd64 node:${version}-alpine

RUN apk --no-cache add git

# ${addPackageManager}

ENV NODE_ENV production

WORKDIR .

COPY ._ab_em ./._ab_em/
${dependencies.map((dep) => `COPY ${dep.directory} ./${dep.directory}/`).join('\n')}
COPY ${envPath} .env.function
COPY block.config.json .

WORKDIR ./._ab_em/
# ${runPackageManager}
RUN node setSymlink.js
WORKDIR ../

EXPOSE ${ports}

RUN npm install pm2 -g

# Before docker start
${beforeDockerStartCommand.map((c) => c).join('\n')}

# USER node

CMD ["pm2-runtime", "._ab_em/index.js", "-i max"]

`
  writeFileSync('./Dockerfile', fileData)
}

const setSymlinkCode = async (dependencies, emulatorPath) => {
  const dependenciesData = Object.values(dependencies)

  const setSymlinkCodeData = `
import { symlink } from 'fs/promises'
import { rmSync } from 'fs'
import path from 'path'

const src = path.resolve('node_modules')
const dependencies = ${JSON.stringify(dependenciesData)}

await Promise.all(
  dependencies.map(async (bk) => {
    const dest = path.resolve('..', bk.directory, 'node_modules')

    try {
      rmSync(dest, { recursive: true, force: true })
    } catch (e) {
      // nothing
    }

    await symlink(src, dest)
  })
)
`
  writeFileSync(path.join(emulatorPath, 'setSymlink.js'), setSymlinkCodeData)
}

const generateDockerIgnoreFileSingleBuild = (dependencies, config) => {
  let fileData = Object.values(dependencies).map((d) => path.join(d.directory, 'node_modules'))

  if (config.dockerIgnore?.length > 0) {
    fileData = fileData.concat(config.dockerIgnore)
  }

  writeFileSync('.dockerignore', fileData.join('\n'))
}

const beSingleBuildDeployment = async ({ container_ports, dependencies, env, config }) => {
  const emulatorPath = '._ab_em'
  await copyEmulatorCode(container_ports, dependencies)
  await setSymlinkCode(dependencies, emulatorPath)
  await updateEmulatorPackageSingleBuild({ dependencies, emulatorPath })
  generateDockerIgnoreFileSingleBuild(dependencies, config)
  generateDockerFileSingleBuild({ ports: container_ports, dependencies, env, config })
}

module.exports = {
  generateDockerFile,
  generateRootPackageJsonFile,
  getAWSECRConfig,
  beSingleBuildDeployment,
  updateEmulatorPackageSingleBuild,
}
