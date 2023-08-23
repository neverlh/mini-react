export type Container = Element
export type Instance = Element

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
