import path from 'path'
import fs from 'fs'

import typescript from 'rollup-plugin-typescript2'
import replace from '@rollup/plugin-replace'

const pkgPath = path.resolve(__dirname, '../../packages')
const distPath = path.resolve(__dirname, '../../dist/node_modules')

export function resolvePkgPath(name, isDist) {
	if (!isDist) {
		return `${pkgPath}/${name}`
	}

	return `${distPath}/${name}`
}

export function getPkgJSON(name) {
	const path = `${resolvePkgPath(name)}/package.json`

	return JSON.parse(fs.readFileSync(path, { encoding: 'utf-8' }))
}

export function getBaseRollupPlugins({
	alias = {
		__DEV__: true
	},
	tsPluginOption = {}
} = {}) {
	return [replace(alias), typescript(tsPluginOption)]
}
