import { Container } from 'hostConfig'
import { Props } from 'shared/ReactTypes'

export const elementPropsKey = '__props'

const validEventTypeList = ['click']

type EventCallback = (e: Event) => void

interface SyntheticEvent extends Event {
	/** 阻止捕获和冒泡阶段中当前事件的进一步传播 */
	__stopPropagation: boolean
}

interface Paths {
	capture: EventCallback[]
	bubble: EventCallback[]
}

export interface DOMElement extends Element {
	[elementPropsKey]: Props
}

/**
 * 将jsx的props挂载到对应的dom节点上，待会该dom触发事件时
 * ReactDOM就能从event.target中获取到事件的handlers
 * @param element 要挂再属性的dom节点
 * @param props 要挂载的属性比如 {onClick: () => {}}
 */
export const updateFiberProps = (element: DOMElement, props: Props) => {
	element[elementPropsKey] = props
}

export const initEvent = (container: Container, eventType: string) => {
	if (!validEventTypeList.includes(eventType)) {
		console.warn('当前不支持', eventType, '事件')
		return
	}

	if (__DEV__) {
		console.warn('初始化事件：', eventType)
	}

	container.addEventListener(eventType, (e) => {
		dispatchEvent(container, eventType, e)
	})
}

const dispatchEvent = (container: Container, eventType: string, e: Event) => {
	const targetElement = e.target

	if (targetElement === null) {
		console.warn('事件不存在target', e)
		return
	}

	// 收集从target => container所有事件
	const { capture, bubble } = collectPaths(
		targetElement as DOMElement,
		container,
		eventType
	)

	// 构造合成事件
	const se = createSyntheticEvent(e)

	// 遍历执行事件
	triggerEventFlow(capture, se)

	if (!se.__stopPropagation) {
		triggerEventFlow(bubble, se)
	}
}

const collectPaths = (
	targetElement: DOMElement,
	container: Container,
	eventType: string
) => {
	const paths: Paths = {
		capture: [],
		bubble: []
	}

	// 收集事件
	while (targetElement && targetElement !== container) {
		const elementProps = targetElement[elementPropsKey]

		if (elementProps) {
			const callbackNameList = getEventCallbackNameFromEventType(eventType)
			if (callbackNameList) {
				callbackNameList.forEach((callbackName, i) => {
					const eventCallback = elementProps[callbackName]
					// 浏览器事件执行顺序 捕获 => 目标 => 冒泡
					if (eventCallback) {
						if (i === 0) {
							// 捕获
							paths.capture.unshift(eventCallback)
						} else {
							// 冒泡
							paths.bubble.push(eventCallback)
						}
					}
				})
			}
		}

		targetElement = targetElement.parentNode as DOMElement
	}

	return paths
}

const getEventCallbackNameFromEventType = (eventType: string) => {
	return {
		click: ['onClickCapture', 'onClick']
	}[eventType]
}

/** 构建合成事件 */
const createSyntheticEvent = (e: Event) => {
	const syntheticEvent = e as SyntheticEvent
	syntheticEvent.__stopPropagation = false
	const originStopPropagation = e.stopPropagation

	// 模拟阻止事件传播
	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true
		if (originStopPropagation) {
			originStopPropagation()
		}
	}

	return syntheticEvent
}

const triggerEventFlow = (paths: EventCallback[], se: SyntheticEvent) => {
	for (let i = 0; i < paths.length; i++) {
		const callback = paths[i]

		callback.call(null, se)

		if (se.__stopPropagation) {
			break
		}
	}
}
