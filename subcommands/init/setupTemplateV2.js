const { cp, readFile, writeFile } = require('fs/promises')
const path = require('path')

async function setupTemplateV2(options) {
  const { DIRPATH } = options

  const configPath = path.join(DIRPATH, 'block.config.json')
  const config = await readFile(configPath, { encoding: 'utf8' })

  const templatesPath = path.join(__dirname, '..', '..', 'templates', 'sample-todo-template')
  const templateCOnfigPath = path.join(templatesPath, '..', 'sample.block.config.json')
  const templateConfig = await readFile(templateCOnfigPath, { encoding: 'utf8' })

  const a = JSON.parse(config)
  const b = { ...JSON.parse(templateConfig), ...a }

  cp(templatesPath, DIRPATH, { recursive: true })
  await writeFile(path.join(DIRPATH, 'block.config.json'), JSON.stringify(b, null, 2))
}

module.exports = setupTemplateV2
