/**
 * Action for bb-start
 */

const { AsyncSeriesHook, AsyncSeriesBailHook, AsyncSeriesWaterfallHook } = require('tapable')
const { findMyParentPackage } = require('../../utils')
// eslint-disable-next-line no-unused-vars
const { AppblockConfigManager } = require('../../utils/appconfig-manager')
const { appConfig } = require('../../utils/appconfigStore')
const { checkPnpm } = require('../../utils/pnpmUtils')

/**
 * What does start do?
 * Load the environment. this includes loading appconfig manager
 * Decide single or multiple or all blocks to start
 * Group the type of blocks to start
 *
 */
class StartCore {
  /**
   * Create a start factory
   * @param {import('../../utils/jsDoc/types').cmdStartArgs} blockName
   * @param {import('../../utils/jsDoc/types').cmdStartOptions} options
   */
  constructor(blockName, options) {
    this.cmdArgs = { blockName }
    this.cmdOpts = { ...options }
    this.hooks = {
      beforeEnv: new AsyncSeriesBailHook(),
      /**
       * @type {AsyncSeriesBailHook}
       */
      afterEnv: new AsyncSeriesBailHook(['core', 'config']),
      /**
       * @type {AsyncSeriesHook}
       */
      beforeAppConfigInit: new AsyncSeriesHook(),
      /**
       * @type {AsyncSeriesBailHook}
       */
      afterAppConfigInit: new AsyncSeriesBailHook(),
      /**
       * this.blocksToStart gets filled before grouping
       * @type {AsyncSeriesWaterfallHook}
       */
      beforeGroupingBlocks: new AsyncSeriesWaterfallHook(['core', 'config']),
      /**
       * @type {AsyncSeriesWaterfallHook}
       */
      afterGroupingBlocks: new AsyncSeriesWaterfallHook(['core', 'config']),
      /**
       * Find free ports for each block in group here,
       * preferably consecutive numbers for blocks in one group
       */
      buildEmulator: '',
      buildFnEmulator: new AsyncSeriesHook(['core', 'config']),
      buildJobEmulator: new AsyncSeriesHook(['core', 'config']),
      buildSharedFnEmulator: new AsyncSeriesHook(['core', 'config']),

      singleBuildForView: new AsyncSeriesHook(['core', 'config']),
      /**
       * Building emulator is totally in hands of user of this class
       */
    }

    /**
     * @type {Array<string>}
     */
    this.blocksToStart = []

    /**
     * @type {Iterable<{type:string,blocks:Array}>}>}
     */
    this.blockGroups = {}
  }

  /**
   *
   * @returns
   */
  async setEnvironment() {
    global.rootDir = process.cwd()
    global.usePnpm = checkPnpm()
    await appConfig.initV2()
    if (!appConfig.isInAppblockContext && appConfig.isInBlockContext) {
      /**
       * If blockName is given, but is not same as the block directory user is in, return error
       * eg: bb start ui , called from pck/addTodo
       */
      if (this.cmdArgs.blockName && this.cmdArgs.blockName !== appConfig.getName()) {
        return {
          data: '',
          err: `cannot start ${this.cmdArgs.blockName} from ${appConfig.getName()}`,
        }
      }
      /**
       * Find the package block user is in, and init that as appConfig
       * eg: bb start addTodo, called from pck/a/b/c/addTodo. find path to pck & init from that dir
       */
      const {
        data: { parent },
        err,
      } = await findMyParentPackage(this.cmdArgs.blockName || appConfig.getName(), process.cwd(), appConfig.configName)
      if (err) return { data: '', err }
      this.cmdArgs.blockName = appConfig.getName()
      global.rootDir = parent
      await appConfig.initV2(parent, null, 'start', { reConfig: true })
    }
    const f = await this.hooks.afterEnv?.promise(this, appConfig)
    if (f) return { data: '', err: f }
    return { data: '', err: false }
  }

  /**
   * Block to start will be grouped here
   * When grouping, If there are package blocks, each type in package block
   * should be inside type itself
   * i.e if inside pck1, there are pck12 & pck13
   * the group should look like
   * {...
   *  function:[
   *    {addTodo...},{pck12/addTodo},{pck13/addTodo}
   *  ]
   * }
   * By doing it like this, later in bb start, fn emulator can set this as path
   * iF blocks inside are for auth, it'll look like 5000/auth/fn
   */
  async groupBlocks() {
    this.blocksToStart = this.cmdArgs.blockName ? [this.cmdArgs.blockName] : [...appConfig.allBlockNames]

    /**
     * TODO: create this with blockTypes from blockTypes.js as the source truth
     */
    this.blockGroups = {
      'ui-container': [
        ...appConfig.getDependencies(
          true,
          (block) => ['ui-container'].includes(block.meta.type) && this.blocksToStart.includes(block.meta.name)
        ),
      ],
      'ui-elements': [
        ...appConfig.getDependencies(
          true,
          (block) => ['ui-elements'].includes(block.meta.type) && this.blocksToStart.includes(block.meta.name)
        ),
      ],
      'ui-dep-lib': [
        ...appConfig.getDependencies(
          true,
          (block) => ['ui-dep-lib'].includes(block.meta.type) && this.blocksToStart.includes(block.meta.name)
        ),
      ],
      function: [
        ...appConfig.getDependencies(
          true,
          (block) => ['function'].includes(block.meta.type) && this.blocksToStart.includes(block.meta.name)
        ),
      ],
      'shared-fn': [
        ...appConfig.getDependencies(
          true,
          (block) => ['shared-fn'].includes(block.meta.type) && this.blocksToStart.includes(block.meta.name)
        ),
      ],
      job: [...appConfig.jobBlocks],
      data: [],
      *[Symbol.iterator]() {
        for (const type in this) {
          if (Object.hasOwnProperty.call(this, type)) {
            yield { type, blocks: this[type] }
          }
        }
      },
    }

    const _g = await this.hooks.afterGroupingBlocks.promise(this, appConfig)
    // console.log(g)
  }

  async buildEmulators() {
    await this.hooks.buildFnEmulator?.promise(this, appConfig)
    await this.hooks.buildJobEmulator?.promise(this, appConfig)
    await this.hooks.buildSharedFnEmulator?.promise(this, appConfig)
  }

  async singleBuildForView() {
    await this.hooks.singleBuildForView?.promise(this, appConfig)
  }

  /**
   * Frees the used locked ports
   */
  async cleanUp() {
    for (const { blocks } of this.blockGroups) {
      blocks.forEach((v) => v.key?.abort())
    }
  
    process.exitCode = 0
  }
}

module.exports = StartCore
