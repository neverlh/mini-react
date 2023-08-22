import { Action } from 'shared/ReactTypes'

export interface Update<State> {
	action: Action<State>
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null
	}
}

export const createUpdate = <State>(action: Action<State>): Update<State> => {
	return {
		action
	}
}

export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		}
	} as UpdateQueue<State>
}

/** 将update插入到fiber节点 updateQueue上 */
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	updateQueue.shared.pending = update
}

/** 消费update */
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null
): {
	memoizedState: State
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	}

	if (pendingUpdate !== null) {
		const action = pendingUpdate.action

		if (action instanceof Function) {
			// action => (perState) => state
			result.memoizedState = action(baseState)
		} else {
			// action => state
			result.memoizedState = action
		}
	}

	return result
}
