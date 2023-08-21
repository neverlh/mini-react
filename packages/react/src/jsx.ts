import { ReactElementType, Key, Ref } from 'shared/ReactTypes'
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'

const hasOwnProperty = Object.prototype.hasOwnProperty

export function jsx(
	type: any,
	config: Record<string, any>,
	maybeKey?: Key
): ReactElementType {
	const props: any = {}
	let ref: Ref = null
	let key: Key = null

	if (maybeKey !== undefined) {
		key = '' + maybeKey
	}

	for (const propName in config) {
		const val = config[propName]

		if (propName === 'ref') {
			if (val !== undefined) {
				ref = val
			}
			continue
		}

		if (hasOwnProperty.call(config, propName)) {
			props[propName] = val
		}
	}

	return {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props
	}
}

export const jsxDEV = jsx

export function createElement(
	type: any,
	config: Record<string, any>,
	...maybeChildren: any[]
): ReactElementType {
	const props: any = {}
	let key: Key = null
	let ref: Ref = null

	for (const propName in config) {
		const val = config[propName]

		if (propName === 'key') {
			if (val !== undefined) {
				key = '' + val
			}
			continue
		}

		if (propName === 'ref') {
			if (val !== undefined) {
				ref = val
			}
			continue
		}

		if (hasOwnProperty.call(config, propName)) {
			props[propName] = val
		}
	}

	const maybeChildrenLength = maybeChildren.length

	if (maybeChildrenLength === 1) {
		props.children = maybeChildren[0]
	} else if (maybeChildrenLength > 1) {
		props.children = maybeChildren
	}

	return {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props
	}
}
