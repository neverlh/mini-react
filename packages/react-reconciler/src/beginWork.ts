import { ReactElementType } from 'shared/ReactTypes'
import { FiberNode } from './fiber'
import { UpdateQueue, processUpdateQueue } from './updateQueue'
import { HostComponent, HostRoot, HostText } from './workTags'
import { mountChildFiber, reconcileChildFibers } from './childFibers'

/**
 * 传入当前Fiber节点，创建子Fiber节点
 * @param wip 当前节点
 * @returns 下一个要进行beginWork的节点
 */
export const beginWork = (wip: FiberNode): FiberNode | null => {
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip)
		case HostComponent:
			return updateHostComponent(wip)
		case HostText:
			return null
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型')
			}
			break
	}

	return null
}

const updateHostRoot = (wip: FiberNode) => {
	const baseState = wip.memoizedState
	const updateQueue = wip.updateQueue as UpdateQueue<Element>
	const pending = updateQueue.shared.pending
	updateQueue.shared.pending = null
	const { memoizedState } = processUpdateQueue(baseState, pending)
	wip.memoizedState = memoizedState

	// hostRootFiber memoizedState存放的render()传入的对象
	const nextChildren = wip.memoizedState
	reconcileChildren(wip, nextChildren)
	return wip.child
}

const updateHostComponent = (wip: FiberNode) => {
	const nextProps = wip.pendingProps
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
