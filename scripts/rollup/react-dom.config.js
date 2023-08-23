import generatePackageJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'

import { getPkgJSON, resolvePkgPath, getBaseRollupPlugins } from './utils'

const { name, module } = getPkgJSON('react-dom')

const pkgPath = resolvePkgPath(name)
const distPath = resolvePkgPath(name, true)

export default [
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${distPath}/client.js`,
				name: 'client.js',
				format: 'umd'
			},
			{
				file: `${distPath}/index.js`,
				name: 'index.js',
				format: 'umd'
			}
		],
		plugins: [
			...getBaseRollupPlugins(),
			alias({
				entries: {
					hostConfig: `${pkgPath}/src/hostConfig.ts`
				}
			}),
			generatePackageJson({
				inputFolder: pkgPath,
				outputFolder: distPath,
				baseContents: ({ name, version, description }) => ({
					name,
					version,
					description,
					peerDependencies: {
						react: version
					},
					main: 'index.js'
				})
			})
		]
	}
]
