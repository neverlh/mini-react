import { createElement } from './src/jsx'
import currentDispatcher, {
	Dispatcher,
	resolveDispatcher
} from './currentDispatcher'
import currentBatchConfig from './currentBatchConfig'
export { REACT_FRAGMENT_TYPE as Fragment } from 'shared/ReactSymbols'

// 共享数据层 在reconciler中 renderWithHooks 赋值当前对应的hooks集合
export const CURRENT_DISPATCHER = {
	currentDispatcher,
	currentBatchConfig
}

export const useState: Dispatcher['useState'] = (initialState) => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useState(initialState)
}

export const useEffect: Dispatcher['useEffect'] = (callback, deps) => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useEffect(callback, deps)
}

export const useTransition: Dispatcher['useTransition'] = () => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useTransition()
}

export default {
	version: '0.0.0',
	createElement
}
