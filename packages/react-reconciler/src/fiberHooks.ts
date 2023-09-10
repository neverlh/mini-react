import internals from 'shared/internals'
import ReactCurrentBatchConfig from 'react/src/currentBatchConfig'
import { Dispatcher, Dispatch } from 'react/src/currentDispatcher'
import { Action, ReactContext } from 'shared/ReactTypes'

import { FiberNode } from './fiber'
import {
	Update,
	UpdateQueue,
	basicStateReducer,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue'
import { scheduleUpdateOnFiber } from './workLoop'
import {
	Lane,
	NoLane,
	mergeLanes,
	requestUpdateLane,
	removeLanes,
	NoLanes
} from './fiberLanes'
import { Flags, PassiveEffect } from './fiberFlags'
import { HookHasEffect, Passive } from './hookEffectTags'
import { markWipReceiveUpdate } from './beginWork'

/** 当前正在执行hooks的FunctionComponent的fiber */
let currentlyRenderingFiber: FiberNode | null = null
/** 当前正在执行的hook */
let workInProgressHook: Hook | null = null
/** current hook => workInProgressHook */
let currentHook: Hook | null = null
/** 当前render的lane */
let renderLane: Lane = NoLane

const { currentDispatcher } = internals

interface Hook {
	memoizedState: any
	updateQueue: unknown
	next: Hook | null
	baseState: any
	baseQueue: Update<any> | null
}

type EffectCallback = () => void
type EffectDeps = any[] | null

export interface Effect {
	tag: Flags
	create: EffectCallback | void
	destroy: EffectCallback | void
	deps: EffectDeps
	next: Effect | null
}

/** FC fiber updateQueue 存放所有effect的链表 方便在收集effect 不需要遍历hook链表 */
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null
	lastRenderedState: State
}

export const renderWithHooks = (wip: FiberNode, lane: Lane) => {
	currentlyRenderingFiber = wip

	/** 重置fiber节点上的hooks */
	wip.memoizedState = null
	// 重置 effect链表
	wip.updateQueue = null
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

export const bailoutHook = (wip: FiberNode, renderLane: Lane) => {
	const current = wip.alternate as FiberNode
	wip.updateQueue = current.updateQueue
	wip.flags &= ~PassiveEffect

	current.lanes = removeLanes(current.lanes, renderLane)
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

	const queue = createFCUpdateQueue<State>()
	hook.updateQueue = queue
	hook.memoizedState = memoizedState
	hook.baseState = memoizedState

	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue)
	queue.dispatch = dispatch
	queue.lastRenderedState = memoizedState

	return [memoizedState, dispatch]
}

/**
 * const [, setNum] = useState中setNum实际调用dispatchSetState
 * 参数fiber updateQueue绑定到对应执行的hooks
 * */
const dispatchSetState = <State>(
	fiber: FiberNode,
	updateQueue: FCUpdateQueue<State>,
	action: Action<State>
) => {
	const lane = requestUpdateLane()
	const update = createUpdate(action, lane)

	const current = fiber.alternate
	if (
		fiber.lanes === NoLanes &&
		(current === null || current.lanes === NoLanes)
	) {
		// 当前产生的update是这个fiber的第一个update
		// 1. 更新前的状态 2.计算状态的方法
		const currentState = updateQueue.lastRenderedState
		const eagarState = basicStateReducer(currentState, action)
		update.hasEagerState = true
		update.eagerState = eagarState

		if (Object.is(currentState, eagarState)) {
			enqueueUpdate(updateQueue, update, fiber, NoLane)
			// 命中eagerState
			if (__DEV__) {
				console.warn('命中eagerState', fiber)
			}
			return
		}
	}
	enqueueUpdate(updateQueue, update, fiber, lane)
	scheduleUpdateOnFiber(fiber, lane)
}

/** mount生成hook */
const mountWorkInProgressHook = (): Hook => {
	const hook = {
		memoizedState: null,
		updateQueue: null,
		next: null,
		baseState: null,
		baseQueue: null
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

const createFCUpdateQueue = <State>() => {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>
	updateQueue.lastEffect = null
	return updateQueue
}

/** 链接effect环形链表 */
const pushEffect = (
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
) => {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	}

	const fiber = currentlyRenderingFiber as FiberNode
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>

	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue()
		fiber.updateQueue = updateQueue
		effect.next = effect
		updateQueue.lastEffect = effect
	} else {
		const lastEffect = updateQueue.lastEffect
		if (lastEffect === null) {
			effect.next = effect
			updateQueue.lastEffect = effect
		} else {
			const firstEffect = lastEffect.next
			effect.next = firstEffect
			lastEffect.next = effect
			updateQueue.lastEffect = effect
		}
	}
	return effect
}

/** mount => useEffect */
const mountEffect = (
	create: EffectCallback | void,
	deps: EffectDeps | void
) => {
	const hook = mountWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps

	// 需要标记改fiber中有effect回调需要被执行
	;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect
	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	)
}

const mountTransition = (): [boolean, (callback: () => void) => void] => {
	const [isPending, setPending] = mountState(false)
	const hook = mountWorkInProgressHook()
	const start = startTransition.bind(null, setPending)
	hook.memoizedState = start
	return [isPending, start]
}

const startTransition = (
	setPending: Dispatch<boolean>,
	callback: () => void
) => {
	setPending(true)
	const prevTransition = ReactCurrentBatchConfig.transition
	// 用于在requestUpdateLane中获取startTransition中setState的优先级
	ReactCurrentBatchConfig.transition = 1
	callback()
	setPending(false)
	ReactCurrentBatchConfig.transition = prevTransition
}

const mountRef = <T>(initialValue: T) => {
	const hook = mountWorkInProgressHook()
	const ref = { current: initialValue }
	hook.memoizedState = ref
	return ref
}

/** useContext是不需要依赖hooks列表的 */
const readContext = <T>(context: ReactContext<T>): T => {
	const consumer = currentlyRenderingFiber
	if (consumer === null) {
		throw new Error('只能在函数组件中调用useContext')
	}
	return context._currentValue
}

/** mount时 hooks集合 */
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect,
	useTransition: mountTransition,
	useRef: mountRef,
	useContext: readContext
}

/** update useState */
const updateState = <State>(): [State, Dispatch<State>] => {
	const hook = updateWorkInProgressHook()

	const queue = hook.updateQueue as FCUpdateQueue<State>
	const pending = queue.shared.pending

	const current = currentHook as Hook
	const baseState = current.baseState
	let baseQueue = current.baseQueue

	if (pending !== null) {
		if (baseQueue !== null) {
			// 将baseQueue与pending连接
			// baseQueue b2 -> b0 -> b1 -> b2
			// pendingQueue p2 -> p0 -> p1 -> p2
			// b0
			const baseFirst = baseQueue.next
			// p0
			const pendingFirst = pending.next
			// b2 -> p0
			baseQueue.next = pendingFirst
			// p2 -> b0
			pending.next = baseFirst
			// p2 -> b0 -> b1 -> b2 -> p0 -> p1 -> p2
		}

		baseQueue = pending
		// 保存在current中 打断可以重新取出来
		current.baseQueue = baseQueue
		queue.shared.pending = null
	}

	if (baseQueue !== null) {
		const prevState = hook.memoizedState
		const {
			memoizedState,
			baseQueue: newBaseQueue,
			baseState: newBaseState
		} = processUpdateQueue(baseState, baseQueue, renderLane, (update) => {
			// 被跳过的lane需要重新加回去 beginWork的时候有赋值NoLanes
			const skippedLane = update.lane
			const fiber = currentlyRenderingFiber as FiberNode
			fiber.lanes = mergeLanes(fiber.lanes, skippedLane)
		})

		// state计算 值不想等 FC则需要进入render
		if (!Object.is(prevState, memoizedState)) {
			markWipReceiveUpdate()
		}

		hook.memoizedState = memoizedState
		hook.baseQueue = newBaseQueue
		hook.baseState = newBaseState

		queue.lastRenderedState = memoizedState
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>]
}

const areHookInputsEqual = (nextDeps: EffectDeps, prevDeps: EffectDeps) => {
	if (prevDeps === null || nextDeps === null) {
		return false
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue
		}
		return false
	}
	return true
}

const updateEffect = (
	create: EffectCallback | void,
	deps: EffectDeps | void
) => {
	const hook = updateWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	let destroy: EffectCallback | void

	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState as Effect
		destroy = prevEffect.destroy

		if (nextDeps !== null) {
			const prevDeps = prevEffect.deps
			// 浅比较 相同 则不需要HookHasEffect
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps)
				return
			}
		}

		// 浅比较 不相同 需要标记改fiber中有effect回调需要被执行
		;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect
		hook.memoizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destroy,
			nextDeps
		)
	}
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
		next: null,
		baseQueue: currentHook.baseQueue,
		baseState: currentHook.baseState
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

const updateTransition = (): [boolean, (callback: () => void) => void] => {
	const [isPending] = updateState()
	const hook = updateWorkInProgressHook()
	const start = hook.memoizedState
	return [isPending as boolean, start]
}

const updateRef = () => {
	const hook = updateWorkInProgressHook()
	return hook.memoizedState
}

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect,
	useTransition: updateTransition,
	useRef: updateRef,
	useContext: readContext
}
