import generatePackageJson from 'rollup-plugin-generate-package-json'

import { getPkgJSON, resolvePkgPath, getBaseRollupPlugins } from './utils'

const { name, module } = getPkgJSON('react')

const pkgPath = resolvePkgPath(name)
const distPath = resolvePkgPath(name, true)

export default [
	{
		input: `${pkgPath}/${module}`,
		output: {
			file: `${distPath}/index.js`,
			name: 'React',
			format: 'umd'
		},
		plugins: [
			...getBaseRollupPlugins(),
			generatePackageJson({
				inputFolder: pkgPath,
				outputFolder: distPath,
				baseContents: ({ name, version, description }) => ({
					name,
					version,
					description,
					main: 'index.js'
				})
			})
		]
	},
	{
		input: `${pkgPath}/src/jsx.ts`,
		output: [
			{
				file: `${distPath}/jsx-runtime.js`,
				name: 'jsx-runtime',
				format: 'umd'
			},
			{
				file: `${distPath}/jsx-dev-runtime.js`,
				name: 'jsx-dev-runtime',
				format: 'umd'
			}
		],
		plugins: [...getBaseRollupPlugins()]
	}
]
