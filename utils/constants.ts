import { expect } from "chai";
import { toNano } from "locklift";

export const GAIN_FEE = locklift.utils.toNano(1);
export const ITERATION_FEE = locklift.utils.toNano(0.1);

export const INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION = toNano(0.3);
