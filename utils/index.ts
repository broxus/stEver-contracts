import { AbiEventName, Address, Contract, DecodedEventWithTransaction } from "locklift";
import { VaultAbi } from "../build/factorySource";

type VaultEvents = DecodedEventWithTransaction<VaultAbi, AbiEventName<VaultAbi>>["event"];
type ExtractEvent<T extends VaultEvents> = Extract<
  DecodedEventWithTransaction<VaultAbi, AbiEventName<VaultAbi>>,
  { event: T }
>;

export function assertEvent<T extends VaultEvents>(
  event: DecodedEventWithTransaction<VaultAbi, AbiEventName<VaultAbi>>[],
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

export const getAddressBalance = async (address: Address) =>
  locklift.utils.fromNano(await locklift.provider.getBalance(address));
