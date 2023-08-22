import { Props, Key, Ref } from 'shared/ReactTypes'

import { WorkTags } from './workTags'
import { FiberFlags, NoFlags } from './fiberFlags'
import { Container } from './hostConfig'

export class FiberNode {
	/** 组件 => 实例 标签 => DOM*/
	stateNode: any = null

	/** 上次更新的Props */
	memoizedProps: Props = null

	/*** 存放了该fiber节点上的更新信息 */
	updateQueue: unknown = null

	/** ClassComponent state */
	memoizedState: any = null

	/**
	 * 如果是自定义组件则该属性就是和该fiber节点关联的function或class
	 * 如果是div,span则就是一个字符串
	 */
	type: any

	ref: Ref | null = null

	/** 链接workInProgress树与current树 */
	alternate: FiberNode | null = null

	/**
	 * 该fiber节点父节点（以HostRoot为tag的fiber节点return属性为null）
	 */
	return: FiberNode | null = null

	/** 指向第一个子节点 */
	child: FiberNode | null = null

	/** 兄弟节点 */
	sibling: FiberNode | null = null

	/** 对应子节点的数组下标 */
	index: number = 0

	/** 副作用 代表本次更新是新增、删除、更新 */
	flags: FiberFlags = NoFlags

	constructor(
		public tag: WorkTags,
		/** 即将更新的props */
		public pendingProps: Props,
		public key: Key
	) {
		this.tag = tag
		this.pendingProps = pendingProps
		this.key = key
	}
}

/**
 * 整个应用根节点
 */
export class FiberRootNode {
	/** 根宿主环境有关 */
	container: Container
	/** 指向hostRoot */
	current: FiberNode
	/** 已经完成更新的fiber树 */
	finishedWork: FiberNode | null = null

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.current = hostRootFiber
		/** hostRootFiber ==> stateNode  => fiberRootNode*/
		hostRootFiber.stateNode = this
		this.container = container
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate

	if (wip === null) {
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key)
		wip.stateNode = current.stateNode
		wip.alternate = current
		current.alternate = wip
	} else {
		// update
		wip.pendingProps = pendingProps
		wip.flags = NoFlags
	}

	wip.type = current.type
	wip.updateQueue = current.updateQueue
	wip.child = current.child
	wip.memoizedProps = current.memoizedProps
	wip.memoizedState = current.memoizedState

	return wip
}
