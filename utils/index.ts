import { AbiEventName, Address, DecodedEventWithTransaction } from "locklift";
import BigNumber from "bignumber.js";
import { StEverVaultAbi } from "../build/factorySource";

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
// type ExtractEvent1<A, T extends string> = Extract<DecodedEventWithTransaction<A, AbiEventName<A>>, { event: T }>;
// type AbiExtractor<C extends Contract<any>> = C extends Contract<infer A> ? A : never;
// export const getLastEvents = async <
//   C extends Contract<any>,
//   A extends AbiExtractor<C>,
//   T extends DecodedEventWithTransaction<A, AbiEventName<A>>["event"],
//   R extends ExtractEvent1<A, T>,
// >(
//   contract: C,
//   eventName: T,
// ): Promise<R> => {};

export const getAddressEverBalance = async (address: Address) =>
  locklift.utils.fromNano(await locklift.provider.getBalance(address));
export const toNanoBn = (value: string | number): BigNumber => new BigNumber(locklift.utils.toNano(value));
export const getBalances = (addresses: Array<Address>): Promise<Array<BigNumber>> =>
  Promise.all(addresses.map(address => locklift.provider.getBalance(address))).then(res =>
    res.map(balance => new BigNumber(balance)),
  );
