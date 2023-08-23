import generatePackageJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'

import { getPkgJSON, resolvePkgPath, getBaseRollupPlugins } from './utils'

const { name, module, peerDependencies } = getPkgJSON('react-dom')

const pkgPath = resolvePkgPath(name)
const distPath = resolvePkgPath(name, true)

export default [
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${distPath}/client.js`,
				name: 'client',
				format: 'umd'
			},
			{
				file: `${distPath}/index.js`,
				name: 'ReactDOM',
				format: 'umd'
			}
		],
		external: [...Object.keys(peerDependencies)],
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
