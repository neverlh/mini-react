module.exports = {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'type-enum': [
			2,
			'always',
			[
				'docs', // 仅仅修改了文档，比如README, CHANGELOG等
				'chore', // 改变构建流程、或者增加依赖库、工具等
				'feat', // 新增feature
				'fix', // 修复bug
				'merge', // 仅进行分支合并.
				'perf', // 优化相关
				'refactor', // 代码重构
				'revert', // 回滚到上一个版本
				'style', // 仅仅修改了空格、格式缩进、逗号等等，不改变代码逻辑
				'test', // 测试用例，包括单元测试、集成测试等
				'build' //主要目的是修改项目构建系统(例如 glup，webpack，rollup 的配置等)的提交
			]
		]
	}
}
