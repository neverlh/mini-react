import { FiberNode } from './fiber'

export const renderWithHooks = (wip: FiberNode) => {
	const component = wip.type
	const props = wip.pendingProps
	const children = component(props)
	return children
}
