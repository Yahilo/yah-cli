/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @typedef {object} offerAndCreateBlockFnReturn
 * @property {String} oldPath Path received
 * @property {boolean} registered True if new block created from existing one
 * @property {boolean} copied True if all old block files are copied
 * @property {string} directory new directory path
 * @property {boolean} sourcemismatch
 * @property {string} name Old name
 * @property {string} newName New name
 * @property {{detailsInRegistry:import('./jsDoc/types').dependecyMetaShape,localBlockConfig:import('./jsDoc/types').dependecyMetaShape}} data
 */

/**
 * @typedef {object} report
 * @property {String} oldPath Path received
 * @property {boolean} registered True if new block created from existing one
 * @property {boolean} copied True if all old block files are copied
 * @property {string} directory new directory path
 * @property {boolean} sourcemismatch
 * @property {string} name Old name
 * @property {string} newName New name
 * @property {{detailsInRegistry:import('./jsDoc/types').dependecyMetaShape,localBlockConfig:import('./jsDoc/types').dependecyMetaShape}} data
 */
/**
 * @typedef {Object} appConfigInitOptions
 * @property {Boolean} reConfig Regenerate config ( default: returns the config in memory)
 * @property {Boolean} isGlobal Is the command invoked with global flag
 */
/**
 * @typedef {Object} blockMetaData
 * @property {String} CreatedAt
 * @property {String} UpdatedAt
 * @property {String| null} DeletedAt
 * @property {String} ID
 * @property {Number} BlockType
 * @property {String} BlockName
 * @property {String} BlockShortName
 * @property {String} BlockDesc
 * @property {Boolean} IsPublic
 * @property {String} GitUrl
 * @property {Number} Lang
 * @property {Number} Status
 * @property {Boolena} Verified
 */

/**
 * @typedef blockSource
 * @type {Object}
 * @property {String} ssh SSH url to repo
 * @property {String} https HTTPS url to repo
 */

/**
 * @typedef {Object} dependecyMetaShape
 * @property {String} name Name of block
 * @property {String} type Type of block in String
 * @property {String} build Build command
 * @property {String} start Start command
 * @property {String} language Language
 * @property {String} postPull Post pull command
 * @property {blockSource} source Source of block
 * @property {Array<string>} supportedAppblockVersions
 * @property {String} blockId
 */

/**
 * @typedef {Object.<string,dependencyShape>} dependencies
 */

/**
 * @typedef {Object} block_author
 * @property {String} user_name
 * @property {Number} author_type
 */

/**
 * @typedef {Object} dependencyShape
 * @property {String} directory Local block directory path
 * @property {dependecyMetaShape} meta Meata details of block
 */

/**
 * @typedef {Object} blockLiveDetails
 * @property {Boolean} isOn Status of block ( true if started )
 * @property {Number} port Port number for ui blocks, emulator port for Fns
 * @property {Number|null} pid Process number if block is live
 * @property {{out:string,err:string}} log Log paths for err & out
 */

/**
 * @typedef {dependencyShape & blockLiveDetails} blockDetailsWithLive
 */

/**
 * @typedef {Object} appblockConfigShape
 * @property {String} name Name of appblock
 * @property {String} type Type of block, should be 'package'
 * @property {String} blockPrefix Prefix for block repos
 * @property {blockSource} source
 * @property {dependencies} dependencies
 */

/**
 * @typedef {Object} roleDetails
 * @property {String} r.name Rome name
 * @property {String} description Role description
 * @property {String} id Id
 * @property {Boolean} is_owner Is owner?
 */
/**
 * @typedef {object} spaceDetails
 * @property {Boolean} is_default The default space created on user creation (cannot be deleted by user)
 * @property {String} space_id Id
 * @property {String} space_name Name
 * @property {String} logo_url Url
 * @property {('P' | 'B')} type P-personal & B-Bussiness
 * @property  {Array<roleDetails>} roles
 */

/**
 * @typedef {array<string>} cmdStartArgs
 *
 */

/**
 * @typedef {object} cmdStartOptions
 * @property {boolean} usePnpm sdasda
 */

module.exports = {}

/**
 * @type {import('../../types/configs').PackageConfig}
 */
