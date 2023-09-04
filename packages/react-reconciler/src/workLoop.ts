import { scheduleMicroTask } from 'hostConfig'
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority
} from 'scheduler'

import {
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects,
	createWorkInProgress
} from './fiber'
import { beginWork } from './beginWork'
import { completeWork } from './completeWork'
import { HostRoot } from './workTags'
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags'
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitMutationEffects
} from './commitWork'
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	markRootFinished,
	mergeLanes
} from './fiberLanes'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { HookHasEffect, Passive } from './hookEffectTags'

/** 当前正在工作的fiberNode */
let workInProgress: null | FiberNode = null
let wipRootRenderLane: Lane = NoLane
/** 同批处理 isFlushingSyncQueue */
let rootDoesHasPassiveEffects = false

/** 调度fiber节点上的更新 => ReactDOM.render setState ReactDOM.createRoot().render() 会触发*/
export const scheduleUpdateOnFiber = (fiber: FiberNode, lane: Lane) => {
	const root = markUpdateFromFiberToRoot(fiber)

	markRootUpdated(root, lane)
	ensureRootIsScheduled(root)
}

const markRootUpdated = (root: FiberRootNode, lane: Lane) => {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane)
}

/** schedule阶段入口 */
const ensureRootIsScheduled = (root: FiberRootNode) => {
	const updateLane = getHighestPriorityLane(root.pendingLanes)

	if (updateLane === NoLane) {
		return
	}

	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane))
		scheduleMicroTask(flushSyncCallbacks)
	} else {
		// 其他优先级的更新
	}
}

/** 将更新冒泡到fiberRootNode上 react每次更新递归都是从fiberRootNode开始 */
const markUpdateFromFiberToRoot = (fiber: FiberNode) => {
	let node = fiber
	let parent = node.return

	while (parent !== null) {
		node = parent
		parent = node.return
	}

	/** 见fiberRootNode结构 */
	if (node.tag === HostRoot) {
		return node.stateNode
	}

	return null
}

/** 新一轮更新初始化 */
const prepareFreshStack = (root: FiberRootNode, lane: Lane) => {
	workInProgress = createWorkInProgress(root.current, {})
	wipRootRenderLane = lane
}

const performSyncWorkOnRoot = (root: FiberRootNode, lane: Lane) => {
	const nextLane = getHighestPriorityLane(root.pendingLanes)

	if (nextLane !== SyncLane) {
		// 其他比SyncLane低的优先级
		// NoLane
		ensureRootIsScheduled(root)
		return
	}

	if (__DEV__) {
		console.warn('render阶段开始')
	}

	prepareFreshStack(root, lane)

	do {
		try {
			workLoop()
			break
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e)
			}
			workInProgress = null
		}
	} while (true)

	const finishedWork = root.current.alternate
	root.finishedWork = finishedWork
	root.finishedLane = wipRootRenderLane
	wipRootRenderLane = NoLane

	// 进入commit阶段
	commitRoot(root)
}

const commitRoot = (root: FiberRootNode) => {
	const finishedWork = root.finishedWork

	if (finishedWork === null) {
		return
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork)
	}

	const lane = root.finishedLane

	if (lane === NoLane && __DEV__) {
		console.error('commit阶段finishedLane不应该是NoLane')
	}

	root.finishedWork = null
	root.finishedLane = NoLane

	markRootFinished(root, lane)

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true
			// 调度副作用 异步调度
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects)
				return
			})
		}
	}

	// 判断整颗fiber树是否有副作用
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags
	const rootHasFlags =
		(finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags

	if (subtreeHasEffect || rootHasFlags) {
		// beforeMutation

		// Mutation Placement
		commitMutationEffects(finishedWork, root)
		root.current = finishedWork

		// layout
	} else {
		root.current = finishedWork
	}

	rootDoesHasPassiveEffects = false
	ensureRootIsScheduled(root)
}

const flushPassiveEffects = (pendingPassiveEffects: PendingPassiveEffects) => {
	pendingPassiveEffects.unmount.forEach((effect) => {
		commitHookEffectListUnmount(Passive, effect)
	})

	pendingPassiveEffects.unmount = []

	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListDestroy(Passive | HookHasEffect, effect)
	})

	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListCreate(Passive | HookHasEffect, effect)
	})

	pendingPassiveEffects.update = []

	// effect中 setState
	flushSyncCallbacks()
}

const workLoop = () => {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress)
	}
}

/**
 * 以fiber节点为工作单位开始递归的begin阶段
 */
const performUnitOfWork = (unitOfWork: FiberNode) => {
	let next: null | FiberNode = null

	next = beginWork(unitOfWork, wipRootRenderLane)

	unitOfWork.memoizedProps = unitOfWork.pendingProps

	// DFS，next为null，则表示该节点没有子节点，则进行归的过程
	if (next === null) {
		completeUnitOfWork(unitOfWork)
	} else {
		workInProgress = next
	}
}

/**
 * 以fiber节点为工作单位开始递归的complete阶段
 */
const completeUnitOfWork = (unitOfWork: FiberNode) => {
	let node: FiberNode | null = unitOfWork

	do {
		completeWork(node)

		const sibling = node.sibling

		// DFS, 当一个节点的'归阶段'完成则立马进入下一个兄弟节点的'递阶段' => workLoop
		if (sibling !== null) {
			workInProgress = sibling
			return
		}

		// node及所有兄弟节点都完成了递和归阶段，接下来就到了node return的的归阶段 => 接着dowhile
		node = node.return
		workInProgress = node
	} while (node !== null)
}
