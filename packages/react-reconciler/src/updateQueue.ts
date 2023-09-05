import { Dispatch } from 'react/currentDispatcher'
import { Action } from 'shared/ReactTypes'
import { isSubsetOfLanes, Lane, NoLane } from './fiberLanes'

export interface Update<State> {
	action: Action<State>
	lane: Lane
	next: Update<any> | null
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null
	}
	dispatch: Dispatch<State> | null
}

export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null
	}
}

export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>
}

/** 将update插入到fiber节点 updateQueue上 */
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending

	if (pending === null) {
		// pending = a -> a
		update.next = update
	} else {
		// pending = b -> a -> b
		// pending = c -> a -> b -> c
		update.next = pending.next
		pending.next = update
	}

	updateQueue.shared.pending = update
}

/** 消费update */
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): {
	memoizedState: State
	baseState: State
	baseQueue: Update<State> | null
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState,
		baseState,
		baseQueue: null
	}

	if (pendingUpdate !== null) {
		const first = pendingUpdate.next
		let pending = pendingUpdate.next as Update<any>

		let newBaseState = baseState
		let newBaseQueueFirst: Update<State> | null = null
		let newBaseQueueLast: Update<State> | null = null
		let newState = baseState

		do {
			const updateLane = pending.lane

			if (!isSubsetOfLanes(renderLane, updateLane)) {
				// 优先级不够 被跳过
				const clone = createUpdate(pending.action, updateLane)
				if (newBaseQueueFirst === null) {
					// 第一个被跳过的
					newBaseQueueFirst = clone
					newBaseQueueLast = clone
					// 第一个被跳过前的state作为下次更新的baseState
					newBaseState = newState
				} else {
					;(newBaseQueueLast as Update<any>).next = clone
					newBaseQueueLast = clone
				}
			} else {
				if (newBaseQueueLast !== null) {
					// 之前存在被跳过的 往后所有的都需要保存 并且NoLane，供下一次消费全部消费掉
					const clone = createUpdate(pending.action, NoLane)
					newBaseQueueLast.next = clone
					newBaseQueueLast = clone
				}

				const action = pending.action
				if (action instanceof Function) {
					// action => (perState) => state
					newState = action(newState)
				} else {
					// action => state
					newState = action
				}
			}

			pending = pending.next as Update<any>
		} while (pending !== first)

		if (newBaseQueueLast === null) {
			// 本次计算没有update被跳过
			newBaseState = newState
		} else {
			newBaseQueueLast.next = newBaseQueueFirst
		}
		result.memoizedState = newState
		result.baseState = newBaseState
		result.baseQueue = newBaseQueueLast
	}

	return result
}
