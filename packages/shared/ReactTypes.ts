export type ElementType = any

export type Key = any

export type Ref = { current: null } | ((instance: any) => void)

export type Props = any

export interface ReactElementType {
	/**
	 * 该属性的意义[https://overreacted.io/zh-hans/why-do-react-elements-have-typeof-property/]
	 */
	$$typeof: symbol | number
	type: ElementType
	key: Key
	ref: Ref
	props: Props
}

export type Action<State> = State | ((preState: State) => State)

export type ReactContext<T> = {
	$$typeof: symbol | number
	Provider: ReactProviderType<T> | null
	_currentValue: T
}

export type ReactProviderType<T> = {
	$$typeof: symbol | number
	_context: ReactContext<T> | null
}
