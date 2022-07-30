import { AbiEventName, Address, DecodedEventWithTransaction } from "locklift";
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
export const getAddressBalance = async (address: Address) =>
  locklift.utils.fromNano(await locklift.provider.getBalance(address));
