/* eslint-disable */
const { Logger } = require('../../utils/loggerV2')
const StartCore = require('./startCore')
const { spinnies } = require('../../loader')
const { feedback } = require('../../utils/cli-feedback')

const HandleNodeFunctionStart = require('./plugins/handleNodeFunctionStart')
const HandleJSViewStart = require('./plugins/handleJSViewStart')
const LockAndAssignPorts = require('./plugins/lockAndAssignPortsPlugin.js')
const HandleOutOfContext = require('./plugins/handleOutOfContext')
const HandleBeforeStart = require('./plugins/handleBeforeStart')
const HandleBlockGrouping = require('./plugins/handleBlockGrouping')
const chalk = require('chalk')

async function start(blockName, options) {
  const { logger } = new Logger('start')
  const Start = new StartCore(blockName, {
    singleInstance: !options.multiInstance,
    ...options,
    logger,
    feedback,
    spinnies,
  })

  try {
    new HandleOutOfContext().apply(Start)
    new HandleBeforeStart().apply(Start)
    new HandleBlockGrouping().apply(Start)
    new LockAndAssignPorts().apply(Start)

    new HandleNodeFunctionStart().apply(Start)
    new HandleJSViewStart().apply(Start)

    await Start.initializeConfigManager()
    await Start.start()
    await Start.cleanUp()
  } catch (error) {
    await Start.cleanUp()
    logger.error(error)
    spinnies.stopAll()
    spinnies.add('start', { text: error.message })
    spinnies.fail('start', { text: chalk.red(error.message) })
  }
}

module.exports = start
