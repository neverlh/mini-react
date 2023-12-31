import {
	Container,
	Instance,
	commitUpdate,
	removeChild,
	appendChildToContainer,
	insertChildToContainer
} from 'hostConfig'
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber'
import {
	ChildDeletion,
	Flags,
	LayoutMask,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Ref,
	Update
} from './fiberFlags'
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags'
import { FCUpdateQueue, Effect } from './fiberHooks'
import { HookHasEffect } from './hookEffectTags'

let nextEffect: FiberNode | null = null

const commitEffects = (
	phrase: 'mutation' | 'layout',
	mask: Flags,
	callback: (fiber: FiberNode, root: FiberRootNode) => void
) => {
	return (finishedWork: FiberNode, root: FiberRootNode) => {
		nextEffect = finishedWork

		while (nextEffect !== null) {
			const child: FiberNode | null = nextEffect.child

			if ((nextEffect.subtreeFlags & mask) !== NoFlags && child !== null) {
				nextEffect = child
			} else {
				// 向上遍历
				up: while (nextEffect !== null) {
					callback(nextEffect, root)

					const sibling: FiberNode | null = nextEffect.sibling

					if (sibling !== null) {
						nextEffect = sibling
						break up
					}

					nextEffect = nextEffect.return
				}
			}
		}
	}
}

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const { flags, tag } = finishedWork

	// Placement
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork)
		finishedWork.flags &= ~Placement
	}

	// Update
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork)
		finishedWork.flags &= ~Update
	}

	// ChildDeletion
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions
		if (deletions !== null) {
			deletions.forEach((childToDelete) => commitDeletion(childToDelete, root))
		}

		finishedWork.flags &= ~ChildDeletion
	}

	if ((flags & PassiveEffect) !== NoFlags) {
		// 收集effect回调
		commitPassiveEffect(finishedWork, root, 'update')
		finishedWork.flags &= ~PassiveEffect
	}

	if ((flags & Ref) !== NoFlags && tag === HostComponent) {
		safelyDetachRef(finishedWork)
	}
}

export const commitMutationEffects = commitEffects(
	'mutation',
	MutationMask | PassiveMask,
	commitMutationEffectsOnFiber
)

const commitLayoutEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const { flags, tag } = finishedWork

	if ((flags & Ref) !== NoFlags && tag === HostComponent) {
		safelyAttachRef(finishedWork)
		finishedWork.flags &= ~Ref
	}
}

export const commitLayoutEffects = commitEffects(
	'layout',
	LayoutMask,
	commitLayoutEffectsOnFiber
)

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('开始Placement操作', finishedWork)
	}

	const hostParent = getHostParent(finishedWork)

	const sibling = getHostSibling(finishedWork)

	if (hostParent) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling)
	}
}

const getHostParent = (fiber: FiberNode): Container | null => {
	let parent = fiber.return

	while (parent) {
		const tag = parent.tag

		if (tag === HostComponent) {
			return parent.stateNode as Container
		}

		if (tag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container
		}

		parent = parent.return
	}

	if (__DEV__) {
		console.warn('未找到host parent')
	}
	return null
}

/**
 * 找到一个fiber节点右边首个不需要插入的dom节点 右边有可能不是DOM节点
 * @param fiber 从该节点开始往右边找
 * @returns 找到的dom节点
 */
const getHostSibling = (fiber: FiberNode) => {
	let node: FiberNode = fiber

	findSibling: while (true) {
		// 所有兄弟节点没找到 则再往上一级去找
		while (node.sibling === null) {
			const parent = node.return

			// 如果找到了根节点或者父节点是 DOM 元素，则返回 null
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null
			}
			node = parent
		}

		node.sibling.return = node.return
		node = node.sibling

		// 兄弟节点不是 HostComponent HostText则向下查找
		while (node.tag !== HostText && node.tag !== HostComponent) {
			if ((node.flags & Placement) !== NoFlags) {
				// 兄弟节点有Placement标记 则不能将finishedWork.stateNode插入到后面
				continue findSibling
			}
			if (node.child === null) {
				continue findSibling
			} else {
				// 向下遍历
				node.child.return = node
				node = node.child
			}
		}

		// 节点没有Placement标记 位置没有移动 可以insertBefore
		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode
		}
	}
}

const insertOrAppendPlacementNodeIntoContainer = (
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) => {
	// fiber host
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before)
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode)
		}
		return
	}

	// 这里向下遍历， 是因为finishedWork可能不是HostComponent HostText 没有宿主环境的节点
	const child = finishedWork.child
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent)
		let sibling = child.sibling

		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent)
			sibling = sibling.sibling
		}
	}
}

const recordHostChildrenToDelete = (
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) => {
	// 第一个要删除的host root节点
	const lastOne = childrenToDelete[childrenToDelete.length - 1]

	if (!lastOne) {
		childrenToDelete.push(unmountFiber)
	} else {
		/**
		 * 例如需要删除fragment下的dom 那就需要删除下面两个div 所以需要找他的兄弟节点都删除掉
		 * <div>
		 *  <>
		 *    <div></div><div></div>
		 *  <>
		 * </div>
		 */
		let node = lastOne.sibling
		while (node !== null) {
			if (node === unmountFiber) {
				childrenToDelete.push(unmountFiber)
			}
			node = node.sibling
		}
	}
}

const commitDeletion = (childToDelete: FiberNode, root: FiberRootNode) => {
	// 需要删除的节点可能会有好几个
	const rootChildrenToDelete: FiberNode[] = []

	// 递归子树 childToDelete的fiber tag有很多类型 不同类型需要不同操作
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
				return
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
				safelyDetachRef(unmountFiber)
				return
			case FunctionComponent:
				// // TODO解绑Ref
				commitPassiveEffect(unmountFiber, root, 'unmount')
				return
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber)
				}
		}
	})

	// 移除rootHostComponent的DOM
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(childToDelete)
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent)
			})
		}
	}

	// 垃圾回收
	childToDelete.return = null
	childToDelete.sibling = null
}

const commitNestedComponent = (
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) => {
	let node = root

	while (true) {
		onCommitUnmount(node)

		if (node.child !== null) {
			node.child.return = node
			node = node.child
			continue
		}

		if (node === root) {
			return
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return
			}

			node = node.return
		}

		node.sibling.return = node.return
		node = node.sibling
	}
}

/** 收集effect回调 */
const commitPassiveEffect = (
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) => {
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	) {
		// fiber节点删除 排除非函数组件 或者函数组件fiber没有PassiveEffect的情况
		return
	}

	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>
	if (updateQueue !== null) {
		root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect)
	}
}

/** 遍历effect list */
export const commitHookEffectList = (
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) => {
	let effect = lastEffect.next as Effect

	do {
		// 找到对应需要执行的effect (effect.tag & flags) === flags表示当前effect tag中是否包含flags 包含的话 就得执行callback
		if ((effect.tag & flags) === flags) {
			callback(effect)
		}
		effect = effect.next as Effect
	} while (effect !== lastEffect.next)
}

export const commitHookEffectListUnmount = (
	flags: Flags,
	lastEffect: Effect
) => {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy
		if (typeof destroy === 'function') {
			destroy()
		}
		effect.tag &= ~HookHasEffect
	})
}

export const commitHookEffectListDestroy = (
	flags: Flags,
	lastEffect: Effect
) => {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy
		if (typeof destroy === 'function') {
			destroy()
		}
	})
}

export const commitHookEffectListCreate = (
	flags: Flags,
	lastEffect: Effect
) => {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create
		if (typeof create === 'function') {
			effect.destroy = create()
		}
	})
}

/** ref赋值 */
const safelyAttachRef = (fiber: FiberNode) => {
	const ref = fiber.ref
	if (ref !== null) {
		const instance = fiber.stateNode
		if (typeof ref === 'function') {
			ref(instance)
		} else {
			ref.current = instance
		}
	}
}

/** 解绑ref */
const safelyDetachRef = (fiber: FiberNode) => {
	const ref = fiber.ref
	if (ref !== null) {
		if (typeof ref === 'function') {
			ref(null)
		} else {
			ref.current = null
		}
	}
}
