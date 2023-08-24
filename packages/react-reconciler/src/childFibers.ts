import { Props, ReactElementType } from 'shared/ReactTypes'
import {
	FiberNode,
	createFiberFormElement,
	createWorkInProgress
} from './fiber'
import { ChildDeletion, Placement } from './fiberFlags'
import { HostText } from './workTags'
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'

/**
 * diff函数的创建函数
 * @param shouldTrackEffects 是否应该追踪副作用，优化策略，在首次mount只需要对HostRoot的子节点执行一次Placement操作就行
 * 不需要其他的操做，所以在创建mount的diff函数时设置为false,在update时需要进行增删改所以需要追踪副作用，所以创建
 * 更新时的diff函数设置为true
 * @returns
 */
const childReconciler = (shouldTrackEffects: boolean) => {
	const deleteChild = (returnFiber: FiberNode, childToDelete: FiberNode) => {
		if (!shouldTrackEffects) {
			return
		}

		const deletions = returnFiber.deletions
		if (deletions === null) {
			returnFiber.deletions = [childToDelete]
			returnFiber.flags |= ChildDeletion
		} else {
			deletions.push(childToDelete)
		}
	}

	const reconcileSingleElement = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) => {
		const key = element.key

		work: if (currentFiber !== null) {
			// update
			if (currentFiber.key === key) {
				// key相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					// type相同
					if (currentFiber.type === element.type) {
						// 复用current fiber
						const existing = useFiber(currentFiber, element.props)
						existing.return = returnFiber
						return existing
					}
					// type不同 删掉之前的
					deleteChild(returnFiber, currentFiber)
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element)
					}
					break work
				}
			} else {
				// key不同 删掉之前的
				deleteChild(returnFiber, currentFiber)
			}
		}

		const fiber = createFiberFormElement(element)
		fiber.return = returnFiber
		return fiber
	}

	const reconcileSingleTextNode = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) => {
		if (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// 类型没变，可以复用
				const existing = useFiber(currentFiber, { content })
				existing.return = returnFiber
				return existing
			}
			deleteChild(returnFiber, currentFiber)
		}

		const fiber = new FiberNode(HostText, { content }, null)
		fiber.return = returnFiber
		return fiber
	}

	const placeSingleChild = (fiber: FiberNode) => {
		// 击中mount时的优化策略
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement
		}
		return fiber
	}

	const reconcileChildFibers = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) => {
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					)
				default:
					if (__DEV__) {
						console.warn('未实现的reconcile类型', newChild)
					}
					break
			}
		}

		// TODO 多节点情况 diff

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			)
		}

		if (currentFiber !== null) {
			// 兜底删除
			deleteChild(returnFiber, currentFiber)
		}

		if (__DEV__) {
			console.warn('未实现的reconciler类型', newChild)
		}

		return null
	}

	return reconcileChildFibers
}

const useFiber = (fiber: FiberNode, pending: Props) => {
	const clone = createWorkInProgress(fiber, pending)
	clone.index = 0
	clone.sibling = null
	return clone
}

export const reconcileChildFibers = childReconciler(true)

export const mountChildFiber = childReconciler(false)
