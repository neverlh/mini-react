import { Container } from 'hostConfig'
import { ReactElementType } from 'shared/ReactTypes'

import { scheduleUpdateOnFiber } from './workLoop'
import { FiberNode, FiberRootNode } from './fiber'
import { HostRoot } from './workTags'
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	UpdateQueue
} from './updateQueue'
import { requestUpdateLane } from './fiberLanes'
import { unstable_runWithPriority, unstable_ImmediatePriority } from 'scheduler'

/**
 *
 * @param containerInfo 当前创建的React App所挂载在的对应宿主环境的节点，在concurrent模式下由createRoot方法传入
 * @returns 返回FiberRoot（整个应用的根节点，其中current保存有当前页面所对应的fiber树）
 */
export const createContainer = (container: Container) => {
	const hostRootFiber = new FiberNode(HostRoot, {}, null)

	const root = new FiberRootNode(container, hostRootFiber)

	hostRootFiber.updateQueue = createUpdateQueue()

	return root
}

/**
 *
 * @param element 在concurrent模式下由createRoot.render()方法传入
 * @param root 整个应用的根节点，其current属性(类型为Fiber，是否为Fiber树根节点由tag是否为HostRoot决定)保存有当前页面所对应的fiber树
 */
export const updateContainer = (
	element: ReactElementType | null,
	root: FiberRootNode
) => {
	unstable_runWithPriority(unstable_ImmediatePriority, () => {
		const hostRootFiber = root.current
		const lane = requestUpdateLane()
		const update = createUpdate<ReactElementType | null>(element, lane)
		enqueueUpdate(
			hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
			update
		)
		// 调度该fiber节点上的更新
		scheduleUpdateOnFiber(hostRootFiber, lane)
	})
	return element
}
