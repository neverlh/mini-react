import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber'

import { beginWork } from './beginWork'
import { completeWork } from './completeWork'
import { HostRoot } from './workTags'
import { MutationMask, NoFlags } from './fiberFlags'
import { commitMutationEffect } from './commitWork'

/** 当前正在工作的fiberNode */
let workInProgress: null | FiberNode = null

/** 调度fiber节点上的更新 => ReactDOM.render setState ReactDOM.createRoot().render() 会触发*/
export const scheduleUpdateOnFiber = (fiber: FiberNode) => {
	const root = markUpdateFromFiberToRoot(fiber)

	renderRoot(root)
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
const prepareFreshStack = (root: FiberRootNode) => {
	workInProgress = createWorkInProgress(root.current, {})
}

const renderRoot = (root: FiberRootNode) => {
	prepareFreshStack(root)

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

	root.finishedWork = null

	// 判断整颗fiber树是否有副作用
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags
	const rootHasFlags = (finishedWork.flags & MutationMask) !== NoFlags

	if (subtreeHasEffect || rootHasFlags) {
		// beforeMutation

		// Mutation Placement
		commitMutationEffect(finishedWork)
		root.current = finishedWork
		// layout
	} else {
		root.current = finishedWork
	}
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

	next = beginWork(unitOfWork)

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
