import { ReactElementType, ReactProviderType } from 'shared/ReactTypes'
import { FiberNode } from './fiber'
import { UpdateQueue, processUpdateQueue } from './updateQueue'
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	Fragment,
	ContextProvider
} from './workTags'
import {
	cloneChildFibers,
	mountChildFiber,
	reconcileChildFibers
} from './childFibers'
import { bailoutHook, renderWithHooks } from './fiberHooks'
import { Lane, NoLane, NoLanes, includeSomeLanes } from './fiberLanes'
import { Ref } from './fiberFlags'
import { pushProvider } from './fiberContext'

/** 默认进入bailout策略 */
let didReceiveUpdate = false

export const markWipReceiveUpdate = () => {
	didReceiveUpdate = true
}

/**
 * 传入当前Fiber节点，创建子Fiber节点
 * @param wip 当前节点
 * @returns 下一个要进行beginWork的节点
 */
export const beginWork = (
	wip: FiberNode,
	renderLane: Lane
): FiberNode | null => {
	didReceiveUpdate = false
	const current = wip.alternate

	if (current !== null) {
		const oldProps = current.memoizedProps
		const newProps = wip.pendingProps

		/** 每次render 如果没有复用上次的 那么jsx生成的props都是新的 所以只需要=== */
		if (oldProps !== newProps || current.type !== wip.type) {
			didReceiveUpdate = true
		} else {
			const hasSchduledStateOrContext = checkScheduledUpdateOrContext(
				current,
				renderLane
			)
			if (!hasSchduledStateOrContext) {
				// props state type都相同 命中bailout
				didReceiveUpdate = false

				return bailoutOnAlreadyFinishedWork(wip, renderLane)
			}
		}
	}

	wip.lanes = NoLanes

	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane)
		case HostComponent:
			return updateHostComponent(wip)
		case HostText:
			return null
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane)
		case Fragment:
			return updateFragment(wip)
		case ContextProvider:
			return updateContextProvider(wip)
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型')
			}
			break
	}

	return null
}

const checkScheduledUpdateOrContext = (
	current: FiberNode,
	renderLane: Lane
) => {
	const updateLane = current.lanes

	// 判断是否有state的更新
	if (includeSomeLanes(updateLane, renderLane)) {
		return true
	}

	return false
}

const bailoutOnAlreadyFinishedWork = (wip: FiberNode, renderLane: Lane) => {
	// 父fiber节点命中bailout

	if (!includeSomeLanes(wip.childLanes, renderLane)) {
		//  子fiber也不存在renderLane 则所有的子fiber不需要重新render return null会直接进入当前fiber的completeWork
		if (__DEV__) {
			console.warn('bailout整棵子树', wip)
		}
		return null
	}

	if (__DEV__) {
		console.warn('bailout一个fiber', wip)
	}

	// 子fiber有renderLane 命中bailout 复用之前所有的childFiber 不需要beginWork后续流程
	cloneChildFibers(wip)

	return wip.child
}

/** FunctionComponent组件type即是函数本身 */
const updateFunctionComponent = (wip: FiberNode, renderLane: Lane) => {
	const nextChildren = renderWithHooks(wip, renderLane)

	const current = wip.alternate

	if (!didReceiveUpdate && current !== null) {
		// state计算不同时didReceiveUpdate = true state计算相同idReceiveUpdate = false 所以进入bailout策略
		bailoutHook(wip, renderLane)

		return bailoutOnAlreadyFinishedWork(wip, renderLane)
	}

	reconcileChildren(wip, nextChildren)
	return wip.child
}

const updateFragment = (wip: FiberNode) => {
	const nextChildren = wip.pendingProps
	reconcileChildren(wip, nextChildren)
	return wip.child
}

const updateHostRoot = (wip: FiberNode, renderLane: Lane) => {
	const baseState = wip.memoizedState
	const updateQueue = wip.updateQueue as UpdateQueue<Element>
	const pending = updateQueue.shared.pending
	updateQueue.shared.pending = null

	const prevChildren = wip.memoizedState

	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane)
	wip.memoizedState = memoizedState

	// hostRootFiber memoizedState存放的render()传入的对象
	const nextChildren = wip.memoizedState

	if (prevChildren === nextChildren) {
		return bailoutOnAlreadyFinishedWork(wip, renderLane)
	}

	reconcileChildren(wip, nextChildren)
	return wip.child
}

const updateHostComponent = (wip: FiberNode) => {
	const nextProps = wip.pendingProps
	const nextChildren = nextProps.children
	markRef(wip.alternate, wip)
	reconcileChildren(wip, nextChildren)
	return wip.child
}

const updateContextProvider = (wip: FiberNode) => {
	const context = wip.type._context
	const nextProps = wip.pendingProps

	pushProvider(context, nextProps.value)

	const nextChildren = nextProps.children
	reconcileChildren(wip, nextChildren)
	return wip.child
}

const reconcileChildren = (wip: FiberNode, children?: ReactElementType) => {
	const current = wip.alternate

	if (current !== null) {
		// update 创建/更新fiber节点
		wip.child = reconcileChildFibers(wip, current?.child, children)
	} else {
		// mount 创建新的fiber节点
		wip.child = mountChildFiber(wip, null, children)
	}
}

const markRef = (current: FiberNode | null, wip: FiberNode) => {
	const ref = wip.ref
	// 此处的ref代表的是jsx上的ref属性的值
	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		// mount时ref存在或者update时ref变化
		wip.flags |= Ref
	}
}
