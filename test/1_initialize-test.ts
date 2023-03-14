import { preparation } from "./preparation";
import { Contract, Signer } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
describe("Initialize testing", function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
    } = await preparation({ deployUserValue: locklift.utils.toNano(10) });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
  });
  it("Vault should be initialized", async () => {
    type A = {
      a: number;
      b: string;
    };
    const fn = <T extends keyof A>(firstField: T, secondField: A[T]) => {};

    fn("a", "");
    // const { tvc } = locklift.factory.getContractArtifacts("DepoolStrategyFactory");
    // const { data } = await locklift.provider.splitTvc(tvc);
    // const res = await locklift.provider.unpackFromCell({
    //   abiVersion: "2.2",
    //   boc: data!,
    //   allowPartial: true,
    //   structure: [
    //     { key: 1, name: "nonce", type: "uint128" },
    //     { key: 2, name: "dePoolStrategyCode", type: "cell" },
    //     { key: 3, name: "stEverVault", type: "address" },
    //   ],
    // });
    // console.log(res);
    expect((await vault.getDetails()).stTokenRoot.equals(tokenRoot.address)).to.be.true;
  });
});
