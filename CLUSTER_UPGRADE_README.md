## StEver cluster upgrade guide
1. Set `StEverVault` to the paused state via method `setIsPaused(true)` value=2
2. Build contracts `npx locklift build`
3. Upgrade `DepoolStrategyFactory`
   - Get new code `cat build/DepoolStrategyFactory.base64`
   - Upgrade factory via `DepoolStrategyFactory.upgrade(newCode, newVersion=3, _sendGasTo)` value=2
   - Upgrade strategies
     - Get new strategy code `cat build/StrategyDePool.base64`
     - Install new code `DepoolStrategyFactory.installNewStrategyCode(_strategyCode, _sendGasTo)` value=2
     - Retrieve strategies addresses `StEverVault.strategies()`
     - Run strategies upgrade `DepoolStrategyFactory.upgradeStrategies(strategies)` value=countOfStrategies * 2 + 1
4. Upgrade `StEverVault`
   - Get new code `cat build/StEverVault.base64`
   - Run upgrade `StEverVault.upgrade(newCode, newVersion=3, _sendGasTo)` value=2
5. Set new fields
   - Set strategy factory address `StEverVault.setStrategyFactory(DePoolStrategyFactory address)` value=2
   - Set cluster code
     - Get cluster code `cat build/StEverCluster.base64`
     - `StEverVault.setNewClusterCode(clusterCode)` value=2
6. Create a cluster
   - Call method `StEverVault.createCluster(_clusterOwner=admin, _clusterOwner=0, _maxStrategiesCount=10000)` value=5
   - Find cluster address inside the event `ClusterCreated`
   - Or address can be retrieved via method `getClusterAddress(_clusterOwner=admin, _clusterNonce=0)`
   - Or cluster list can be retrieved via `clusterPools()`
7. Assign strategies to the new cluster
   - Retrieve strategies addresses `StEverVault.strategies()`
   - Assign strategies `StEverVault.delegateStrategies(_strategies, _destinationCluster=cluster)` value=strategiesCount*2
8. Set `StEverVault` to the active state via method `setIsPaused(false)` value=2
