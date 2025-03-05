import { ElectorAbi } from "../../build/factorySource";
import { Contract, getRandomNonce, toNano } from "locklift";
import { Address } from "locklift/everscale-provider";

export enum ElectorState {
  SUCCESS,
  ERROR,
}
export class Elector {
  constructor(public readonly electorContract: Contract<ElectorAbi>, private readonly payer: Address) {}

  static async deployElector(payer: Address) {
    const { contract: elector } = await locklift.factory.deployContract({
      contract: "Elector",
      value: toNano(1_000_000),
      publicKey: await locklift.keystore.getSigner("0")!.then(signer => signer!.publicKey),
      initParams: {
        _nonce: getRandomNonce(),
      },
      constructorParams: {},
    });

    return new Elector(elector, payer);
  }

  setState = async (state: ElectorState) => {
    return this.electorContract.methods
      .setState({
        _state: state,
      })
      .send({
        from: this.payer,
        amount: toNano(1),
      });
  };

  setReward = async (reward: string) => {
    return this.electorContract.methods
      .setReward({
        _reward: reward,
      })
      .send({
        from: this.payer,
        amount: toNano(1),
      });
  };
}
