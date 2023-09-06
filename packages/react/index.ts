import { createElement } from './src/jsx'
import currentDispatcher, {
	Dispatcher,
	resolveDispatcher
} from './src/currentDispatcher'
import currentBatchConfig from './src/currentBatchConfig'
export { REACT_FRAGMENT_TYPE as Fragment } from 'shared/ReactSymbols'

export { createContext } from './src/context'

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

export const useRef: Dispatcher['useRef'] = (initialValue) => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useRef(initialValue)
}

export const useContext: Dispatcher['useContext'] = (initialValue) => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useContext(initialValue)
}

export default {
	version: '0.0.0',
	createElement
}
