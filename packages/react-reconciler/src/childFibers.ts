import { Key, Props, ReactElementType } from 'shared/ReactTypes'
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols'
import {
	FiberNode,
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgress
} from './fiber'
import { ChildDeletion, Placement } from './fiberFlags'
import { Fragment, HostText } from './workTags'

type ExistingChildren = Map<string | number, FiberNode>

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

	const deleteRemainingChildren = (
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) => {
		if (!shouldTrackEffects) {
			return
		}

		let childToDelete = currentFirstChild
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete)
			childToDelete = childToDelete.sibling
		}
	}

	const reconcileSingleElement = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) => {
		const key = element.key

		// 更新前多节点 => 更新后单节点 while currentFiber.sibling
		while (currentFiber !== null) {
			// update
			if (currentFiber.key === key) {
				// key相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					// type相同
					if (currentFiber.type === element.type) {
						let props = element.props
						if (currentFiber.type === REACT_FRAGMENT_TYPE) {
							/**
							 * <>                  jsxs(Fragment, {
							 *   <div></div> ==>      children: [jsx("div", {}), jsx("div", {})]
							 *   <div></div> ==>   })
							 * </>
							 */
							props = props.children
						}
						// 复用current fiber
						const existing = useFiber(currentFiber, props)
						existing.return = returnFiber
						// 将剩下的sibling删除
						deleteRemainingChildren(returnFiber, currentFiber.sibling)
						return existing
					}
					// type不同 删掉之前所有同级节点
					deleteRemainingChildren(returnFiber, currentFiber)
					break
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element)
					}
					break
				}
			} else {
				// key不同 删掉之前的
				deleteChild(returnFiber, currentFiber)
				// 指向兄弟节点 A1,B2,C3 => B2
				currentFiber = currentFiber.sibling
			}
		}

		let fiber
		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFromFragment(element.props.children, key)
		} else {
			fiber = createFiberFromElement(element)
		}
		fiber.return = returnFiber
		return fiber
	}

	const reconcileSingleTextNode = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) => {
		// 同reconcileSingleElement
		while (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// 类型没变，可以复用
				const existing = useFiber(currentFiber, { content })
				existing.return = returnFiber
				// 将剩下的sibling删除
				deleteRemainingChildren(returnFiber, currentFiber.sibling)
				return existing
			}
			deleteChild(returnFiber, currentFiber)
			currentFiber = currentFiber.sibling
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

	// 同层多节点diff
	const reconcileChildrenArray = (
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) => {
		// 最后一个复用的fiber在returnFiber中index
		let lastPlacedIndex: number = 0
		// 创建的最后一个fiber
		let lastNewFiber: FiberNode | null = null
		// 创建的第一个fiber
		let firstNewFiber: FiberNode | null = null

		// current { key: fiberNode }
		const existingChildren: ExistingChildren = new Map()
		let current = currentFirstChild
		while (current !== null) {
			const keyToUse = current.key !== null ? current.key : current.index
			existingChildren.set(keyToUse, current)
			current = current.sibling
		}

		for (let i = 0; i < newChild.length; i++) {
			const after = newChild[i]
			// 判断节点是否复用 返回fiber
			const newFiber = updateFromMap(returnFiber, existingChildren, i, after)

			if (newFiber === null) {
				continue
			}

			// 赋值index 用于标记移动还是插入
			newFiber.index = i

			// 连接所有child与returnFiber
			newFiber.return = returnFiber
			if (lastNewFiber === null) {
				lastNewFiber = newFiber
				firstNewFiber = newFiber
			} else {
				lastNewFiber.sibling = newFiber
				lastNewFiber = lastNewFiber.sibling
			}

			// 多节点的击中mount时的优化策略
			if (!shouldTrackEffects) {
				continue
			}

			const current = newFiber.alternate

			if (current !== null) {
				// update
				const oldIndex = current.index
				// 移动只有向右移动的情况
				if (oldIndex < lastPlacedIndex) {
					// 移动
					newFiber.flags |= Placement
					continue
				} else {
					// 没有移动
					lastPlacedIndex = oldIndex
				}
			} else {
				// mount
				newFiber.flags |= Placement
			}
		}

		// 删除没有复用的fiber
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber)
		})

		// 返回第一个子节点 接着递阶段
		return firstNewFiber
	}

	const getElementKeyToUse = (element: any, index: number): Key => {
		if (
			Array.isArray(element) ||
			typeof element === 'string' ||
			typeof element === 'number' ||
			element === undefined ||
			element === null
		) {
			return index
		}
		return element.key !== null ? element.key : index
	}

	const updateFromMap = (
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null => {
		const keyToUse = getElementKeyToUse(element, index)
		const before = existingChildren.get(keyToUse)

		// hostText
		if (typeof element === 'string' || typeof element === 'number') {
			if (before) {
				if (before.tag === HostText) {
					existingChildren.delete(keyToUse)
					return useFiber(before, { content: element + '' })
				}
			}
			return new FiberNode(HostText, { content: element + '' }, null)
		}

		// ReactElement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(
							returnFiber,
							before,
							element,
							keyToUse,
							existingChildren
						)
					}
					if (before) {
						if (before.type === element.type) {
							existingChildren.delete(keyToUse)
							return useFiber(before, element.props)
						}
					}
					return createFiberFromElement(element)
			}

			/**
			 * arr 数组类型 [<li />, <li />] arr也是Fragment
			 * <ul>
			 *  <li>a</li>
			 *  <li>b</li>
			 *  {arr}
			 * </ul>
			 */
			if (Array.isArray(element)) {
				return updateFragment(
					returnFiber,
					before,
					element,
					keyToUse,
					existingChildren
				)
			}
		}

		return null
	}

	const reconcileChildFibers = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: any
	) => {
		const isUnkeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null
		if (isUnkeyedTopLevelFragment) {
			// returnFiber 为Fragment时
			newChild = newChild.props.children
		}

		if (typeof newChild === 'object' && newChild !== null) {
			// 多节点情况 diff
			if (Array.isArray(newChild)) {
				return reconcileChildrenArray(returnFiber, currentFiber, newChild)
			}
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

		// hostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			)
		}

		if (currentFiber !== null) {
			// 兜底删除
			deleteRemainingChildren(returnFiber, currentFiber)
		}

		if (__DEV__) {
			console.warn('未实现的reconciler类型', newChild)
		}

		return null
	}

	return reconcileChildFibers
}

/** 复用Fiber 通过current Fiber复制 wip Fiber */
const useFiber = (fiber: FiberNode, pending: Props) => {
	const clone = createWorkInProgress(fiber, pending)
	clone.index = 0
	clone.sibling = null
	return clone
}

const updateFragment = (
	returnFiber: FiberNode,
	current: FiberNode | undefined,
	elements: any,
	key: Key,
	existingChildren: ExistingChildren
) => {
	let fiber
	// 不存在或者不是Fragment
	if (!current || current.tag !== Fragment) {
		fiber = createFiberFromFragment(elements, key)
	} else {
		existingChildren.delete(key)
		fiber = useFiber(current, elements)
	}

	// console.log(fiber)

	fiber.return = returnFiber
	return fiber
}

export const reconcileChildFibers = childReconciler(true)

export const mountChildFiber = childReconciler(false)

export function cloneChildFibers(wip: FiberNode) {
	if (wip.child === null) {
		return
	}
	let currentChild = wip.child
	let newChild = createWorkInProgress(currentChild, currentChild.pendingProps)
	wip.child = newChild
	newChild.return = wip

	while (currentChild.sibling !== null) {
		currentChild = currentChild.sibling
		newChild = newChild.sibling = createWorkInProgress(
			newChild,
			newChild.pendingProps
		)
		newChild.return = wip
	}
}
