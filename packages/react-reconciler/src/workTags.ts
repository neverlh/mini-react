export type WorkTags =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText
	| typeof Fragment
	| typeof ContextProvider

/** 函数组件FiberNode节点对应的tag */
export const FunctionComponent = 0

/** 根结点FiberNode节点对应的tag */
export const HostRoot = 3

/** html标签FiberNode对应的tag */
export const HostComponent = 5

/** 文本节点FiberNode对应的tag */
export const HostText = 6

export const Fragment = 7

export const ContextProvider = 8
