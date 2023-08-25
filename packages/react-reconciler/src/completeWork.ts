import {
	createInstance,
	createTextInstance,
	appendInitialChild,
	Container
} from 'hostConfig'
import { updateFiberProps } from 'react-dom/src/SyntheticEvent'
import { FiberNode } from './fiber'
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	Fragment
} from './workTags'
import { NoFlags, Update } from './fiberFlags'

const markUpdate = (fiber: FiberNode) => {
	fiber.flags |= Update
}

/**
 * reconciler中递归的归阶段
 */
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps
	const current = wip.alternate

	switch (wip.tag) {
		case HostRoot:
		case FunctionComponent:
		case Fragment:
			bubbleProperties(wip)
			return null
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
				// TODO props是否变化

				/**
				 * 更新fiber属性，ReactDOM事件系统能正常工作的关键
				 * 比如如下代码
				 * const Foo = () => {
				 *   const [count, setCount] = useState(0)
				 *
				 *   return <div onClick={() => {
				 *              setCount(count + 1)
				 *           }}>{count}</div>
				 * }
				 * 如果不更新props的话，ReactDOM中事件机制执行时
				 * 从dom对应fiber提取到的onClick事件的handler将永远是首次mount时
				 * 的handler，这意味着他闭包中捕获到的count值永远都是0,所以不管你点击多少次div
				 * 他都等价于setCount(0 + 1),所以会导致不能正常更新
				 * 而调用了下面的updateFiberProps就不一样了，每次更新后handler里面闭包捕获到的count
				 * 都是最新值所以能正常更新
				 */
				updateFiberProps(wip.stateNode, newProps)
			} else {
				// 构建dom
				const instance = createInstance(wip.type, newProps)
				// 插入DOM树中
				appendAllChildren(instance, wip)
				wip.stateNode = instance
			}
			bubbleProperties(wip)
			return null
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content
				const newText = newProps.content

				// 内容更新 标记Update
				if (oldText !== newText) {
					markUpdate(wip)
				}
			} else {
				const instance = createTextInstance(newProps.content)
				wip.stateNode = instance
			}
			bubbleProperties(wip)
			return null
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip)
			}
			break
	}
}

/** 将fiber节点下所有instance(浏览器环境即DOM)连接 这样monut时只需要做一次Placement操作 */
const appendAllChildren = (parent: Container, wip: FiberNode) => {
	let node = wip.child

	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node.stateNode)
		} else if (node.child !== null) {
			//如果该子节点不是一个HostComponent HostText则继续向下找
			node.child.return = node
			node = node.child
			continue
		}

		if (node === wip) {
			return
		}

		while (node.sibling === null) {
			// 该层级所有以node为父节点的子树中离parent最近的dom已经完成追加，是时候返回到上层了
			if (node.return === null || node.return == wip) {
				return
			}

			/**
			 *          FunctionComp A
			 * FunctionCompB     FunctionCompC    FunctionCompD
			 *                       domE
			 * 如果进入循环时此时node为domE，一轮循环后当node被赋值为FunctionCompC后就会跳出这个循环
			 * 然后继续进行FunctionCompD的工作
			 *
			 */
			node = node?.return ?? null
		}

		//以该node为父节点的子树中离parent最近的dom已经完成追加，尝试对同级中其他fiber节点执行相同操作
		node.sibling.return = node.return
		node = node.sibling
	}
}

/**
 * 将该节点的子节点上flags全部冒泡到subtreeFlags中
 * 只用冒泡一级就行，因为我们对每层的节点都会进行该操作
 */
const bubbleProperties = (wip: FiberNode) => {
	let subtreeFlags = NoFlags

	let child = wip.child

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags

		subtreeFlags |= child.flags

		child.return = wip

		child = child.sibling
	}

	wip.subtreeFlags |= subtreeFlags
}
