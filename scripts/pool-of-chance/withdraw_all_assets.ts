import { toNano } from "locklift";

import data from "./pools_to_withdraw.json";

async function main() {
  const poolFactory = await locklift.factory.getDeployedContract("PoolOfChanceFactory", data.poolFactory);
  const ownerAddress = await poolFactory.methods
    .owner()
    .call()
    .then(a => a.owner);

  const stTokenRoot = await locklift.factory.getDeployedContract(
    "TokenRootUpgradeable",
    await poolFactory.getFields().then(a => a.fields!.stTokenRoot),
  );

  for (const pool of data.pools) {
    console.log("Withdraw from pool:", pool);
    const { traceTree } = await locklift.tracing.trace(
      poolFactory.methods
        .withdrawAllAssetsFromPool({
          _pool: pool,
        })
        .send({
          from: ownerAddress,
          amount: toNano(5),
        }),
      { allowedCodes: { compute: [7010] } },
    );
    console.log(
      "St balance change:",
      traceTree?.tokens.getTokenBalanceChange(
        await stTokenRoot.methods
          .walletOf({ answerId: 0, walletOwner: ownerAddress })
          .call()
          .then(a => a.value0),
      ),
    );
    const prizeTokenRoot = await locklift.factory.getDeployedContract(
      "TokenRootUpgradeable",
      await locklift.factory
        .getDeployedContract("PoolOfChance", pool)
        .methods.getPoolInfo({ answerId: 0 })
        .call()
        .then(a => a.value0.prizeTokenRoot),
    );
    console.log(
      "Prize token balance change:",
      traceTree?.tokens.getTokenBalanceChange(
        await prizeTokenRoot.methods
          .walletOf({ answerId: 0, walletOwner: ownerAddress })
          .call()
          .then(a => a.value0),
      ),
    );
    console.log("Venom balance change:", traceTree?.getBalanceDiff(ownerAddress));
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
