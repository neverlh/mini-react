import internals from 'shared/internals'
import { FiberNode } from './fiber'
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue'
import { Dispatcher, Dispatch } from '../../react/currentDispatcher'
import { Action } from 'shared/ReactTypes'
import { scheduleUpdateOnFiber } from './workLoop'
import { Lane, NoLane, requestUpdateLane } from './fiberLanes'

/** 当前正在执行hooks的FunctionComponent的fiber */
let currentlyRenderingFiber: FiberNode | null = null
/** 当前正在执行的hook */
let workInProgressHook: Hook | null = null
/** update正在执行的hook => workInProgressHook */
let currentHook: Hook | null = null
/** 当前render的lane */
let renderLane: Lane = NoLane

const { currentDispatcher } = internals

interface Hook {
	memoizedState: any
	updateQueue: unknown
	next: Hook | null
}

export const renderWithHooks = (wip: FiberNode, lane: Lane) => {
	currentlyRenderingFiber = wip

	/** 重置fiber节点上的hooks */
	wip.memoizedState = null
	renderLane = lane

	const current = wip.alternate

	// 对hooks集合进行赋值
	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount
	}

	const component = wip.type
	const props = wip.pendingProps
	// FC render
	const children = component(props)

	// 重置
	currentlyRenderingFiber = null
	workInProgressHook = null
	currentHook = null
	renderLane = NoLane

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
	const lane = requestUpdateLane()
	const update = createUpdate(action, lane)
	enqueueUpdate(updateQueue, update)
	scheduleUpdateOnFiber(fiber, lane)
}

/** mount生成hook */
const mountWorkInProgressHook = (): Hook => {
	const hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	}

	if (workInProgressHook === null) {
		// 第一个hook
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

/** update useState */
const updateState = <State>(): [State, Dispatch<State>] => {
	const hook = updateWorkInProgressHook()

	const queue = hook.updateQueue as UpdateQueue<State>
	const pending = queue.shared.pending

	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(
			hook.memoizedState,
			pending,
			renderLane
		)
		hook.memoizedState = memoizedState
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>]
}

const updateWorkInProgressHook = (): Hook => {
	// TODO function App() {
	//        const [xx, setNum] = useState()
	//        setNum()
	//      }

	let nextCurrentHook: Hook | null = null

	if (currentHook == null) {
		const current = currentlyRenderingFiber?.alternate
		// update第一个hook
		if (current !== null) {
			nextCurrentHook = current?.memoizedState
		} else {
			// 理论上不会走到这 可能会有边界情况
			nextCurrentHook = null
		}
	} else {
		nextCurrentHook = currentHook.next
	}

	if (nextCurrentHook === null) {
		// mount/update u1 u2 u3
		// update       u1 u2 u3 u4
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的Hook比上次执行时多`
		)
	}

	currentHook = nextCurrentHook as Hook

	const newHook: Hook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null
	}

	if (workInProgressHook === null) {
		// 第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook')
		} else {
			workInProgressHook = newHook
			currentlyRenderingFiber.memoizedState = workInProgressHook
		}
	} else {
		// 第2，3，。。。hook
		workInProgressHook.next = newHook
		workInProgressHook = newHook
	}

	return workInProgressHook
}

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState
}
