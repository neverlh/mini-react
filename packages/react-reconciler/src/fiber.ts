import { Container } from 'hostConfig'
import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes'

import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	WorkTags
} from './workTags'
import { Flags, NoFlags } from './fiberFlags'
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes'
import { Effect } from './fiberHooks'
import { CallbackNode } from 'scheduler'
import { REACT_PROVIDER_TYPE } from 'shared/ReactSymbols'

export class FiberNode {
	/** 组件 => 实例 标签 => DOM hostRoot => fiberRootNode*/
	stateNode: any = null

	/** 上次更新的Props */
	memoizedProps: Props = null

	/** 存放了该fiber节点上的更新信息 hostComponent => [key,value]dom节点的属性变化 FC => effect列表 */
	updateQueue: unknown = null

	/** ClassComponent => state FC => Hooks链表 */
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

	/** 对应父节点中child的数组下标 */
	index: number = 0

	/** 副作用 代表本次更新是新增、删除、更新 */
	flags: Flags = NoFlags
	/** 子树副作用合集 */
	subtreeFlags: Flags = NoFlags
	/** 删除子fiber合集 */
	deletions: FiberNode[] | null = null

	/** 当前fiber上触发的更新 用于bailout策略 */
	lanes: Lanes = NoLanes
	/** 当前fiber子树上触发的更新 用于bailout策略 */
	childLanes: Lanes = NoLanes

	constructor(
		public tag: WorkTags,
		/** 即将更新的props */
		public pendingProps: Props,
		public key: Key
	) {
		this.tag = tag
		this.pendingProps = pendingProps
		this.key = key || null
	}
}

export interface PendingPassiveEffects {
	unmount: Effect[]
	update: Effect[]
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

	/** 已经完成任务的lane */
	finishedLane: Lane = NoLane
	/** 等待被执行任务的lanes */
	pendingLanes: Lanes = NoLanes

	/** 当前正在renderer的任务 */
	callbackNode: CallbackNode | null = null
	/** 当前正在renderer的任务的优先级 */
	callbackPriority: Lane = NoLane

	/** mount/update 时所有需要执行的effect */
	pendingPassiveEffects: PendingPassiveEffects = {
		unmount: [],
		update: []
	}

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
		wip.subtreeFlags = NoFlags
		wip.deletions = null
	}

	wip.type = current.type
	wip.updateQueue = current.updateQueue
	wip.child = current.child
	wip.memoizedProps = current.memoizedProps
	wip.memoizedState = current.memoizedState
	wip.ref = current.ref

	wip.lanes = current.lanes
	wip.childLanes = current.childLanes

	return wip
}

export const createFiberFromElement = (element: ReactElementType) => {
	const { type, key, props, ref } = element

	let fiberTag: WorkTags = FunctionComponent

	if (typeof type === 'string') {
		fiberTag = HostComponent
	} else if (
		typeof type === 'object' &&
		type.$$typeof === REACT_PROVIDER_TYPE
	) {
		fiberTag = ContextProvider
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('为定义的type类型', element)
	}

	const fiber = new FiberNode(fiberTag, props, key)

	fiber.type = type
	fiber.ref = ref

	return fiber
}

export const createFiberFromFragment = (element: any, key: Key) => {
	const fiber = new FiberNode(Fragment, element, key)
	return fiber
}
