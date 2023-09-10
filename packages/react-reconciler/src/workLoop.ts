import { scheduleMicroTask } from 'hostConfig'
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_cancelCallback,
	unstable_shouldYield
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
	commitLayoutEffects,
	commitMutationEffects
} from './commitWork'
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	lanesToSchedulerPriority,
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

const RootInComplete = 1
const RootCompleted = 2
// TODO 报错

/** 调度fiber节点上的更新 => ReactDOM.render setState ReactDOM.createRoot().render() 会触发*/
export const scheduleUpdateOnFiber = (fiber: FiberNode, lane: Lane) => {
	const root = markUpdateLaneFromFiberToRoot(fiber, lane)

	markRootUpdated(root, lane)
	ensureRootIsScheduled(root)
}

const markRootUpdated = (root: FiberRootNode, lane: Lane) => {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane)
}

/** schedule阶段入口 */
const ensureRootIsScheduled = (root: FiberRootNode) => {
	const updateLane = getHighestPriorityLane(root.pendingLanes)
	const existingCallback = root.callbackNode

	if (updateLane === NoLane) {
		// 已经没有任务了
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback)
		}
		root.callbackNode = null
		root.callbackPriority = NoLane
		return
	}

	const prevPriority = root.callbackPriority
	const currPriority = updateLane

	if (prevPriority === currPriority) {
		// 被打断的任务优先级是最高的
		return
	}

	if (existingCallback !== null) {
		// 有更高优先级的任务 所以取消上次正在执行的任务
		unstable_cancelCallback(existingCallback)
	}

	let newCallbackNode = null

	if (__DEV__) {
		console.log(
			`在${updateLane === SyncLane ? '微' : '宏'}任务中调度，优先级：`,
			updateLane
		)
	}

	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root))
		scheduleMicroTask(flushSyncCallbacks)
	} else {
		// 其他优先级的更新 宏任务调度
		const schedulerPriority = lanesToSchedulerPriority(updateLane)

		newCallbackNode = scheduleCallback(
			schedulerPriority,
			performConcurrentWorkOnRoot.bind(null, root)
		)
	}

	root.callbackNode = newCallbackNode
	root.callbackPriority = currPriority
}

/** 将更新冒泡到fiberRootNode上 react每次更新递归都是从fiberRootNode开始 */
const markUpdateLaneFromFiberToRoot = (fiber: FiberNode, lane: Lane) => {
	let node = fiber
	let parent = node.return

	while (parent !== null) {
		// 保存每个fiber都能知道他的子fiber有没有更新
		parent.childLanes = mergeLanes(parent.childLanes, lane)
		const alternate = parent.alternate
		if (alternate !== null) {
			alternate.childLanes = mergeLanes(alternate.childLanes, lane)
		}

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
	root.finishedLane = NoLane
	root.finishedWork = null
	workInProgress = createWorkInProgress(root.current, {})
	wipRootRenderLane = lane
}

const performSyncWorkOnRoot = (root: FiberRootNode) => {
	const nextLane = getHighestPriorityLane(root.pendingLanes)

	if (nextLane !== SyncLane) {
		// 其他比SyncLane低的优先级
		// NoLane
		ensureRootIsScheduled(root)
		return
	}

	const exitStatus = renderRoot(root, nextLane, false)

	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate
		root.finishedWork = finishedWork
		root.finishedLane = nextLane
		wipRootRenderLane = NoLane

		commitRoot(root)
	} else {
		if (__DEV__) {
			console.error('还未实现的同步更新结束状态')
		}
	}
}

/**
 * concurrent模式入口
 * @param didTimeout 解决饥饿问题 当前任务是否需要立即执行
 */
const performConcurrentWorkOnRoot = (
	root: FiberRootNode,
	didTimeout: boolean
): any => {
	// 保证上次更新的useEffect回调执行
	const curCallback = root.callbackNode
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects)
	if (didFlushPassiveEffect) {
		// effect触发了更高优先级的更新
		if (root.callbackNode !== curCallback) {
			return null
		}
	}

	const lane = getHighestPriorityLane(root.pendingLanes)
	const currCallbackNode = root.callbackNode

	if (lane == NoLane) {
		return
	}

	const needSync = lane === SyncLane || didTimeout

	// render阶段
	const exitStatus = renderRoot(root, lane, !needSync)

	// render结束 有可能是被打断 所以需要重新调度更新
	ensureRootIsScheduled(root)

	if (exitStatus === RootInComplete) {
		// 中断 同优先级 或者更高的优先级
		if (root.callbackNode !== currCallbackNode) {
			// 新调度的是更高的优先级 => ensureRootIsScheduled existingCallback !== null
			return null
		}
		// 该任务优先级是最高的 提供给schduler 接着执行 => ensureRootIsScheduled prevPriority === currPriority
		return performConcurrentWorkOnRoot.bind(null, root)
	}

	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate
		root.finishedWork = finishedWork
		root.finishedLane = lane
		wipRootRenderLane = NoLane

		commitRoot(root)
	} else {
		if (__DEV__) {
			console.error('还未实现的同步更新结束状态')
		}
	}
}

/**
 * @param shouldTimeSlice 开始时间切片
 */
const renderRoot = (
	root: FiberRootNode,
	lane: Lane,
	shouldTimeSlice: boolean
) => {
	if (__DEV__) {
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root)
	}

	if (wipRootRenderLane !== lane) {
		// 新任务才需要初始化wip fiber wipRootRenderLane
		prepareFreshStack(root, lane)
	}

	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync()
			break
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e)
			}
			workInProgress = null
		}
	} while (true)

	// 任务中断
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete
	}

	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error(`render阶段结束时wip不应该不是null`)
	}

	// TODO 报错
	return RootCompleted
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
		commitLayoutEffects(finishedWork, root)
	} else {
		root.current = finishedWork
	}

	rootDoesHasPassiveEffects = false
	ensureRootIsScheduled(root)
}

const flushPassiveEffects = (pendingPassiveEffects: PendingPassiveEffects) => {
	let didFlushPassiveEffect = false
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffectListUnmount(Passive, effect)
	})

	pendingPassiveEffects.unmount = []

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffectListDestroy(Passive | HookHasEffect, effect)
	})

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffectListCreate(Passive | HookHasEffect, effect)
	})

	pendingPassiveEffects.update = []

	// effect中 setState
	flushSyncCallbacks()
	return didFlushPassiveEffect
}

const workLoopSync = () => {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress)
	}
}

const workLoopConcurrent = () => {
	// unstable_shouldYield 本次任务是否中断
	while (workInProgress !== null && !unstable_shouldYield()) {
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
