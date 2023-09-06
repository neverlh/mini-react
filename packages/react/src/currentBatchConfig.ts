interface BatchConfig {
	transition: number | null
}

const ReactCurrentBatchConfig: BatchConfig = {
	/** 用于区分startTransition中的setState的优先级 */
	transition: null
}

export default ReactCurrentBatchConfig
