import {
	unstable_getCurrentPriorityLevel,
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority
} from 'scheduler'
import ReactCurrentBatchConfig from 'react/src/currentBatchConfig'
import { FiberRootNode } from './fiber'

export type Lane = number
export type Lanes = number

export const SyncLane = 0b00001
export const NoLane = 0b00000
export const NoLanes = 0b00000
export const InputContinuousLane = 0b00010
export const DefaultLane = 0b00100
export const TransitionLane = 0b01000
export const IdleLane = 0b10000

export function requestUpdateLane() {
	const isTransition = ReactCurrentBatchConfig.transition !== null
	if (isTransition) {
		return TransitionLane
	}
	// 当前执行的任务在Scheduler中的优先级
	const currentSchedulerPriority = unstable_getCurrentPriorityLevel()
	const lane = schedulerPriorityToLane(currentSchedulerPriority)
	return lane
}

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
	return lanes & -lanes
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane
}

/** set是否包含subset */
export function isSubsetOfLanes(set: Lanes, subset: Lane) {
	return (set & subset) === subset
}

/** lane => scheduler priority */
export function lanesToSchedulerPriority(lanes: Lanes) {
	const lane = getHighestPriorityLane(lanes)

	if (lane === SyncLane) {
		return unstable_ImmediatePriority
	}

	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority
	}
	if (lane === DefaultLane) {
		return unstable_NormalPriority
	}
	return unstable_IdlePriority
}

/** scheduler priority => lane */
export function schedulerPriorityToLane(schedulerPriority: number): Lane {
	if (schedulerPriority === unstable_ImmediatePriority) {
		return SyncLane
	}
	if (schedulerPriority === unstable_UserBlockingPriority) {
		return InputContinuousLane
	}
	if (schedulerPriority === unstable_NormalPriority) {
		return DefaultLane
	}
	return NoLane
}

export function includeSomeLanes(set: Lanes, subset: Lane | Lanes): boolean {
	return (set & subset) !== NoLanes
}

export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
	return set & ~subset
}
