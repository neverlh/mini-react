export type WorkTags =
	| typeof FuntionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText

/** 函数组件FiberNode节点对应的tag */
export const FuntionComponent = 0

/** 根结点FiberNode节点对应的tag */
export const HostRoot = 3

/** html标签FiberNode对应的tag */
export const HostComponent = 5

/** 文本节点FiberNode对应的tag */
export const HostText = 6
