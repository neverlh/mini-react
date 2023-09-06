import { ReactElementType } from 'shared/ReactTypes'
import { FiberNode } from './fiber'
import { UpdateQueue, processUpdateQueue } from './updateQueue'
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	Fragment
} from './workTags'
import { mountChildFiber, reconcileChildFibers } from './childFibers'
import { renderWithHooks } from './fiberHooks'
import { Lane } from './fiberLanes'
import { Ref } from './fiberFlags'

/**
 * 传入当前Fiber节点，创建子Fiber节点
 * @param wip 当前节点
 * @returns 下一个要进行beginWork的节点
 */
export const beginWork = (
	wip: FiberNode,
	renderLane: Lane
): FiberNode | null => {
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
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型')
			}
			break
	}

	return null
}

/** FunctionComponent组件type即是函数本身 */
const updateFunctionComponent = (wip: FiberNode, renderLane: Lane) => {
	const nextChildren = renderWithHooks(wip, renderLane)
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
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane)
	wip.memoizedState = memoizedState

	// hostRootFiber memoizedState存放的render()传入的对象
	const nextChildren = wip.memoizedState
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
