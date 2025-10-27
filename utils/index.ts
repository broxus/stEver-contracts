import { AbiEventName, Address, DecodedEventWithTransaction, toNano } from "locklift";
import BigNumber from "bignumber.js";
import { StEverVaultAbi } from "../build/factorySource";
import { CURRENT_GAS_PRICE, EVER_GAS_PRICE } from "./constants";

type VaultEvents = DecodedEventWithTransaction<StEverVaultAbi, AbiEventName<StEverVaultAbi>>["event"];
type ExtractEvent<T extends VaultEvents> = Extract<
  DecodedEventWithTransaction<StEverVaultAbi, AbiEventName<StEverVaultAbi>>,
  { event: T }
>;

export function assertEvent<T extends VaultEvents>(
  event: DecodedEventWithTransaction<StEverVaultAbi, AbiEventName<StEverVaultAbi>>[],
  eventName: T,
): asserts event is Array<ExtractEvent<T>> {
  const depositEvents = event.filter((e): e is ExtractEvent<T> => e.event === eventName);
  if (depositEvents.length === 0) {
    throw new Error("No deposit event found");
  }
}

export const getAddressEverBalance = async (address: Address) =>
  locklift.utils.fromNano(await locklift.provider.getBalance(address));
export const toNanoBn = (value: string | number): BigNumber => new BigNumber(locklift.utils.toNano(value));
export const getBalances = (addresses: Array<Address>): Promise<Array<BigNumber>> =>
  Promise.all(addresses.map(address => locklift.provider.getBalance(address))).then(res =>
    res.map(balance => new BigNumber(balance)),
  );
export const getBalance = (address: Address) => getBalances([address]).then(res => res[0]);
export const isT = <T>(p: T): p is T & {} => !!p;

export const convertEverGas = (everGas: number | string): string => {
  let gas = Number(everGas);
  return ((CURRENT_GAS_PRICE / EVER_GAS_PRICE) * gas).toString();
};
export const DEPLOY_WALLET_VALUE = Number(convertEverGas(toNano(0.05))) + Number(toNano(0.1));
export const userWithdrawMsgValue = convertEverGas(
  toNano(
    0.1 + // WITHDRAW_FEE
      0.1 + // FEE_FOR_WITHDRAW_TO_USER_ITERATION
      0.3 + // WITHDRAW_FEE_FOR_USER_DATA
      0.05, // value for tokens transfer
  ),
);
export const ITERATION_FEE = convertEverGas(locklift.utils.toNano(0.1));
