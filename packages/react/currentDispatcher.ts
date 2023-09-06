import { Action } from 'shared/ReactTypes'

export type Dispatch<State> = (action: Action<State>) => void

export interface Dispatcher {
	useState: <T>(initialState: () => T | T) => [T, Dispatch<T>]
	useEffect: (callback: () => void | void, deps: any[] | void) => void
	useTransition: () => [boolean, (callback: () => void) => void]
	useRef: <T>(initialValue: T) => { current: T }
}

/** 当前使用hooks集合 */
const currentDispatcher: { current: Dispatcher | null } = {
	current: null
}

/**
 * 取得此时应该使用的Dispatcher react mount update时使用的hook集合是不同的
 */
export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current

	if (dispatcher === null) {
		throw new Error('hook只能在函数组件使用')
	}

	return dispatcher
}

export default currentDispatcher
