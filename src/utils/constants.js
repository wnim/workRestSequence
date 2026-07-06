// Timeline block geometry — shared by BlockItem, TimelineEditor (hit-test), WaveformSVG
export const TIMELINE_CANVAS_HEIGHT = 280;
export const BLOCK_HEIGHT = 50;
export const BLOCK_TOP = Math.round((TIMELINE_CANVAS_HEIGHT - BLOCK_HEIGHT) / 2);

// Visual scale applied to all blocks in an active multi-block drag
export const MULTI_DRAG_SCALE = 0.75;

export const LS_GIST_CONFIG = 'pulse_timer_gist_config';
export const LS_WORKOUTS = 'pulse_timer_workouts';
export const LS_ACTIVE_WORKOUT = 'pulse_timer_active_workout';
export const LS_SAVE_PENDING = 'pulse_timer_save_pending';
export const GIST_FILENAME = 'pulse_timer.json';
