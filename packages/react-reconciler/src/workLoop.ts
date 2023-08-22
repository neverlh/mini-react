import { FiberNode } from './fiber'

import { beginWork } from './beginWork'
import { completeWork } from './completeWork'

/** 当前正在工作的fiberNode */
let workInProgress: null | FiberNode = null

/** 新一轮更新初始化 */
const prepareFreshStack = (fiber: FiberNode) => {
	workInProgress = fiber
}

const renderRoot = (fiber: FiberNode) => {
	prepareFreshStack(fiber)

	do {
		try {
			workLoop()
			break
		} catch (e) {
			console.warn(e)
			workInProgress = null
		}
	} while (true)
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
