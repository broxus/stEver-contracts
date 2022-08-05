import { preparation } from "./preparation";
import { Contract, Signer } from "locklift";
import { User } from "../utils/user";
import { Governance } from "../utils/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/vault";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
describe.skip("Initialize testing", function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
    } = await preparation();
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
  });
  it("Vault should be initialized", async () => {
    await vault.initialize();
    const details = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});

    expect(details.value0.stEverRoot.equals(tokenRoot.address)).to.be.true;
  });
});
