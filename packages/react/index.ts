import { createElement } from './src/jsx'
import currentDispatcher, {
	Dispatcher,
	resolveDispatcher
} from './currentDispatcher'
export { REACT_FRAGMENT_TYPE as Fragment } from 'shared/ReactSymbols'

// 共享数据层 在reconciler中 renderWithHooks 赋值当前对应的hooks集合
export const CURRENT_DISPATCHER = {
	currentDispatcher
}

export const useState: Dispatcher['useState'] = (initialState) => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useState(initialState)
}

export default {
	version: '0.0.0',
	createElement
}
