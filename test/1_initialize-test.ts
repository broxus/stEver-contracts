import { preparation } from "./preparation";
import { Address, Contract, Signer } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import "sample-plugin";
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
    console.log(locklift.samplePlugin.getGreeting());
    expect((await vault.getDetails()).stTokenRoot.equals(tokenRoot.address)).to.be.true;
  });
});
