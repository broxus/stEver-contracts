import { Controller } from "../../utils/controller";
import { Address } from "locklift/everscale-provider";
import { WalletTypes } from "locklift";

const main2 = async () => {
  const signer = (await locklift.keystore.getSigner("0"))!;
  const adminAddress = new Address("0:6c816f2c4840bb6ad434c0ca25b4947d6159409ea5002c0066602c1c4125b83b");
  const account = await locklift.factory.accounts.addExistingAccount({
    address: adminAddress,
    type: WalletTypes.EverWallet,
  });
  const controllerCOntract = new Controller(
    new Address("-1:353ef06a0c236db01e7ac6de3ea2033cabbc00d0b635dfbde3a37c5011df7e58"),
    adminAddress,
  );

  const { traceTree } = await controllerCOntract.newStake({
    queryId: 1741793366303,
    maxFactor: 196608,
    stakeAt: 1741793444,
    valueToStake: "50000000000000",
    adnlAddr: "30318225572055994315379833926926798418664003097705292461024222313172906188525",
    validatorPubKey: "30318225572055994315379833926926798418664003097705292461024222313172906188525",
  });
  await traceTree?.beautyPrint();
};

main2();
