export const COL_W = 72;
export const LANE_H = 36;
export const NODE_R = 6;
export const LABEL_H = 22;
export const LANE_LABEL_W = 72;
/** Fixed graph height for maxLaneSide=2 (5 lanes) so board size never shifts. */
export const TIMELINE_GRAPH_MAX_LANES = 5;
export const TIMELINE_GRAPH_HEIGHT_PX =
  TIMELINE_GRAPH_MAX_LANES * LANE_H + LABEL_H + 20;
