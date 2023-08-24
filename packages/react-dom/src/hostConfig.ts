import { FiberNode } from 'react-reconciler/src/fiber'
import { HostText } from 'react-reconciler/src/workTags'

export type Container = Element
export type Instance = Element
export type TextInstance = Text

export const createInstance = (type: any, props: any): Instance => {
	// TODO props
	const element = document.createElement(type)
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
