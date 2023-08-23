import internals from 'shared/internals'
import { FiberNode } from './fiber'
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate
} from './updateQueue'
import { Dispatcher, Dispatch } from '../../react/currentDispatcher'
import { Action } from 'shared/ReactTypes'
import { scheduleUpdateOnFiber } from './workLoop'

/** 当前正在执行hooks的FunctionComponent的fiber */
let currentlyRenderingFiber: FiberNode | null = null
/** 当前正在执行的hook */
let workInProgressHook: Hook | null = null

const { currentDispatcher } = internals

interface Hook {
	memoizedState: any
	updateQueue: unknown
	next: Hook | null
}

export const renderWithHooks = (wip: FiberNode) => {
	currentlyRenderingFiber = wip

	/** 重置fiber节点上的hooks */
	wip.memoizedState = null

	const current = wip.alternate

	// 对hooks集合进行赋值
	if (current !== null) {
		// update
	} else {
		currentDispatcher.current = HooksDispatcherOnMount
	}

	const component = wip.type
	const props = wip.pendingProps
	const children = component(props)

	currentlyRenderingFiber = null
	return children
}

/** mount => useState */
const mountState = <State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] => {
	const hook = mountWorkInProgressHook()

	let memoizedState = null

	// 初始化useState state
	if (initialState instanceof Function) {
		memoizedState = initialState()
	} else {
		memoizedState = initialState
	}

	const queue = createUpdateQueue<State>()
	hook.updateQueue = queue
	hook.memoizedState = memoizedState

	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue)
	queue.dispatch = dispatch

	return [memoizedState, dispatch]
}

/**
 * const [, setNum] = useState中setNum实际调用dispatchSetState
 * 参数fiber updateQueue绑定到对应执行的hooks
 * */
const dispatchSetState = <State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) => {
	const update = createUpdate(action)
	enqueueUpdate(updateQueue, update)
	scheduleUpdateOnFiber(fiber)
}

/** mount生成hook */
const mountWorkInProgressHook = (): Hook => {
	const hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	}

	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) {
			throw new Error('请在FunctionComponent中使用hook')
		} else {
			workInProgressHook = hook
			currentlyRenderingFiber.memoizedState = hook
		}
	} else {
		// 第2，3，。。。hook
		workInProgressHook.next = hook
		workInProgressHook = hook
	}

	return workInProgressHook
}

/** mount时 hooks集合 */
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
}
