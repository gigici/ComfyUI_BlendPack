/**
 * Solve full timeline for exportFullVideos mode
 * Structure: [Clip A full] -> [Transition] -> [Clip B full]
 */
export function solveFullTimeline(globalProgress, params) {
    const {
        transitionDuration = 2.0,
        videoDurA = 10,
        videoDurB = 10
    } = params;

    const clipADuration = videoDurA;
    const clipBDuration = videoDurB;
    const totalDuration = clipADuration + transitionDuration + clipBDuration;
    const currentTime = globalProgress * totalDuration;

    const safetyMargin = 0.04;

    // Phase 1: CLIP_A (0 to clipADuration)
    if (currentTime < clipADuration) {
        const timeA = Math.min(currentTime, videoDurA - safetyMargin);
        return {
            phase: 'CLIP_A',
            transitionProgress: 0,
            timeA: Math.max(0, timeA),
            timeB: 0,
            totalDuration,
            currentTime
        };
    }

    // Phase 2: TRANSITION (clipADuration to clipADuration + transitionDuration)
    if (currentTime < clipADuration + transitionDuration) {
        const transitionTime = currentTime - clipADuration;
        const transitionProgress = transitionTime / transitionDuration;

        // During transition: A ends at its last frames, B starts from beginning
        const timeA = Math.min(clipADuration + transitionTime, videoDurA - safetyMargin);
        const timeB = Math.min(transitionTime, videoDurB - safetyMargin);

        return {
            phase: 'TRANSITION',
            transitionProgress: Math.max(0, Math.min(1, transitionProgress)),
            timeA: Math.max(0, timeA),
            timeB: Math.max(0, timeB),
            totalDuration,
            currentTime
        };
    }

    // Phase 3: CLIP_B (clipADuration + transitionDuration to end)
    const clipBTime = currentTime - clipADuration - transitionDuration;
    const timeB = Math.min(transitionDuration + clipBTime, videoDurB - safetyMargin);

    return {
        phase: 'CLIP_B',
        transitionProgress: 1,
        timeA: videoDurA - safetyMargin,
        timeB: Math.max(0, timeB),
        totalDuration,
        currentTime
    };
}

/**
 * Calculate total frame count for full video export
 */
export function getFullTimelineFrameCount(params) {
    const { transitionDuration = 2.0, videoDurA = 10, videoDurB = 10, fps = 30 } = params;
    const totalDuration = videoDurA + transitionDuration + videoDurB;
    return Math.ceil(totalDuration * fps);
}

export function solveTimeline(globalProgress, params) {
    const {
        transitionDuration = 2.0,
        clipAStart = 0,
        clipBStart = 0,
        videoDurA = 10,
        videoDurB = 10
    } = params;

    const totalDuration = transitionDuration;
    const currentTime = globalProgress * totalDuration;
    const transitionProgress = globalProgress;

    const startTimeA = (clipAStart < 0) ? Math.max(0, videoDurA + clipAStart) : clipAStart;
    const startTimeB = (clipBStart < 0) ? Math.max(0, videoDurB + clipBStart) : clipBStart;

    const timeA = startTimeA + currentTime;
    const timeB = startTimeB + currentTime;

    const safetyMargin = 0.04;
    const finalTimeA = Math.max(0, Math.min(timeA, videoDurA - safetyMargin));
    const finalTimeB = Math.max(0, Math.min(timeB, videoDurB - safetyMargin));

    return {
        transitionProgress,
        timeA: finalTimeA,
        timeB: finalTimeB,
        phase: 'TRANSITION',
        totalDuration,
        currentTime
    };
}
