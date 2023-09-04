let syncQueue: ((...args: any[]) => void)[] | null = null
let isFlushingSyncQueue = false

/** 保存同批所有的update */
export const scheduleSyncCallback = (callback: (...args: any) => void) => {
	if (syncQueue === null) {
		syncQueue = [callback]
	} else {
		syncQueue.push(callback)
	}
}

export const flushSyncCallbacks = () => {
	// 保证批更新 只会执行一次commit
	if (!isFlushingSyncQueue && syncQueue) {
		isFlushingSyncQueue = true

		try {
			syncQueue.forEach((callback) => callback())
		} catch (e) {
			if (__DEV__) {
				console.warn('flushSyncCallbacks报错', e)
			}
		} finally {
			isFlushingSyncQueue = false
			syncQueue = null
		}
	}
}
