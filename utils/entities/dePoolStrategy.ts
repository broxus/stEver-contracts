import { Address } from "locklift/everscale-provider";

import { Cluster } from "./cluster";
import { Controller } from "../controller";
import { expect } from "chai";
import { Contract, getRandomNonce, toNano } from "locklift";
import { StEverVaultAbi } from "../../build/factorySource";
import { convertEverGas } from "../index";

export const createControllers = async ({
  cluster,
  validator,
  count,
}: {
  validator: Address;
  cluster: Cluster;
  count: number;
}): Promise<Array<Controller>> => {
  const traceTree = await cluster.deployStrategy({
    validator,
    count,
  });
  expect(traceTree).to.emit("NewStrategyDeployed", cluster.clusterContract).count(count);
  expect(traceTree).to.emit("StrategyAdded", cluster.stEver).count(count);

  const controllers = traceTree!
    .findForContract({
      contract: cluster.clusterContract,
      name: "NewStrategyDeployed",
    })
    .map(el => el!.params!.strategy);

  await traceTree.beautyPrint();

  // TODO uncomment when approve will be false by default
  // const vaultOwner = await cluster.stEver.methods
  //   .getDetails({ answerId: 0 })
  //   .call()
  //   .then(res => res.value0.owner);
  // {
  //   const { traceTree } = await locklift.tracing.trace(
  //     cluster.stEver.methods
  //       .approveStrategies({
  //         _strategies: controllers,
  //         queryId: getRandomNonce(),
  //         remainingGasTo: vaultOwner,
  //       })
  //       .send({
  //         from: vaultOwner,
  //         amount: convertEverGas(toNano(controllers.length)),
  //       }),
  //   );
  //   await traceTree?.beautyPrint();
  // }

  return controllers.map(s => new Controller(s, validator));
};
