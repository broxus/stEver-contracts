import { expect } from "chai";
import { toNano } from "locklift";
import { convertEverGas } from "./index";

export const GAIN_FEE = locklift.utils.toNano(1);

export const ONE_HUNDRED_PERCENT = 1_000;
export const INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION = toNano(0.3);
export const HANDLING_REPAY_LOAN_FEE = 0.03;
export const EVER_GAS_PRICE = 1000;
export const GAS_PRICE_MULTIPLIER = 60;
export const CURRENT_GAS_PRICE = EVER_GAS_PRICE * GAS_PRICE_MULTIPLIER;
export const MIN_CALL_MSG_VALUE = 0.05; // ever
export const CONTROLLER_DEPLOY_VALUE = 150;
