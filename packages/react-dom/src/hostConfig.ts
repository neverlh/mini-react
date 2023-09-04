import { FiberNode } from 'react-reconciler/src/fiber'
import { HostText } from 'react-reconciler/src/workTags'
import { updateFiberProps, DOMElement } from './SyntheticEvent'
import { Props } from 'shared/ReactTypes'

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
