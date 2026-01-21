import { Address, toNano, WalletTypes } from "locklift";
import { factorySource } from "../build/factorySource";
import fs from "node:fs";
import { getPublicKey } from "everscale-crypto";

const ST_EVER_VAULT_ADDRESS = new Address("0:0937d2a80996268db6b48cfcdfc22c934c8569ea8d70f6f05df7d3ff86c6b4c4");
const OWNER_ADDRESS = new Address("0:6c816f2c4840bb6ad434c0ca25b4947d6159409ea5002c0066602c1c4125b83b");
const main1 = async () => {
  // const res = await locklift.provider
  //   .getFullContractState({
  //     address: ST_EVER_VAULT_ADDRESS,
  //   })
  //   .then(res => res.state?.boc);
  // fs.writeFileSync(path.resolve("./OldStEverData.boc"), res!);
  // throw "bye bye";
  locklift.network.insertAccount({
    boc: fs.readFileSync("./OldStEverData.boc", "utf8"),
    address: ST_EVER_VAULT_ADDRESS,
    type: "accountStuffBoc",
    abi: factorySource.StEverVault,
  });

  locklift.keystore.addKeyPair({
    publicKey: getPublicKey(process.env.VENOM_MAIN_GIVER_KEY!),
    secretKey: process.env.VENOM_MAIN_GIVER_KEY!,
  });

  // locklift.network.insertWallet(OWNER_ADDRESS);

  const res = await locklift.factory.accounts.addNewAccount({
    type: WalletTypes.EverWallet,
    publicKey: getPublicKey(process.env.VENOM_MAIN_GIVER_KEY!),
    value: toNano(1000000000),
  });
  console.log(res.account.address.toString());

  console.log(await locklift.provider.getBalance(OWNER_ADDRESS));
  // locklift.network.insertAccount({
  //
  // })
  const stEverContact = locklift.factory.getDeployedContract("StEverVault", ST_EVER_VAULT_ADDRESS);

  {
    const { traceTree } = await locklift.tracing.trace(
      stEverContact.methods
        .upgrade({
          _newCode: locklift.factory.getContractArtifacts("StEverVault").code,
          _newVersion: "2",
          _sendGasTo: OWNER_ADDRESS,
        })
        .send({
          from: OWNER_ADDRESS,
          amount: toNano(10),
        }),
    );

    await traceTree?.beautyPrint();
  }
};

main1()
  .then(() => {
    console.log("Upgrade test completed successfully.");
  })
  .catch(error => {
    console.error("Error during upgrade test:", error);
  });
