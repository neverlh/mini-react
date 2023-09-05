import { Props } from 'shared/ReactTypes'
import { FiberNode } from 'react-reconciler/src/fiber'
import { HostComponent, HostText } from 'react-reconciler/src/workTags'
import { updateFiberProps, DOMElement } from './SyntheticEvent'

export type Container = Element
export type Instance = Element
export type TextInstance = Text

export const createInstance = (type: string, props: Props): Instance => {
	// TODO props
	const element = document.createElement(type) as unknown as DOMElement
	updateFiberProps(element, props)
	return element
}

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child)
}

export const createTextInstance = (content: any) => {
	return document.createTextNode(content)
}

export const appendChildToContainer = appendInitialChild

export const insertChildToContainer = (
	child: Instance,
	container: Instance | Container,
	before: Instance
) => {
	container.insertBefore(child, before)
}

export const removeChild = (
	child: Instance | TextInstance,
	container: Container
) => {
	container.removeChild(child)
}

export const commitTextUpdate = (
	textInstance: TextInstance,
	content: string
) => {
	textInstance.textContent = content
}

export const commitUpdate = (fiber: FiberNode) => {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.pendingProps.content
			commitTextUpdate(fiber.stateNode, text)
			break
		case HostComponent:
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
			updateFiberProps(fiber.stateNode, fiber.memoizedProps)
			break
		default:
			if (__DEV__) {
				console.warn('update还未实现的类型', fiber)
			}
			break
	}
}

export const scheduleMicroTask =
	typeof queueMicrotask === 'function'
		? queueMicrotask
		: typeof Promise === 'function'
		? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
		: setTimeout
